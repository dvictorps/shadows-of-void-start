import type { GeneratedItem } from "#/game/items/types";
import type { EquippedSlot } from "#/game/stats/types";
import type { ItemRow } from "#/lib/api-types";

export function makeItem(
	name: string,
	overrides: Partial<GeneratedItem> & Pick<GeneratedItem, "equipmentType">,
): GeneratedItem {
	return {
		id: `item-${name}`,
		templateId: name,
		rarity: "normal",
		itemLevel: 1,
		baseStats: {},
		implicits: [],
		explicits: [],
		...overrides,
	};
}

export const sword = (name = "Test Sword") =>
	makeItem(name, { equipmentType: "weapon", weaponType: "sword" });
export const dagger = (name = "Test Dagger") =>
	makeItem(name, { equipmentType: "weapon", weaponType: "dagger" });
export const wand = (name = "Test Wand") =>
	makeItem(name, { equipmentType: "weapon", weaponType: "wand" });
export const greatsword = (name = "Test Greatsword") =>
	makeItem(name, { equipmentType: "weapon", weaponType: "greatsword" });
export const bow = (name = "Test Bow") =>
	makeItem(name, { equipmentType: "weapon", weaponType: "bow" });
export const shield = (name = "Test Shield") =>
	makeItem(name, { equipmentType: "offhand" });
export const tome = (name = "Test Tome") =>
	makeItem(name, { equipmentType: "tome" });
export const quiver = (name = "Test Quiver") =>
	makeItem(name, { equipmentType: "quiver" });
export const ring = (name = "Test Ring") =>
	makeItem(name, { equipmentType: "ring" });
export const helmet = (name = "Test Helmet") =>
	makeItem(name, { equipmentType: "helmet" });
export const amulet = (name = "Test Amulet") =>
	makeItem(name, { equipmentType: "amulet" });

export const CHARACTER_ID = 7;

function baseRow(id: number, data: GeneratedItem): ItemRow {
	return {
		id,
		authUserId: "user-1",
		locationKind: "inventory",
		characterId: CHARACTER_ID,
		equippedSlot: null,
		inventorySlot: null,
		stashMode: null,
		stashSlot: null,
		data,
		droppedAt: 0,
		droppedFrom: null,
		droppedFromLevel: null,
	};
}

export function inventoryRow(
	id: number,
	data: GeneratedItem,
	inventorySlot: number,
): ItemRow {
	return { ...baseRow(id, data), inventorySlot };
}

export function stashRow(
	id: number,
	data: GeneratedItem,
	stashSlot: number,
): ItemRow {
	return {
		...baseRow(id, data),
		locationKind: "stash",
		characterId: null,
		stashMode: "softcore",
		stashSlot,
	};
}

export function equippedRow(
	id: number,
	data: GeneratedItem,
	slot: EquippedSlot,
): ItemRow {
	return { ...baseRow(id, data), locationKind: "equipped", equippedSlot: slot };
}
