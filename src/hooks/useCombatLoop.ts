// ─────────────────────────────────────────────────────────────────────────────
//  Combat orchestrator. Owns the state machine + spawn/victory delays + the
//  recordKill / incense mutations. Tick mechanics live in `useCombatTick`;
//  encounter scheduling in `useEncounterSchedule`.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CombatPhase } from "#/game/combat/constants";

export type { CombatPhase };
import { rollMonsterLevel } from "#/game/loot/drops";
import {
	applyMonsterMods,
	findMonster,
	type MonsterDefinition,
	type MonsterId,
	type MonsterModId,
	type MonsterRarity,
	modCountForRarity,
	rollMonsterMods,
	type ScaledMonsterStats,
	scaleMonsterStats,
} from "#/game/monsters";
import { applyOverlevelPenalty } from "#/game/progression/levels";
import type { ComputedCharacterStats } from "#/game/stats/types";
import type { ZoneEncounterPlan } from "#/game/world/encounter-schedule";
import type { RareNameSeed } from "#/game/world/i18n";
import {
	applyCharacterDelta,
	findCharacter,
} from "#/lib/optimistic-character";
import { pickRandom } from "#/lib/rng";
import { playMonsterDeathSfx } from "#/lib/sfx";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { type DamageEvent, useDamageEvents } from "./useDamageEvents";
import { useCombatTick } from "./useCombatTick";
import { useDelay } from "./useDelay";
import { useEncounterSchedule } from "./useEncounterSchedule";

type CombatState =
	| "searching"
	| "boss_intro"
	| "engaged"
	| "victory"
	| "miniboss_victory"
	| "acampamento";

function derivePhase(state: CombatState): CombatPhase {
	if (state === "searching") return "exploration";
	// Camp and post-miniboss share the 100% retention tier per
	// CONTEXT.md → Bag retention tiers ("Boss kill → 100%"). The
	// miniboss-victory panel pause is itself a safe banking moment: the
	// player either retreats with the full bag they just earned, or
	// continues hunting and gives up that safety until the next camp.
	if (state === "acampamento" || state === "miniboss_victory") return "camp";
	return "combat";
}

// Three-stage dramatic spawn for rare minibosses. The ticker stays paused
// (gated on state === "engaged") for the full intro, so the player can't
// pre-empt the build-up and the boss can't swing before its HP bar shows.
export type BossIntroStage = "sprite" | "name" | "hp" | null;

const BOSS_INTRO_STAGE_MS: Record<Exclude<BossIntroStage, null>, number> = {
	// Each value is how long the stage holds BEFORE advancing — so it must be
	// at least as long as the visual transition kicked off when the stage
	// becomes active. Sprite enters with scale 1.2 → 1.0 over ~700 ms, then
	// the nameplate fades + slides in over ~400 ms, then the HP bar.
	sprite: 750,
	name: 500,
	hp: 500,
};

export type Enemy = {
	def: MonsterDefinition;
	currentHp: number;
	level: number;
	rarity: MonsterRarity;
	mods: readonly MonsterModId[];
	scaled: ScaledMonsterStats;
	// Seeds for the rare proper-name generator. Sampled once on spawn so the
	// rare's name stays stable across re-renders and locale switches.
	// Non-rare spawns still carry the field (unused) to keep the shape narrow.
	nameSeed: RareNameSeed;
};

export type { DamageEvent };

type Params = {
	characterId: Id<"characters">;
	// Character level — used for the optimistic XP popup so the on-screen
	// number matches what the server actually awards after the over-level
	// penalty.
	characterLevel: number;
	stats: ComputedCharacterStats;
	initialHp: number;
	// Live potion count from the character query. The hook does NOT keep a
	// local copy — drink + drop are both server-driven, and tracking the
	// number in two places lets concurrent mutations race ("drink ghost"
	// bug where a drop arrived during the drink and the local +1 from the
	// drop overwrote the optimistic -1 from the drink).
	potions: number;
	// Live ethereal-incense count from the character query. Same rationale
	// as `potions` — keep the source of truth on the server side so a kill's
	// optimistic drop can't race the consume.
	incense: number;
	monsterPool: readonly MonsterId[];
	zoneLevel: number;
	encounterPlan: ZoneEncounterPlan;
	active: boolean;
	onPlayerDeath: () => void;
};

// Drives flavor-text selection in the camp cinematic — re-exported here so
// existing imports keep working; the canonical declaration lives in
// `#/game/world/types` because the i18n helper there also reads it.
import type { CampSource } from "#/game/world";
export type { CampSource };

const VICTORY_DELAY_MS = 800;

