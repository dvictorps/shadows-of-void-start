import type { MonsterRarity } from "../monsters";
import type { CombatState } from "./types";

const INCENSE_BLOCKED_STATES: ReadonlySet<CombatState> = new Set([
	"rare_intro",
	"boss_intro",
	"acampamento",
	"miniboss_victory",
]);

export function canLightIncense({
	incense,
	state,
	enemyRarity,
	isBossNode,
	ambushActive,
}: {
	incense: number;
	state: CombatState;
	enemyRarity: MonsterRarity | undefined;
	isBossNode: boolean;
	ambushActive: boolean;
}): boolean {
	if (incense <= 0 || isBossNode || ambushActive) return false;
	if (INCENSE_BLOCKED_STATES.has(state)) return false;
	const fightingElite = enemyRarity === "rare" || enemyRarity === "unique";
	return !(state === "engaged" && fightingElite);
}
