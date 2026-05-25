import { pickRandom, pickWeighted, randInt } from "../../lib/rng";
import type { EquipmentTemplate } from "../items/data/templates";
import { EQUIPMENT_TEMPLATES } from "../items/data/templates";
import { generateItem } from "../items/generator";
import type { GeneratedItem, ItemRarity } from "../items/types";
import type { EquipmentType } from "../items/types/base";
import type { MonsterRarity } from "../monsters/types";

const ELIGIBLE_EQUIPMENT_TYPES: EquipmentType[] = [
	"weapon",
	"helmet",
	"chestplate",
	"boots",
	"gloves",
	"offhand",
	"tome",
	"quiver",
	"ring",
	"amulet",
	"belt",
];

// Drop probabilities & rarity distributions per mob rarity, mirroring the
// CONTEXT.md Act 1 baseline table.
const DROP_TABLE: Record<
	MonsterRarity,
	{
		dropChance: number;
		rarity: Array<{ rarity: ItemRarity; weight: number }>;
	}
> = {
	normal: {
		dropChance: 0.3,
		rarity: [
			{ rarity: "normal", weight: 70 },
			{ rarity: "magic", weight: 25 },
			{ rarity: "rare", weight: 5 },
		],
	},
	magic: {
		dropChance: 0.6,
		rarity: [
			{ rarity: "normal", weight: 40 },
			{ rarity: "magic", weight: 50 },
			{ rarity: "rare", weight: 10 },
		],
	},
	rare: {
		// Minibosses always drop; the guarantee handling lives on the caller.
		dropChance: 1,
		rarity: [
			{ rarity: "normal", weight: 30 },
			{ rarity: "magic", weight: 55 },
			{ rarity: "rare", weight: 15 },
		],
	},
	unique: {
		// Act-boss distribution per CONTEXT.md → Drop rates. The guarantee
		// handling + multi-item rolling live on the caller (`rollBossDrops`).
		// No Normal entries — boss loot floor is Magic.
		dropChance: 1,
		rarity: [
			{ rarity: "magic", weight: 25 },
			{ rarity: "rare", weight: 75 },
		],
	},
};

function pickRarity(distribution: { rarity: ItemRarity; weight: number }[]) {
	return (
		pickWeighted(distribution, (e) => e.weight)?.rarity ??
		distribution[distribution.length - 1].rarity
	);
}

function templatesForType(
	equipmentType: EquipmentType,
	itemLevel: number,
): EquipmentTemplate[] {
	return EQUIPMENT_TEMPLATES.filter(
		(t) => t.equipmentType === equipmentType && t.dropLevel <= itemLevel,
	);
}

export interface RollDropParams {
	monsterRarity: MonsterRarity;
	monsterLevel: number;
}

/**
 * Rolls a single item at a forced rarity. Used for guaranteed-rarity slots
 * (e.g., the miniboss's guaranteed Rare). Skips the drop-chance gate.
 */
function rollItemAtRarity(
	rarity: ItemRarity,
	monsterLevel: number,
): GeneratedItem | null {
	const equipmentType = pickRandom(ELIGIBLE_EQUIPMENT_TYPES);
	if (!equipmentType) return null;

	// Hand control of weapon-subtype and armor-base to the template list: pick
	// any template of the right equipment type whose dropLevel allows it at
	// this ilvl. Weapon subtype variety and armor-base diversity emerge for
	// free from the existing template pool.
	let candidates = templatesForType(equipmentType, monsterLevel);
	if (candidates.length === 0) {
		// Fallback — no template eligible at this level for this type. Try any
		// template of the same type ignoring dropLevel; if still none, bail.
		candidates = EQUIPMENT_TEMPLATES.filter(
			(t) => t.equipmentType === equipmentType,
		);
		if (candidates.length === 0) return null;
	}
	const template = pickRandom(candidates);
	if (!template) return null;
	return generateItem({
		rarity,
		itemLevel: monsterLevel,
		templateId: template.id,
	});
}

/**
 * Rolls a single drop for a monster kill. Returns null when nothing drops.
 * For mobs that drop multiple items (minibosses, act bosses), use the
 * dedicated `rollMinibossDrops` instead.
 */
export function rollDrop(params: RollDropParams): GeneratedItem | null {
	const table = DROP_TABLE[params.monsterRarity];
	if (Math.random() > table.dropChance) return null;
	const rarity = pickRarity(table.rarity);
	return rollItemAtRarity(rarity, params.monsterLevel);
}

/**
 * Rolls the miniboss drop set per CONTEXT.md → Loot Pipeline → Drop rates:
 * two items, one guaranteed Rare and one rolled via the rare-tier table
 * (30 Normal / 55 Magic / 15 Rare).
 */
export function rollMinibossDrops(params: {
	monsterLevel: number;
}): GeneratedItem[] {
	const drops: GeneratedItem[] = [];
	const guaranteed = rollItemAtRarity("rare", params.monsterLevel);
	if (guaranteed) drops.push(guaranteed);
	const second = rollDrop({
		monsterRarity: "rare",
		monsterLevel: params.monsterLevel,
	});
	if (second) drops.push(second);
	return drops;
}

/**
 * Resolves a monster's instance level from the zone level — uniformly rolls
 * one of zoneLevel-1, zoneLevel, zoneLevel+1, floored at 1.
 */
export function rollMonsterLevel(zoneLevel: number): number {
	return Math.max(1, zoneLevel + randInt(-1, 1));
}

// Suppress unused-export linter for the EquipmentType import when only used in types.
export type { EquipmentType };
