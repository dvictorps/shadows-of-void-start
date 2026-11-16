import { findClassDefinition } from "../classes/data";
import { computeCharacterStats } from "./compute";
import type { EquippedItem, SelectableElement } from "./types";

// The four stats the server caches on the character row so the hot
// procedures (recordKill, syncHp, potions, travel) skip the stat engine.
// Refreshed on create, equip / unequip and level-up. Field names match the
// `characters` columns, so the result spreads straight into an update.
export interface StatCache {
	cachedMaxLife: number;
	cachedMaxBarrier: number;
	cachedMagicFind: number;
	cachedMovementSpeed: number;
}

export interface StatCacheSource {
	classId: string;
	level: number;
	selectedElement: SelectableElement | null;
}

export function computeStatCache(
	character: StatCacheSource,
	equippedItems: EquippedItem[],
): StatCache {
	const stats = computeCharacterStats({
		classDef: findClassDefinition(character.classId),
		level: character.level,
		equippedItems,
		selectedElement: character.selectedElement ?? undefined,
	});
	return {
		cachedMaxLife: stats.maxLife,
		cachedMaxBarrier: stats.maxBarrier,
		cachedMagicFind: stats.magicFind,
		cachedMovementSpeed: stats.movementSpeed,
	};
}
