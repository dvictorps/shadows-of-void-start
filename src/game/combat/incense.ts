import type { MonsterRarity } from "../monsters";
import type { CombatState } from "./types";

// States in which lighting incense is meaningless or would cut a cinematic:
// the rare / boss intros, a camp already running, and the miniboss panel.
const INCENSE_BLOCKED_STATES: ReadonlySet<CombatState> = new Set([
	"rare_intro",
	"boss_intro",
	"acampamento",
	"miniboss_victory",
]);

/**
 * Whether the HUD may light an Incenso Etéreo right now. Never inside a boss
 * node, never against an engaged rare or unique, never during an ambush, and
 * never in the blocked states above. See CONTEXT.md → Incenso Etéreo.
 */
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
