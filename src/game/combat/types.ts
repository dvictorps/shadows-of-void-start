// Combat state machine + enemy + boss-intro types shared between
// useCombatLoop, useCombatTick, and the scene/tooltip components. Lifted out
// of useCombatLoop so the tick hook (which imports `Enemy`) doesn't have to
// reach back into a sibling hook file via a type-only cyclic import.

import type {
	MonsterDefinition,
	MonsterModId,
	MonsterRarity,
	ScaledMonsterStats,
} from "../monsters";
import type { RareNameSeed } from "../world/i18n";
import type { CombatPhase } from "./constants";

export type CombatState =
	| "searching"
	| "boss_intro"
	| "engaged"
	| "victory"
	| "miniboss_victory"
	| "acampamento";

export function derivePhase(state: CombatState): CombatPhase {
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

export const BOSS_INTRO_STAGE_MS: Record<
	Exclude<BossIntroStage, null>,
	number
> = {
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
	// Live barrier value. Max lives on `scaled.barrier` (immutable per spawn).
	// 0 when the monster has no barrier mod. The barrier cooldown is internal
	// state owned by useCombatTick — only the live current value is exposed
	// here for UI rendering.
	currentBarrier: number;
	level: number;
	rarity: MonsterRarity;
	mods: readonly MonsterModId[];
	scaled: ScaledMonsterStats;
	// Seeds for the rare proper-name generator. Sampled once on spawn so the
	// rare's name stays stable across re-renders and locale switches.
	// Non-rare spawns still carry the field (unused) to keep the shape narrow.
	nameSeed: RareNameSeed;
};
