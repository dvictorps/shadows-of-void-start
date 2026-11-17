import type { CharacterClassDefinition } from "../classes/types";
import type { GeneratedItem } from "../items/types";

export const EQUIPPED_SLOTS = [
	"weapon",
	"offhand",
	"helmet",
	"chestplate",
	"boots",
	"gloves",
	"amulet",
	"belt",
	"ring1",
	"ring2",
] as const;

export type EquippedSlot = (typeof EQUIPPED_SLOTS)[number];

const EQUIPPED_SLOT_SET = new Set<string>(EQUIPPED_SLOTS);

function isEquippedSlot(s: string): s is EquippedSlot {
	return EQUIPPED_SLOT_SET.has(s);
}

export function narrowEquippedSlot(
	s: string | undefined,
): EquippedSlot | undefined {
	return s !== undefined && isEquippedSlot(s) ? s : undefined;
}

export interface EquippedItem {
	slot: EquippedSlot;
	item: GeneratedItem;
}

export interface StatEngineInput {
	classDef: CharacterClassDefinition | null;
	level: number;
	equippedItems: EquippedItem[];
	selectedElement?: SelectableElement;
}

export const SELECTABLE_ELEMENTS = ["fire", "cold", "lightning"] as const;
export type SelectableElement = (typeof SELECTABLE_ELEMENTS)[number];

export const ELEMENTS = ["cold", "fire", "lightning", "void"] as const;
export type Element = (typeof ELEMENTS)[number];

export type CombatPath = "attack" | "spell" | "unarmed";

export interface SwingProfile {
	source: "mainHand" | "offHand";
	itemId: string;
	weaponType: import("../items/types/base").WeaponType;
	physicalDamage: { min: number; max: number };
	elementalDamage: Array<{ element: string; min: number; max: number }>;
	baseCritChance: number;
	baseAttackSpeed: number;
}

export interface IncreasedPools {
	physical: number;
	cold: number;
	fire: number;
	lightning: number;
	void: number;
	elementalGlobal: number;
	elementalWithAttacks: number;
	melee: number;
	spell: number;
	attackSpeed: number;
	castSpeed: number;
	criticalChance: number;
}

export interface ComputedCharacterStats {
	attributes: { strength: number; dexterity: number; intelligence: number };

	maxLife: number;
	lifeRegen: number;
	maxMana: number;
	manaRegen: number;
	maxBarrier: number;

	armor: number;
	evasion: number;
	accuracy: number;
	blockChance: number;
	thorns: number;

	resistances: { cold: number; fire: number; lightning: number; void: number };

	path: CombatPath;
	tickRate: number;
	swings: SwingProfile[];

	increased: IncreasedPools;
	bonusCritMultiplier: number;

	movementSpeed: number;
	lifeGainOnHit: number;
	manaGainOnHit: number;
	lifeOnKill: number;
	manaOnKill: number;
	lifeLeechPercent: number;
	magicFind: number;

	gainAsExtraSpell: {
		cold: number;
		fire: number;
		lightning: number;
		void: number;
	};

	brokenItemIds: Set<string>;
}
