import {
	chance,
	defaultRng,
	pickRandom,
	pickWeighted,
	randInt,
	type Rng,
} from "../../lib/rng";
import type { EquipmentTemplate } from "../items/data/templates";
import { EQUIPMENT_TEMPLATES } from "../items/data/templates";
import { generateItem } from "../items/generator";
import type { GeneratedItem, ItemRarity } from "../items/types";
import type { EquipmentType } from "../items/types/base";
import type { MonsterRarity } from "../monsters/types";

const DROP_TYPE_WEIGHTS: Array<{ type: EquipmentType; weight: number }> = [
	{ type: "weapon", weight: 3 },
	{ type: "helmet", weight: 1 },
	{ type: "chestplate", weight: 1 },
	{ type: "boots", weight: 1 },
	{ type: "gloves", weight: 1 },
	{ type: "offhand", weight: 1 },
	{ type: "tome", weight: 1 },
	{ type: "quiver", weight: 1 },
	{ type: "ring", weight: 1 },
	{ type: "amulet", weight: 1 },
	{ type: "belt", weight: 1 },
];

const DROP_TABLE = {
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
		dropChance: 1,
		rarity: [
			{ rarity: "normal", weight: 30 },
			{ rarity: "magic", weight: 55 },
			{ rarity: "rare", weight: 15 },
		],
	},
	unique: {
		dropChance: 1,
		rarity: [
			{ rarity: "magic", weight: 25 },
			{ rarity: "rare", weight: 75 },
		],
	},
} satisfies Record<
	MonsterRarity,
	{ dropChance: number; rarity: Array<{ rarity: ItemRarity; weight: number }> }
>;

const PROMOTION_CHAIN: ReadonlyMap<
	ItemRarity,
	{ next: ItemRarity; basePct: number }
> = new Map([
	["normal", { next: "magic", basePct: 10 }],
	["magic", { next: "rare", basePct: 5 }],
	["rare", { next: "legendary", basePct: 1 }],
	["legendary", { next: "epic", basePct: 1 }],
]);

export function promoteRarity(
	rarity: ItemRarity,
	magicFind: number,
	rng: Rng = defaultRng,
): ItemRarity {
	let current = rarity;
	let step = PROMOTION_CHAIN.get(current);
	while (step) {
		const promoteChance = (step.basePct / 100) * (1 + magicFind / 100);
		if (!chance(promoteChance, rng)) break;
		current = step.next;
		step = PROMOTION_CHAIN.get(current);
	}
	return current;
}

function pickRarity(
	distribution: { rarity: ItemRarity; weight: number }[],
	rng: Rng,
): ItemRarity {
	return (
		pickWeighted(distribution, (e) => e.weight, rng)?.rarity ??
		distribution.at(-1)?.rarity ??
		"normal"
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
	magicFind?: number;
}

function rollItemAtRarity(
	rarity: ItemRarity,
	monsterLevel: number,
	rng: Rng,
): GeneratedItem | null {
	const picked = pickWeighted(DROP_TYPE_WEIGHTS, (e) => e.weight, rng);
	if (!picked) return null;
	const equipmentType = picked.type;

	let candidates = templatesForType(equipmentType, monsterLevel);
	if (candidates.length === 0) {
		candidates = EQUIPMENT_TEMPLATES.filter(
			(t) => t.equipmentType === equipmentType,
		);
		if (candidates.length === 0) return null;
	}
	const template = pickRandom(candidates, rng);
	if (!template) return null;
	return generateItem(
		{ rarity, itemLevel: monsterLevel, templateId: template.id },
		rng,
	);
}

export function rollDrop(
	params: RollDropParams,
	rng: Rng = defaultRng,
): GeneratedItem | null {
	const table = DROP_TABLE[params.monsterRarity];
	if (!chance(table.dropChance, rng)) return null;
	const baseRarity = pickRarity(table.rarity, rng);
	const rarity = promoteRarity(baseRarity, params.magicFind ?? 0, rng);
	return rollItemAtRarity(rarity, params.monsterLevel, rng);
}

export function rollMinibossDrops(
	params: { monsterLevel: number; magicFind?: number },
	rng: Rng = defaultRng,
): GeneratedItem[] {
	const mf = params.magicFind ?? 0;
	const drops: GeneratedItem[] = [];
	const guaranteedRarity = promoteRarity("rare", mf, rng);
	const guaranteed = rollItemAtRarity(
		guaranteedRarity,
		params.monsterLevel,
		rng,
	);
	if (guaranteed) drops.push(guaranteed);
	const second = rollDrop(
		{ monsterRarity: "rare", monsterLevel: params.monsterLevel, magicFind: mf },
		rng,
	);
	if (second) drops.push(second);
	return drops;
}

export function rollBossDrops(
	params: { monsterLevel: number; magicFind?: number },
	rng: Rng = defaultRng,
): GeneratedItem[] {
	const mf = params.magicFind ?? 0;
	const drops: GeneratedItem[] = [];
	const guaranteedRarity = promoteRarity("rare", mf, rng);
	const guaranteed = rollItemAtRarity(
		guaranteedRarity,
		params.monsterLevel,
		rng,
	);
	if (guaranteed) drops.push(guaranteed);
	const extras = chance(0.5, rng) ? 1 : 2;
	for (let i = 0; i < extras; i++) {
		const rolled = rollDrop(
			{
				monsterRarity: "unique",
				monsterLevel: params.monsterLevel,
				magicFind: mf,
			},
			rng,
		);
		if (rolled) drops.push(rolled);
	}
	return drops;
}

export function rollMonsterLevel(
	zoneLevel: number,
	rng: Rng = defaultRng,
): number {
	return Math.max(1, zoneLevel + randInt(-1, 1, rng));
}

export type { EquipmentType };
