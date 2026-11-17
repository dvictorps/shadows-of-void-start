import type {
	BossIntroStage,
	Enemy,
	RareIntroStage,
} from "#/hooks/useCombatLoop";

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

export function isStagedEnemy(enemy: Enemy | null): boolean {
	return enemy?.rarity === "rare" || enemy?.rarity === "unique";
}

function isVictory(state: CombatSceneState): boolean {
	return state === "victory" || state === "miniboss_victory";
}

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

export type ArenaView = "path" | "fight" | "camp";

export function arenaView(
	state: CombatSceneState,
	ambushActive: boolean,
): ArenaView {
	if (state === "acampamento") return "camp";
	if (state === "searching" && !ambushActive) return "path";
	return "fight";
}
