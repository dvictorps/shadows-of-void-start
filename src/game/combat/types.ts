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
	| "rare_intro"
	| "boss_intro"
	| "engaged"
	| "victory"
	| "miniboss_victory"
	| "acampamento";

export function derivePhase(state: CombatState): CombatPhase {
	if (state === "searching") return "exploration";
	if (state === "acampamento" || state === "miniboss_victory") return "camp";
	return "combat";
}

export type RareIntroStage = "sprite" | "name" | "hp" | null;

export const RARE_INTRO_STAGE_MS = {
	sprite: 750,
	name: 500,
	hp: 500,
} satisfies Record<Exclude<RareIntroStage, null>, number>;

export type BossIntroStage = "sprite" | "impact" | "name" | "hp" | null;

export const BOSS_INTRO_STAGE_MS_DEFAULT = {
	sprite: 900,
	impact: 600,
	name: 500,
	hp: 400,
} satisfies Record<Exclude<BossIntroStage, null>, number>;

export type Enemy = {
	def: MonsterDefinition;
	currentHp: number;
	currentBarrier: number;
	level: number;
	rarity: MonsterRarity;
	mods: readonly MonsterModId[];
	scaled: ScaledMonsterStats;
	nameSeed: RareNameSeed;
};
