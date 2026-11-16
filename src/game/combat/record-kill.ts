import { defaultRng, type Rng } from "#/lib/rng";

import { findBoss } from "../bosses/data";
import type { BossId } from "../bosses/types";
import type { GeneratedItem } from "../items/types";
import { rollBossDrops, rollDrop, rollMinibossDrops } from "../loot/drops";
import { findMonster } from "../monsters/data";
import { scaleMonsterStats } from "../monsters/scaling";
import type { MonsterRarity } from "../monsters/types";
import { applyXpGain, type XpGainResult } from "../progression/levels";
import type { StatCache } from "../stats/cache";
import {
	DEFAULT_ENCOUNTER_PLAN,
	rollCampThresholdsMs,
} from "../world/encounter-schedule";
import { ACT_1, findNode } from "../world/index";
import {
	ETHEREAL_INCENSE_DROP_CHANCE,
	MAX_POTIONS,
	POTION_DROP_CHANCE,
} from "./constants";
import { classifyKill, resolveZoneProgress, tallyBossKill } from "./kill";

// The whole `combat.recordKill` decision: XP and level-ups, zone progress and
// camp tier, boss tallies, potion / incense rolls and the drops. The
// procedure resolves the monster first (`resolveKillTarget`), recomputes the
// stat cache only when the XP gain levels the character up, then calls
// `resolveKill` and writes the result as one UPDATE.

export interface KillTarget {
	templateId: string;
	monsterLevel: number;
	xpReward: number;
}

export function resolveKillTarget(
	monsterId: string,
	clientMonsterLevel: number,
): KillTarget | null {
	const template = findMonster(monsterId) ?? findBoss(monsterId)?.template;
	if (!template) return null;
	// The client-rolled level and rarity are still trusted (threat #1).
	const monsterLevel = Math.max(1, Math.floor(clientMonsterLevel));
	return {
		templateId: template.id,
		monsterLevel,
		xpReward: scaleMonsterStats(template, monsterLevel).xpReward,
	};
}

export interface KillCharacter {
	level: number;
	xp: number;
	currentLocation: string;
	currentZoneSession: string | null;
	currentZoneKills: number;
	inCamp: boolean;
	potions: number;
	etherealIncense: number;
	completedZones: string[];
	bossKillCounts: Partial<Record<BossId, number>>;
	totalBossKills: number;
	cachedMagicFind: number;
}

/** Columns of `characters` a kill changes. Absent keys are left untouched. */
export interface KillUpdate {
	level?: number;
	xp: number;
	hpCurrent?: number;
	barrierCurrent?: number;
	currentZoneKills: number;
	inCamp?: boolean;
	campThresholdsMs?: number[];
	zoneStartedAt?: number;
	lastCampIndex?: null;
	completedZones?: string[];
	bossKillCounts?: Partial<Record<BossId, number>>;
	totalBossKills?: number;
	potions?: number;
	etherealIncense?: number;
	cachedMaxLife?: number;
	cachedMaxBarrier?: number;
	cachedMagicFind?: number;
	cachedMovementSpeed?: number;
}

export interface KillOutcome {
	update: KillUpdate;
	drops: GeneratedItem[];
	xpGained: number;
	levelsGained: number;
	potionDropped: boolean;
	incenseDropped: boolean;
	newMaxLife: number | undefined;
	newMaxBarrier: number | undefined;
}

/** XP gain alone, so the procedure knows whether to load the equipped set. */
export function resolveKillXp(
	character: Pick<KillCharacter, "level" | "xp">,
	target: KillTarget,
): XpGainResult {
	return applyXpGain(character.level, character.xp, target.xpReward);
}

export function resolveKill(params: {
	character: KillCharacter;
	monsterId: string;
	monsterRarity: MonsterRarity;
	target: KillTarget;
	/** From `resolveKillXp`, which the caller ran to decide on `levelUpStats`. */
	gain: XpGainResult;
	/** Stats at the new level; only when the kill levels the character up. */
	levelUpStats: StatCache | null;
	now: number;
	/** The potion, incense and item rolls; tests pass `seededRng(seed)`. */
	rng?: Rng;
}): KillOutcome {
	const { character, target, gain, levelUpStats } = params;
	const rng = params.rng ?? defaultRng;

	const zone = findNode(ACT_1, character.currentLocation);
	const kill = classifyKill(params.monsterRarity, zone?.kind);
	const progress = resolveZoneProgress({
		grantsCampTier: kill.grantsCampTier,
		zoneKind: zone?.kind,
		prevZoneKills: character.currentZoneKills,
		prevInCamp: character.inCamp,
	});
	const update: KillUpdate = {
		xp: gain.xp,
		currentZoneKills: progress.currentZoneKills,
	};
	if (gain.level !== character.level) update.level = gain.level;
	if (progress.inCamp !== undefined) update.inCamp = progress.inCamp;

	let magicFind = character.cachedMagicFind;
	if (levelUpStats) {
		Object.assign(update, levelUpStats);
		update.hpCurrent = levelUpStats.cachedMaxLife;
		update.barrierCurrent = levelUpStats.cachedMaxBarrier;
		magicFind = levelUpStats.cachedMagicFind;
	}

	if (kill.grantsCampTier) {
		if (!character.completedZones.includes(character.currentLocation)) {
			update.completedZones = [
				...character.completedZones,
				character.currentLocation,
			];
		}
		if (progress.resetCampSchedule && zone) {
			update.campThresholdsMs = rollCampThresholdsMs(
				zone.encounterPlan ?? DEFAULT_ENCOUNTER_PLAN,
				rng,
			);
			update.zoneStartedAt = params.now;
			update.lastCampIndex = null;
		}
		if (kill.isBossKill) {
			const tally = tallyBossKill(
				params.monsterId,
				character.bossKillCounts,
				character.totalBossKills,
			);
			update.bossKillCounts = tally.bossKillCounts;
			update.totalBossKills = tally.totalBossKills;
		}
	}

	const potionDropped =
		character.potions < MAX_POTIONS && rng.unit() < POTION_DROP_CHANCE;
	if (potionDropped) update.potions = character.potions + 1;
	const incenseDropped = rng.unit() < ETHEREAL_INCENSE_DROP_CHANCE;
	if (incenseDropped) update.etherealIncense = character.etherealIncense + 1;

	// Drops only exist inside a zone visit: they go to its bag.
	const drops = character.currentZoneSession
		? rollKillDrops(
				kill.dropTable,
				params.monsterRarity,
				target.monsterLevel,
				magicFind,
				rng,
			)
		: [];

	return {
		update,
		drops,
		xpGained: target.xpReward,
		levelsGained: gain.levelsGained,
		potionDropped,
		incenseDropped,
		newMaxLife: levelUpStats?.cachedMaxLife,
		newMaxBarrier: levelUpStats?.cachedMaxBarrier,
	};
}

function rollKillDrops(
	table: ReturnType<typeof classifyKill>["dropTable"],
	monsterRarity: MonsterRarity,
	monsterLevel: number,
	magicFind: number,
	rng: Rng,
): GeneratedItem[] {
	if (table === "boss") return rollBossDrops({ monsterLevel, magicFind }, rng);
	if (table === "miniboss")
		return rollMinibossDrops({ monsterLevel, magicFind }, rng);
	const drop = rollDrop({ monsterRarity, monsterLevel, magicFind }, rng);
	return drop ? [drop] : [];
}
