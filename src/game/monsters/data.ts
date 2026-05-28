import type { MonsterDefinition } from "./types";

export const MONSTERS = {
	// Early-zone monsters (lvl 1-4): physical softened, elemental stripped.
	// Fresh lvl 1 characters have no resistances or mitigation. Cripta-onward
	// monsters keep their original templates.
	goblin: {
		id: "goblin",
		name: "Goblin",
		sprite: "/assets/sprites/criaturas/goblin.png",
		baseStats: {
			hp: 30,
			attackSpeed: 1.2,
			physicalDamage: { min: 10, max: 14 },
			elementalDamage: [],
		},
		xpReward: 5,
		allowedRarities: ["normal"],
	},
	slime: {
		id: "slime",
		name: "Slime",
		sprite: "/assets/sprites/criaturas/slime.png",
		baseStats: {
			hp: 54,
			attackSpeed: 0.7,
			physicalDamage: { min: 5, max: 10 },
			elementalDamage: [],
		},
		xpReward: 8,
		allowedRarities: ["normal"],
	},
	macaco: {
		id: "macaco",
		name: "Macaco",
		sprite: "/assets/sprites/criaturas/macaco.png",
		baseStats: {
			hp: 18,
			attackSpeed: 1.8,
			physicalDamage: { min: 6, max: 9 },
			elementalDamage: [],
		},
		xpReward: 4,
		allowedRarities: ["normal"],
	},
	morcego: {
		id: "morcego",
		name: "Morcego",
		sprite: "/assets/sprites/criaturas/morcego.png",
		baseStats: {
			hp: 12,
			attackSpeed: 2.0,
			physicalDamage: { min: 5, max: 7 },
			elementalDamage: [],
		},
		xpReward: 4,
		allowedRarities: ["normal"],
	},
	serpente: {
		id: "serpente",
		name: "Serpente",
		sprite: "/assets/sprites/criaturas/serpente.png",
		baseStats: {
			hp: 24,
			attackSpeed: 1.4,
			physicalDamage: { min: 9, max: 12 },
			elementalDamage: [],
		},
		xpReward: 6,
		allowedRarities: ["normal"],
	},
	esqueleto: {
		id: "esqueleto",
		name: "Esqueleto",
		sprite: "/assets/sprites/criaturas/esqueleto.png",
		baseStats: {
			hp: 48,
			attackSpeed: 1.1,
			physicalDamage: { min: 14, max: 20 },
			elementalDamage: [{ element: "Cold", min: 3, max: 5 }],
		},
		xpReward: 6,
		allowedRarities: ["normal"],
	},
	esqueleto_armadurado: {
		id: "esqueleto_armadurado",
		name: "Esqueleto Armadurado",
		sprite: "/assets/sprites/criaturas/esqueletoArmadurado.png",
		baseStats: {
			hp: 66,
			attackSpeed: 0.9,
			physicalDamage: { min: 11, max: 15 },
			elementalDamage: [{ element: "Fire", min: 3, max: 5 }],
		},
		xpReward: 9,
		allowedRarities: ["normal"],
	},
	esqueleto_lanca: {
		id: "esqueleto_lanca",
		name: "Esqueleto Lanceiro",
		sprite: "/assets/sprites/criaturas/esqueletoLanca.png",
		baseStats: {
			hp: 42,
			attackSpeed: 0.8,
			physicalDamage: { min: 20, max: 27 },
			elementalDamage: [{ element: "Lightning", min: 3, max: 5 }],
		},
		xpReward: 10,
		allowedRarities: ["normal"],
	},
	zumbi: {
		id: "zumbi",
		name: "Zumbi",
		sprite: "/assets/sprites/criaturas/zumbi.png",
		baseStats: {
			hp: 36,
			attackSpeed: 0.8,
			physicalDamage: { min: 7, max: 12 },
			elementalDamage: [],
		},
		xpReward: 7,
		allowedRarities: ["normal"],
	},
	vampiro: {
		id: "vampiro",
		name: "Vampiro",
		sprite: "/assets/sprites/criaturas/vampiro.png",
		baseStats: {
			hp: 60,
			attackSpeed: 1.0,
			physicalDamage: { min: 12, max: 18 },
			elementalDamage: [{ element: "Cold", min: 6, max: 9 }],
		},
		xpReward: 12,
		allowedRarities: ["normal"],
	},
	lich: {
		id: "lich",
		name: "Lich",
		sprite: "/assets/sprites/criaturas/lich.png",
		baseStats: {
			hp: 48,
			attackSpeed: 0.9,
			physicalDamage: { min: 0, max: 0 },
			elementalDamage: [{ element: "Cold", min: 18, max: 24 }],
		},
		xpReward: 14,
		allowedRarities: ["normal"],
	},
	olho_do_vazio: {
		id: "olho_do_vazio",
		name: "Olho do Vazio",
		sprite: "/assets/sprites/criaturas/olhodovazio.png",
		baseStats: {
			hp: 60,
			attackSpeed: 1.0,
			physicalDamage: { min: 0, max: 0 },
			elementalDamage: [{ element: "Void", min: 17, max: 23 }],
		},
		xpReward: 15,
		allowedRarities: ["normal"],
	},
	criatura_do_vazio: {
		id: "criatura_do_vazio",
		name: "Criatura do Vazio",
		sprite: "/assets/sprites/criaturas/criaturaVazio.png",
		baseStats: {
			hp: 90,
			attackSpeed: 0.9,
			physicalDamage: { min: 9, max: 14 },
			elementalDamage: [{ element: "Void", min: 8, max: 12 }],
		},
		xpReward: 13,
		allowedRarities: ["normal"],
	},
} as const satisfies Record<string, MonsterDefinition>;

export type MonsterId = keyof typeof MONSTERS;

function isMonsterId(id: string): id is MonsterId {
	return Object.hasOwn(MONSTERS, id);
}

/**
 * Safe lookup for a monster id that may have come from persisted data or a
 * zone's pool. Returns null when the id is unknown.
 */
export function findMonster(id: string): MonsterDefinition | null {
	return isMonsterId(id) ? MONSTERS[id] : null;
}
