export { BOSSES, findBoss } from "./data";
export { GRALFOR } from "./gralfor";
export type {
	BossCinematicConfig,
	BossConfig,
	BossId,
	BossTemplate,
} from "./types";

import type { MonsterRarity } from "../monsters/types";
import { findBoss } from "./data";
import type { BossConfig, BossId } from "./types";

export function getBossConfig(enemy: {
	def: { id: string };
	rarity: MonsterRarity;
}): BossConfig | null {
	if (enemy.rarity !== "unique") return null;
	return findBoss(enemy.def.id as BossId);
}
