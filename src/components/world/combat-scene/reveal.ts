import type {
	BossIntroStage,
	Enemy,
	RareIntroStage,
} from "#/hooks/useCombatLoop";

/** The combat loop's states, as the scene renders them. */
export type CombatSceneState =
	| "searching"
	| "rare_intro"
	| "boss_intro"
	| "engaged"
	| "victory"
	| "miniboss_victory"
	| "acampamento";

export type IntroStages = {
	state: CombatSceneState;
	rareIntroStage: RareIntroStage;
	bossIntroStage: BossIntroStage;
};

/** Rares and bosses get the staged entrance and reveal with no stagger. */
export function isStagedEnemy(enemy: Enemy | null): boolean {
	return enemy?.rarity === "rare" || enemy?.rarity === "unique";
}

// On victory the nameplate and the HP bar fade out alongside the sprite, so
// the exit mirrors the entrance instead of popping out when the enemy
// unmounts.
function isVictory(state: CombatSceneState): boolean {
	return state === "victory" || state === "miniboss_victory";
}

// Staged reveal for rare minibosses (3 beats: sprite → name → hp) and bosses
// (4 beats: an "impact" beat between sprite and name for sfx + screenshake).
export function nameplateVisible({
	state,
	rareIntroStage,
	bossIntroStage,
}: IntroStages): boolean {
	if (isVictory(state)) return false;
	if (state === "rare_intro") return rareIntroStage !== "sprite";
	if (state === "boss_intro") {
		return bossIntroStage !== "sprite" && bossIntroStage !== "impact";
	}
	return true;
}

export function hpBarVisible({
	state,
	rareIntroStage,
	bossIntroStage,
}: IntroStages): boolean {
	if (isVictory(state)) return false;
	if (state === "rare_intro") return rareIntroStage === "hp";
	if (state === "boss_intro") return bossIntroStage === "hp";
	return true;
}
