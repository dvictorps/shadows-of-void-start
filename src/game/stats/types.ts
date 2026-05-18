import type { CharacterClassDefinition } from "../classes/types";
import type { GeneratedItem } from "../items/types";

// ── Equipment slots ──
// Single source of truth — also drives the convex schema validator and the
// equip mutation arg union (see convex/characters.ts).

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

/**
 * Runtime narrower for Convex-returned `equippedSlot: string | undefined`.
 * Returns the value typed as EquippedSlot when it matches; undefined otherwise.
 */
export function narrowEquippedSlot(
	s: string | undefined,
): EquippedSlot | undefined {
	if (s === undefined || !EQUIPPED_SLOT_SET.has(s)) return undefined;
	return s as EquippedSlot;
}

export interface EquippedItem {
	slot: EquippedSlot;
	item: GeneratedItem;
}

// ── Stat engine inputs ──

export interface StatEngineInput {
	classDef: CharacterClassDefinition | null;
	level: number;
	equippedItems: EquippedItem[];
}

// ── Resistance + element keys ──

export const ELEMENTS = ["cold", "fire", "lightning", "void"] as const;
export type Element = (typeof ELEMENTS)[number];

// ── Combat path ──

export type CombatPath = "attack" | "spell" | "unarmed";

// ── Per-swing profile (one entry for main hand, one for off-hand when dual-wielding) ──

export interface SwingProfile {
	source: "mainHand" | "offHand";
	/**
	 * The item id that produces this swing — used by callers to surface broken
	 * state per-weapon and to pick local mods at hit time.
	 */
	itemId: string;
	/** Physical damage range from this weapon (already includes local mods). */
	physicalDamage: { min: number; max: number };
	/** Elemental flat damage entries baked into this weapon (attack: per element). */
	elementalDamage: Array<{ element: string; min: number; max: number }>;
	/** Crit chance from this weapon alone — global crit chance is added at hit time. */
	baseCritChance: number;
	/** Attack speed of this weapon (used to derive the combined tick rate). */
	baseAttackSpeed: number;
}

// ── Global modifier pools ──

export interface IncreasedPools {
	/** Sum of "+X% Physical Damage" mods that apply globally (not local). */
	physical: number;
	cold: number;
	fire: number;
	lightning: number;
	void: number;
	/** Sum that adds to every elemental type (applies on top of per-element). */
	elementalGlobal: number;
	/** Applies only to attack-path elemental damage. */
	elementalWithAttacks: number;
	/** Applies only to attack swings (melee/ranged attacks; not spells). */
	melee: number;
	/** Applies only to spell-path damage. */
	spell: number;
	/** Universal "+X% damage" — applies to every hit, both paths. */
	universal: number;
	attackSpeed: number;
	castSpeed: number;
	/** Crit chance modifier, applied multiplicatively on top of weapon's base. */
	criticalChance: number;
}

// ── Final computed stats ──

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
	/** Combined tick rate (sum of weapon speeds when dual-wielding). */
	tickRate: number;
	/** Swing profiles in tick alternation order. Length 1 = solo, 2 = dual-wield. */
	swings: SwingProfile[];

	increased: IncreasedPools;
	/** Sum of "+X% Critical Strike Multiplier" flat mods. Base multi is 50%. */
	bonusCritMultiplier: number;

	movementSpeed: number;
	lifeGainOnHit: number;
	manaGainOnHit: number;
	lifeOnKill: number;
	manaOnKill: number;
	lifeLeechPercent: number;
	magicFind: number;

	/** Ids of equipped items that failed the requirement check. */
	brokenItemIds: Set<string>;
}
