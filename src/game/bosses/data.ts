import type { MonsterRarity } from "../monsters/types";
import { hasOwnKey } from "../typed-object";
import { GRALFOR } from "./gralfor";
import type { BossConfig, BossId } from "./types";

export const BOSSES = {
	gralfor: GRALFOR,
} satisfies Record<BossId, BossConfig>;

export function findBoss(id: string): BossConfig | null {
	return hasOwnKey(BOSSES, id) ? BOSSES[id] : null;
}

export function getBossConfig(enemy: {
	def: { id: string };
	rarity: MonsterRarity;
}): BossConfig | null {
	if (enemy.rarity !== "unique") return null;
	return findBoss(enemy.def.id);
}
