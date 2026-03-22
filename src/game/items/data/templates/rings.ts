import type { EquipmentTemplate } from "./types"

// ── Cobalt Ring (Cold Resistance) ──
const COBALT_RING_TEMPLATES: EquipmentTemplate[] = [
	{ id: "cobalt_ring_t1", name: "Cobalt Ring", equipmentType: "ring", dropLevel: 1, requirements: { level: 1 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Cold Resistance", minValue: 15, maxValue: 25 }] },
	{ id: "cobalt_ring_t2", name: "Cobalt Band", equipmentType: "ring", dropLevel: 12, requirements: { level: 12 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Cold Resistance", minValue: 18, maxValue: 28 }] },
	{ id: "cobalt_ring_t3", name: "Cobalt Signet", equipmentType: "ring", dropLevel: 24, requirements: { level: 24 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Cold Resistance", minValue: 21, maxValue: 32 }] },
	{ id: "cobalt_ring_t4", name: "Cobalt Loop", equipmentType: "ring", dropLevel: 36, requirements: { level: 36 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Cold Resistance", minValue: 24, maxValue: 36 }] },
	{ id: "cobalt_ring_t5", name: "Cobalt Circle", equipmentType: "ring", dropLevel: 48, requirements: { level: 48 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Cold Resistance", minValue: 27, maxValue: 40 }] },
	{ id: "cobalt_ring_t6", name: "Cobalt Seal", equipmentType: "ring", dropLevel: 60, requirements: { level: 60 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Cold Resistance", minValue: 30, maxValue: 44 }] },
	{ id: "cobalt_ring_t7", name: "Cobalt Crest", equipmentType: "ring", dropLevel: 72, requirements: { level: 72 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Cold Resistance", minValue: 34, maxValue: 48 }] },
	{ id: "cobalt_ring_t8", name: "Void-Cobalt Ring", equipmentType: "ring", dropLevel: 83, requirements: { level: 83 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Cold Resistance", minValue: 38, maxValue: 52 }] },
]

// ── Garnet Ring (Fire Resistance) ──
const GARNET_RING_TEMPLATES: EquipmentTemplate[] = [
	{ id: "garnet_ring_t1", name: "Garnet Ring", equipmentType: "ring", dropLevel: 1, requirements: { level: 1 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Fire Resistance", minValue: 15, maxValue: 25 }] },
	{ id: "garnet_ring_t2", name: "Garnet Band", equipmentType: "ring", dropLevel: 12, requirements: { level: 12 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Fire Resistance", minValue: 18, maxValue: 28 }] },
	{ id: "garnet_ring_t3", name: "Garnet Signet", equipmentType: "ring", dropLevel: 24, requirements: { level: 24 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Fire Resistance", minValue: 21, maxValue: 32 }] },
	{ id: "garnet_ring_t4", name: "Garnet Loop", equipmentType: "ring", dropLevel: 36, requirements: { level: 36 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Fire Resistance", minValue: 24, maxValue: 36 }] },
	{ id: "garnet_ring_t5", name: "Garnet Circle", equipmentType: "ring", dropLevel: 48, requirements: { level: 48 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Fire Resistance", minValue: 27, maxValue: 40 }] },
	{ id: "garnet_ring_t6", name: "Garnet Seal", equipmentType: "ring", dropLevel: 60, requirements: { level: 60 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Fire Resistance", minValue: 30, maxValue: 44 }] },
	{ id: "garnet_ring_t7", name: "Garnet Crest", equipmentType: "ring", dropLevel: 72, requirements: { level: 72 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Fire Resistance", minValue: 34, maxValue: 48 }] },
	{ id: "garnet_ring_t8", name: "Void-Garnet Ring", equipmentType: "ring", dropLevel: 83, requirements: { level: 83 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Fire Resistance", minValue: 38, maxValue: 52 }] },
]

// ── Topaz Ring (Lightning Resistance) ──
const TOPAZ_RING_TEMPLATES: EquipmentTemplate[] = [
	{ id: "topaz_ring_t1", name: "Topaz Ring", equipmentType: "ring", dropLevel: 1, requirements: { level: 1 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Lightning Resistance", minValue: 15, maxValue: 25 }] },
	{ id: "topaz_ring_t2", name: "Topaz Band", equipmentType: "ring", dropLevel: 12, requirements: { level: 12 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Lightning Resistance", minValue: 18, maxValue: 28 }] },
	{ id: "topaz_ring_t3", name: "Topaz Signet", equipmentType: "ring", dropLevel: 24, requirements: { level: 24 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Lightning Resistance", minValue: 21, maxValue: 32 }] },
	{ id: "topaz_ring_t4", name: "Topaz Loop", equipmentType: "ring", dropLevel: 36, requirements: { level: 36 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Lightning Resistance", minValue: 24, maxValue: 36 }] },
	{ id: "topaz_ring_t5", name: "Topaz Circle", equipmentType: "ring", dropLevel: 48, requirements: { level: 48 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Lightning Resistance", minValue: 27, maxValue: 40 }] },
	{ id: "topaz_ring_t6", name: "Topaz Seal", equipmentType: "ring", dropLevel: 60, requirements: { level: 60 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Lightning Resistance", minValue: 30, maxValue: 44 }] },
	{ id: "topaz_ring_t7", name: "Topaz Crest", equipmentType: "ring", dropLevel: 72, requirements: { level: 72 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Lightning Resistance", minValue: 34, maxValue: 48 }] },
	{ id: "topaz_ring_t8", name: "Void-Topaz Ring", equipmentType: "ring", dropLevel: 83, requirements: { level: 83 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Lightning Resistance", minValue: 38, maxValue: 52 }] },
]

// ── Obsidian Ring (Void Resistance) ──
const OBSIDIAN_RING_TEMPLATES: EquipmentTemplate[] = [
	{ id: "obsidian_ring_t1", name: "Obsidian Ring", equipmentType: "ring", dropLevel: 1, requirements: { level: 1 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Void Resistance", minValue: 15, maxValue: 25 }] },
	{ id: "obsidian_ring_t2", name: "Obsidian Band", equipmentType: "ring", dropLevel: 12, requirements: { level: 12 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Void Resistance", minValue: 18, maxValue: 28 }] },
	{ id: "obsidian_ring_t3", name: "Obsidian Signet", equipmentType: "ring", dropLevel: 24, requirements: { level: 24 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Void Resistance", minValue: 21, maxValue: 32 }] },
	{ id: "obsidian_ring_t4", name: "Obsidian Loop", equipmentType: "ring", dropLevel: 36, requirements: { level: 36 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Void Resistance", minValue: 24, maxValue: 36 }] },
	{ id: "obsidian_ring_t5", name: "Obsidian Circle", equipmentType: "ring", dropLevel: 48, requirements: { level: 48 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Void Resistance", minValue: 27, maxValue: 40 }] },
	{ id: "obsidian_ring_t6", name: "Obsidian Seal", equipmentType: "ring", dropLevel: 60, requirements: { level: 60 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Void Resistance", minValue: 30, maxValue: 44 }] },
	{ id: "obsidian_ring_t7", name: "Obsidian Crest", equipmentType: "ring", dropLevel: 72, requirements: { level: 72 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Void Resistance", minValue: 34, maxValue: 48 }] },
	{ id: "obsidian_ring_t8", name: "Void-Obsidian Ring", equipmentType: "ring", dropLevel: 83, requirements: { level: 83 }, baseStats: {}, implicits: [{ displayFormat: "+{value}% Void Resistance", minValue: 38, maxValue: 52 }] },
]

// ── Coral Ring (Maximum Life) ──
const CORAL_RING_TEMPLATES: EquipmentTemplate[] = [
	{ id: "coral_ring_t1", name: "Coral Ring", equipmentType: "ring", dropLevel: 1, requirements: { level: 1 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Life", minValue: 15, maxValue: 30 }] },
	{ id: "coral_ring_t2", name: "Coral Band", equipmentType: "ring", dropLevel: 12, requirements: { level: 12 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Life", minValue: 18, maxValue: 34 }] },
	{ id: "coral_ring_t3", name: "Coral Signet", equipmentType: "ring", dropLevel: 24, requirements: { level: 24 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Life", minValue: 22, maxValue: 38 }] },
	{ id: "coral_ring_t4", name: "Coral Loop", equipmentType: "ring", dropLevel: 36, requirements: { level: 36 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Life", minValue: 26, maxValue: 44 }] },
	{ id: "coral_ring_t5", name: "Coral Circle", equipmentType: "ring", dropLevel: 48, requirements: { level: 48 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Life", minValue: 30, maxValue: 50 }] },
	{ id: "coral_ring_t6", name: "Coral Seal", equipmentType: "ring", dropLevel: 60, requirements: { level: 60 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Life", minValue: 34, maxValue: 56 }] },
	{ id: "coral_ring_t7", name: "Coral Crest", equipmentType: "ring", dropLevel: 72, requirements: { level: 72 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Life", minValue: 38, maxValue: 64 }] },
	{ id: "coral_ring_t8", name: "Void-Coral Ring", equipmentType: "ring", dropLevel: 83, requirements: { level: 83 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Life", minValue: 40, maxValue: 70 }] },
]

// ── Lapis Ring (Maximum Mana) ──
const LAPIS_RING_TEMPLATES: EquipmentTemplate[] = [
	{ id: "lapis_ring_t1", name: "Lapis Ring", equipmentType: "ring", dropLevel: 1, requirements: { level: 1 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Mana", minValue: 15, maxValue: 30 }] },
	{ id: "lapis_ring_t2", name: "Lapis Band", equipmentType: "ring", dropLevel: 12, requirements: { level: 12 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Mana", minValue: 18, maxValue: 34 }] },
	{ id: "lapis_ring_t3", name: "Lapis Signet", equipmentType: "ring", dropLevel: 24, requirements: { level: 24 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Mana", minValue: 22, maxValue: 38 }] },
	{ id: "lapis_ring_t4", name: "Lapis Loop", equipmentType: "ring", dropLevel: 36, requirements: { level: 36 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Mana", minValue: 26, maxValue: 44 }] },
	{ id: "lapis_ring_t5", name: "Lapis Circle", equipmentType: "ring", dropLevel: 48, requirements: { level: 48 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Mana", minValue: 30, maxValue: 50 }] },
	{ id: "lapis_ring_t6", name: "Lapis Seal", equipmentType: "ring", dropLevel: 60, requirements: { level: 60 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Mana", minValue: 34, maxValue: 56 }] },
	{ id: "lapis_ring_t7", name: "Lapis Crest", equipmentType: "ring", dropLevel: 72, requirements: { level: 72 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Mana", minValue: 38, maxValue: 64 }] },
	{ id: "lapis_ring_t8", name: "Void-Lapis Ring", equipmentType: "ring", dropLevel: 83, requirements: { level: 83 }, baseStats: {}, implicits: [{ displayFormat: "+{value} to Maximum Mana", minValue: 40, maxValue: 70 }] },
]

export const RING_TEMPLATES: EquipmentTemplate[] = [
	...COBALT_RING_TEMPLATES,
	...GARNET_RING_TEMPLATES,
	...TOPAZ_RING_TEMPLATES,
	...OBSIDIAN_RING_TEMPLATES,
	...CORAL_RING_TEMPLATES,
	...LAPIS_RING_TEMPLATES,
]