export function useCombatLoop({
	characterId,
	characterLevel,
	stats,
	initialHp,
	potions,
	incense,
	monsterPool,
	zoneLevel,
	encounterPlan,
	active,
	onPlayerDeath,
}: Params) {
	const [state, setState] = useState<CombatState>("searching");
	const [bossIntroStage, setBossIntroStage] = useState<BossIntroStage>(null);
	const [enemy, setEnemy] = useState<Enemy | null>(null);
	// Set true when the player triggers incenso during "engaged" — the
	// post-victory transition reads this and routes to camp instead of
	// the next spawn. Cleared on activation reset and on consumption.
	const pendingIncenseRef = useRef(false);
	const [lastKill, setLastKill] = useState<{
		xp: number;
		potion: boolean;
	} | null>(null);
	const { events, push: pushEvent } = useDamageEvents();

	// Read by the victory-delay handler — state and lastKill have already been
	// reset by then, so we can't recover the rarity from them.
	const lastKillWasMinibossRef = useRef(false);

	// Refs the interval callbacks read directly for mid-tick state visibility.
	const stateRef = useRef(state);
	stateRef.current = state;
	const enemyRef = useRef<Enemy | null>(enemy);
	enemyRef.current = enemy;

	const schedule = useEncounterSchedule({
		active,
		encounterPlan,
		isSearching: state === "searching",
		postMinibossPauseRef: lastKillWasMinibossRef,
		onCampTriggered: () => {
			stateRef.current = "acampamento";
			setState("acampamento");
		},
	});

	const recordKill = useMutation(api.combat.recordKill);
	// Optimistic localStore patch keeps the incense counter in lockstep with
	// the mutation, so concurrent recordKill drops can't race the consume.
	const consumeIncense = useMutation(
		api.combat.useEtherealIncense,
	).withOptimisticUpdate((localStore, args) => {
		const char = findCharacter(localStore, args.characterId);
		if (!char) return;
		applyCharacterDelta(localStore, args.characterId, {
			etherealIncense: Math.max(0, (char.etherealIncense ?? 0) - 1),
		});
	});

	const updateEnemyForTick = useCallback((next: Enemy) => {
		enemyRef.current = next;
		setEnemy(next);
	}, []);

	// Optimistic XP popup mounts immediately; potion drop is patched in once
	// the server replies. Shared between player-swing kills and thorns-reflect
	// kills. The penalty is applied client-side too so the popup matches what
	// the server will award (no mid-flight number swap).
	const resolveKill = useCallback(
		(killed: Enemy) => {
			const xpGained = applyOverlevelPenalty(
				killed.scaled.xpReward,
				characterLevel,
				killed.level,
			);
			stateRef.current = "victory";
			setLastKill({ xp: xpGained, potion: false });
			setState("victory");
			playMonsterDeathSfx(killed.def.id);
			lastKillWasMinibossRef.current = killed.rarity === "rare";
			if (killed.rarity === "rare") {
				schedule.resetForMiniboss();
			}
			recordKill({
				characterId,
				monsterId: killed.def.id,
				monsterLevel: killed.level,
				monsterRarity: killed.rarity,
			})
				.then((result) => {
					if (result.potionDropped) {
						setLastKill({ xp: xpGained, potion: true });
						// No local increment — character.potions is the source of
						// truth and the Convex query refreshes when recordKill
						// commits. Mirroring locally created a race with usePotion
						// (the +1 could overwrite the optimistic -1 from a drink).
					}
					// Incense drop follows the same pattern — `etherealIncense`
					// is the live query value, no local mirror.
				})
				.catch(() => {});
		},
		[characterId, characterLevel, recordKill, schedule.resetForMiniboss],
	);

	const { playerHp, barrier, usePotion } = useCombatTick({
		characterId,
		active,
		isEngaged: state === "engaged",
		enemy,
		stats,
		initialHp,
		potions,
		onPlayerDeath,
		resolveKill,
		pushEvent,
		updateEnemy: updateEnemyForTick,
	});

	// ── Activation transitions ──
	const activeRef = useRef(active);
	useEffect(() => {
		if (active && !activeRef.current) {
			pendingIncenseRef.current = false;
			enemyRef.current = null;
			setEnemy(null);
			setLastKill(null);
			setBossIntroStage(null);
			stateRef.current = "searching";
			setState("searching");
		}
		activeRef.current = active;
	}, [active]);

	// Player chose "Seguir em frente" on the camp modal. Resume the loop.
	const dismissCamp = useCallback(() => {
		if (stateRef.current !== "acampamento") return;
		stateRef.current = "searching";
		setState("searching");
	}, []);

	// Player activated Incenso Etéreo. The gameplay rules (see CONTEXT.md →
	// Active player input → Incenso Etéreo) gate this:
	//   - blocked during a rare-miniboss fight, boss intro, while already
	//     in camp, or during an active ambush pack (the button is also
	//     disabled in the HUD, but enforce here too so a keyboard shortcut
	//     can't bypass it);
	//   - immediate during "searching" / "victory" (next spawn skipped);
	//   - queued during "engaged" against a non-rare mob.
	const triggerIncense = useCallback(() => {
		if (incense <= 0) return;
		const s = stateRef.current;
		if (
			s === "boss_intro" ||
			s === "acampamento" ||
			s === "miniboss_victory"
		)
			return;
		if (s === "engaged" && enemyRef.current?.rarity === "rare") return;
		// Ambush packs commit you to the burst — incense must wait until the
		// last mob falls.
		if (schedule.isAmbushPackActive()) return;

		// The optimistic update on the mutation hook handles the
		// localStore decrement; we only need to swallow the rejection.
		consumeIncense({ characterId }).catch(() => {});

		if (s === "engaged") {
			// Let the current fight resolve. The victory branch reads this and
			// routes to acampamento instead of the next spawn.
			pendingIncenseRef.current = true;
			return;
		}
		// Searching / victory — interrupt the next spawn and enter camp now.
		// Cancels any in-flight ambush pack per CONTEXT.md → Incenso Etéreo
		// ("the remaining mobs in the ambush pack do NOT spawn").
		schedule.cancelAmbush();
		schedule.setCampSource("incense");
		stateRef.current = "acampamento";
		setState("acampamento");
	}, [
		characterId,
		consumeIncense,
		incense,
		schedule.isAmbushPackActive,
		schedule.cancelAmbush,
		schedule.setCampSource,
	]);

	// ── Search delay → spawn enemy ──
	useDelay(active && state === "searching", schedule.nextSpawnGapMs, () => {
		const pick = pickRandom(monsterPool);
		if (!pick) return;
		const def = findMonster(pick);
		if (!def) return;
		const level = rollMonsterLevel(zoneLevel);
		const baseScaled = scaleMonsterStats(def, level);
		// Slot consumption is a separate call (after commit below) so the
		// spawn-failure early returns above can't accidentally drain the pack.
		const rarity = schedule.rollSpawnRarity();
		const mods = rollMonsterMods(modCountForRarity(rarity));
		const scaled = applyMonsterMods(baseScaled, mods);
		const nameSeed: RareNameSeed = {
			primary: Math.random(),
			secondary: Math.random(),
			epithet: Math.random(),
		};
		const newEnemy: Enemy = {
			def,
			currentHp: scaled.hp,
			level,
			rarity,
			mods,
			scaled,
			nameSeed,
		};
		enemyRef.current = newEnemy;
		setEnemy(newEnemy);
		schedule.consumeAmbushSlot();
		// Rare minibosses get a staged reveal (sprite → name → HP bar) before
		// combat starts. Regular spawns engage immediately.
		if (rarity === "rare") {
			setBossIntroStage("sprite");
			stateRef.current = "boss_intro";
			setState("boss_intro");
		} else {
			setBossIntroStage(null);
			stateRef.current = "engaged";
			setState("engaged");
		}
	});

	// ── Boss intro stages → cascade into engaged ──
	useDelay(
		active && state === "boss_intro" && bossIntroStage === "sprite",
		BOSS_INTRO_STAGE_MS.sprite,
		() => setBossIntroStage("name"),
	);
	useDelay(
		active && state === "boss_intro" && bossIntroStage === "name",
		BOSS_INTRO_STAGE_MS.name,
		() => setBossIntroStage("hp"),
	);
	useDelay(
		active && state === "boss_intro" && bossIntroStage === "hp",
		BOSS_INTRO_STAGE_MS.hp,
		() => {
			setBossIntroStage(null);
			stateRef.current = "engaged";
			setState("engaged");
		},
	);

	// ── Victory pause → back to searching (or pause for miniboss modal) ──
	useDelay(active && state === "victory", VICTORY_DELAY_MS, () => {
		enemyRef.current = null;
		setEnemy(null);
		setLastKill(null);
		if (lastKillWasMinibossRef.current) {
			lastKillWasMinibossRef.current = false;
			stateRef.current = "miniboss_victory";
			setState("miniboss_victory");
		} else if (pendingIncenseRef.current) {
			// Incenso queued during the fight — enter camp instead of the next
			// spawn. Cancels any in-flight ambush pack so the remaining mobs
			// don't fire after dismissCamp (per CONTEXT.md → Incenso Etéreo).
			pendingIncenseRef.current = false;
			schedule.cancelAmbush();
			schedule.setCampSource("incense");
			stateRef.current = "acampamento";
			setState("acampamento");
		} else {
			setState("searching");
		}
	});

	// Retreat is handled by the existing active=false transition in the world view.
	const dismissMinibossModal = useCallback(() => {
		if (stateRef.current !== "miniboss_victory") return;
		stateRef.current = "searching";
		setState("searching");
	}, []);

	return {
		state,
		bossIntroStage,
		enemy,
		playerHp,
		barrier: {
			current: barrier.current,
			max: barrier.max,
			recoveryRemaining: barrier.recoveryRemaining,
		},
		potions,
		incense,
		campSource: schedule.campSource,
		ambushActive: schedule.ambushActive,
		events,
		lastKill,
		usePotion,
		triggerIncense,
		calmariaElapsedMs: schedule.calmariaElapsedMs,
		calmariaBudgetMs: schedule.calmariaBudgetMs,
		campThresholdsMs: schedule.campThresholdsMs,
		dismissMinibossModal,
		dismissCamp,
		phase: derivePhase(state),
	};
}
