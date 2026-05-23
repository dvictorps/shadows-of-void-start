import type { MonsterDefinition } from "./types";

export const MONSTERS = {
	goblin: {
		id: "goblin",
		name: "Goblin",
		sprite: "/assets/sprites/criaturas/goblin.png",
		baseStats: {
			hp: 20,
			attackSpeed: 1.2,
			physicalDamage: { min: 8, max: 12 },
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
			hp: 36,
			attackSpeed: 0.7,
			physicalDamage: { min: 4, max: 8 },
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
			hp: 12,
			attackSpeed: 1.8,
			physicalDamage: { min: 5, max: 7 },
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
			hp: 8,
			attackSpeed: 2.0,
			physicalDamage: { min: 4, max: 6 },
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
			hp: 16,
			attackSpeed: 1.4,
			physicalDamage: { min: 7, max: 10 },
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
			hp: 32,
			attackSpeed: 1.1,
			physicalDamage: { min: 9, max: 13 },
			elementalDamage: [],
		},
		xpReward: 6,
		allowedRarities: ["normal"],
	},
	esqueleto_armadurado: {
		id: "esqueleto_armadurado",
		name: "Esqueleto Armadurado",
		sprite: "/assets/sprites/criaturas/esqueletoArmadurado.png",
		baseStats: {
			hp: 44,
			attackSpeed: 0.9,
			physicalDamage: { min: 7, max: 10 },
			elementalDamage: [],
		},
		xpReward: 9,
		allowedRarities: ["normal"],
	},
	esqueleto_lanca: {
		id: "esqueleto_lanca",
		name: "Esqueleto Lanceiro",
		sprite: "/assets/sprites/criaturas/esqueletoLanca.png",
		baseStats: {
			hp: 28,
			attackSpeed: 0.8,
			physicalDamage: { min: 13, max: 18 },
			elementalDamage: [],
		},
		xpReward: 10,
		allowedRarities: ["normal"],
	},
	zumbi: {
		id: "zumbi",
		name: "Zumbi",
		sprite: "/assets/sprites/criaturas/zumbi.png",
		baseStats: {
			hp: 24,
			attackSpeed: 0.8,
			physicalDamage: { min: 6, max: 10 },
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
			hp: 40,
			attackSpeed: 1.0,
			physicalDamage: { min: 8, max: 12 },
			elementalDamage: [{ element: "Cold", min: 4, max: 6 }],
		},
		xpReward: 12,
		allowedRarities: ["normal"],
	},
	lich: {
		id: "lich",
		name: "Lich",
		sprite: "/assets/sprites/criaturas/lich.png",
		baseStats: {
			hp: 32,
			attackSpeed: 0.9,
			physicalDamage: { min: 0, max: 0 },
			elementalDamage: [{ element: "Cold", min: 12, max: 16 }],
		},
		xpReward: 14,
		allowedRarities: ["normal"],
	},
	olho_do_vazio: {
		id: "olho_do_vazio",
		name: "Olho do Vazio",
		sprite: "/assets/sprites/criaturas/olhodovazio.png",
		baseStats: {
			hp: 40,
			attackSpeed: 1.0,
			physicalDamage: { min: 0, max: 0 },
			elementalDamage: [{ element: "Void", min: 11, max: 15 }],
		},
		xpReward: 15,
		allowedRarities: ["normal"],
	},
	criatura_do_vazio: {
		id: "criatura_do_vazio",
		name: "Criatura do Vazio",
		sprite: "/assets/sprites/criaturas/criaturaVazio.png",
		baseStats: {
			hp: 60,
			attackSpeed: 0.9,
			physicalDamage: { min: 6, max: 9 },
			elementalDamage: [{ element: "Void", min: 5, max: 8 }],
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
