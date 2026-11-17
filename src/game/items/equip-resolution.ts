import { SERVER_ERRORS } from "../../lib/server-errors";
import { findClassDefinition } from "../classes/data";
import { INVENTORY_MAX_SLOTS } from "../inventory/constants";
import { computeCharacterStats, unmetRequirement } from "../stats/compute";
import type { EquippedItem, EquippedSlot } from "../stats/types";
import { isBow, isQuiver, isWeapon, planEquip } from "./equipment";
import type { GeneratedItem } from "./types";

export interface EquippedEntry<Id> extends EquippedItem {
	id: Id;
}

export interface EquipCharacter {
	classId: string;
	level: number;
}

export type EquipResolution<Id> =
	| { ok: false; error: string }
	| {
			ok: true;
			displaced: EquippedEntry<Id>[];
			finalEquipped: EquippedItem[];
	  };

function requirementError(
	item: GeneratedItem,
	character: EquipCharacter,
	equippedWithoutItem: EquippedItem[],
): string | null {
	if (!item.requirements) return null;
	const stats = computeCharacterStats({
		classDef: findClassDefinition(character.classId),
		level: character.level,
		equippedItems: equippedWithoutItem,
	});
	return unmetRequirement(item, stats, character.level);
}

export function withoutIds<Id>(entries: EquippedEntry<Id>[]): EquippedItem[] {
	return entries.map(({ slot, item }) => ({ slot, item }));
}

export function resolveEquip<Id>(params: {
	character: EquipCharacter;
	item: GeneratedItem;
	targetSlot: EquippedSlot;
	equipped: EquippedEntry<Id>[];
	inventoryUsed: number;
}): EquipResolution<Id> {
	const plan = planEquip({
		item: params.item,
		targetSlot: params.targetSlot,
		currentEquipped: params.equipped,
	});
	if (plan.reject) return { ok: false, error: `Cannot equip: ${plan.reject}` };

	const displacedSlots = new Set(plan.displaced.map((d) => d.slot));
	const displaced = params.equipped.filter((e) => displacedSlots.has(e.slot));
	const kept = withoutIds(
		params.equipped.filter(
			(e) => e.slot !== params.targetSlot && !displacedSlots.has(e.slot),
		),
	);

	const unmet = requirementError(params.item, params.character, kept);
	if (unmet) return { ok: false, error: unmet };

	if (params.inventoryUsed - 1 + displaced.length > INVENTORY_MAX_SLOTS) {
		return { ok: false, error: "Inventory overflow — free a slot first" };
	}
	return {
		ok: true,
		displaced,
		finalEquipped: [...kept, { slot: params.targetSlot, item: params.item }],
	};
}

export type UnequipResolution<Id> =
	| { ok: false; error: string }
	| {
			ok: true;
			toInventory: EquippedEntry<Id>[];
			promoted: EquippedEntry<Id> | null;
			finalEquipped: EquippedItem[];
	  };

export function resolveUnequip<Id>(params: {
	slot: EquippedSlot;
	equipped: EquippedEntry<Id>[];
	inventoryUsed: number;
}): UnequipResolution<Id> {
	const item = params.equipped.find((e) => e.slot === params.slot);
	if (!item) return { ok: false, error: SERVER_ERRORS.slotEmpty };
	const offhand = params.equipped.find((e) => e.slot === "offhand");

	const orphanQuiver =
		params.slot === "weapon" &&
		isBow(item.item) &&
		offhand &&
		isQuiver(offhand.item)
			? offhand
			: null;
	const promoted =
		params.slot === "weapon" &&
		!orphanQuiver &&
		offhand &&
		isWeapon(offhand.item)
			? offhand
			: null;

	const toInventory = orphanQuiver ? [item, orphanQuiver] : [item];
	if (params.inventoryUsed + toInventory.length > INVENTORY_MAX_SLOTS) {
		return { ok: false, error: "Inventory full — free a slot first" };
	}

	const leaving = new Set(toInventory);
	const finalEquipped: EquippedItem[] = params.equipped.flatMap((e) => {
		if (leaving.has(e)) return [];
		if (e === promoted) return [{ slot: "weapon" as const, item: e.item }];
		return [{ slot: e.slot, item: e.item }];
	});
	return { ok: true, toInventory, promoted, finalEquipped };
}
