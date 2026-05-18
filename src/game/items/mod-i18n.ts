import { getLocale } from "#/paraglide/runtime";
import type { RolledImplicit, RolledMod } from "./types";

// ── Explicit mods (RolledMod) ──
// Keyed by modifierId. PT formatters take the rolled value and return the
// localized display string. EN falls back to the stored description.

type ModFormatter = (value: number) => string;

const PT_EXPLICIT_FORMATTERS: Record<string, ModFormatter> = {
	// Attributes
	strengthFlat: (v) => `+${v} de Força`,
	dexterityFlat: (v) => `+${v} de Destreza`,
	intelligenceFlat: (v) => `+${v} de Inteligência`,

	// Life / mana
	healthFlat: (v) => `+${v} de Vida`,
	manaFlat: (v) => `+${v} de Mana`,
	healthRegenFlat: (v) => `+${v} de Regen. de Vida por segundo`,
	manaRegenFlat: (v) => `+${v} de Regen. de Mana por segundo`,

	// Resistances
	coldResistance: (v) => `+${v}% de Resistência ao Frio`,
	fireResistance: (v) => `+${v}% de Resistência ao Fogo`,
	lightningResistance: (v) => `+${v}% de Resistência ao Raio`,
	voidResistance: (v) => `+${v}% de Resistência ao Vácuo`,

	// Defenses (flat)
	armorFlat: (v) => `+${v} de Armadura`,
	evasionFlat: (v) => `+${v} de Evasão`,
	barrierFlat: (v) => `+${v} de Barreira`,
	accuracyFlat: (v) => `+${v} de Precisão`,
	thornsDamageFlat: (v) => `${v} de Dano Refletido`,
	blockChanceIncrease: (v) => `+${v}% de Chance de Bloqueio`,

	// Defenses (global %)
	globalArmorIncrease: (v) => `+${v}% de Armadura`,
	globalEvasionIncrease: (v) => `+${v}% de Evasão`,
	globalBarrierIncrease: (v) => `+${v}% de Barreira`,

	// Damage increased %
	globalPhysicalDamageIncrease: (v) => `+${v}% de Dano Físico`,
	globalColdDamageIncrease: (v) => `+${v}% de Dano de Frio`,
	globalFireDamageIncrease: (v) => `+${v}% de Dano de Fogo`,
	globalLightningDamageIncrease: (v) => `+${v}% de Dano de Raio`,
	globalVoidDamageIncrease: (v) => `+${v}% de Dano de Vácuo`,
	globalElementalDamageIncrease: (v) => `+${v}% de Dano Elemental`,
	globalElementalDamageWithAttacksIncrease: (v) =>
		`+${v}% de Dano Elemental com Ataques`,
	globalMeleeDamageIncrease: (v) => `+${v}% de Dano Corpo a Corpo`,
	globalSpellDamageIncrease: (v) => `+${v}% de Dano de Conjuração`,

	// Speed
	globalAttackSpeedIncrease: (v) => `+${v}% de Velocidade de Ataque`,
	globalCastSpeedIncrease: (v) => `+${v}% de Velocidade de Conjuração`,

	// Crit
	globalCriticalChanceIncrease: (v) => `+${v}% de Chance Crítica`,
	criticalStrikeMultiplierFlat: (v) => `+${v}% de Multiplicador Crítico`,

	// Flat damage to attacks (from gear)
	physicalDamageFlatGlobal: (v) => `+${v} de Dano Físico em Ataques`,
	coldDamageToAttacksFlat: (v) => `+${v} de Dano de Frio em Ataques`,
	fireDamageToAttacksFlat: (v) => `+${v} de Dano de Fogo em Ataques`,
	lightningDamageToAttacksFlat: (v) => `+${v} de Dano de Raio em Ataques`,
	voidDamageToAttacksFlat: (v) => `+${v} de Dano de Vácuo em Ataques`,

	// Flat damage to spells (caster weapons)
	coldDamageFlat: (v) => `+${v} de Dano de Frio em Conjurações`,
	fireDamageFlat: (v) => `+${v} de Dano de Fogo em Conjurações`,
	lightningDamageFlat: (v) => `+${v} de Dano de Raio em Conjurações`,
	voidDamageFlat: (v) => `+${v} de Dano de Vácuo em Conjurações`,

	// Local weapon mods
	physicalDamageFlat: (v) => `+${v} de Dano Físico`,
	physicalDamageIncrease: (v) => `+${v}% de Dano Físico`,
	attackSpeedIncrease: (v) => `+${v}% de Velocidade de Ataque`,
	criticalChanceIncrease: (v) => `+${v}% de Chance Crítica`,
	localDefenseFlat: (v) => `+${v} de Defesa`,
	localDefenseIncrease: (v) => `+${v}% de Defesa`,

	// Utility
	movementSpeedIncrease: (v) => `+${v}% de Velocidade de Movimento`,
	lifeGainOnHitFlat: (v) => `+${v} de Vida no Acerto`,
	manaGainOnHitFlat: (v) => `+${v} de Mana no Acerto`,
	lifeOnKillFlat: (v) => `+${v} de Vida no Abate`,
	manaOnKillFlat: (v) => `+${v} de Mana no Abate`,
	lifeLeechPercent: (v) => `${v}% de Roubo de Vida do Dano Físico`,
	stunDurationIncrease: (v) => `+${v}% de Duração do Atordoamento`,
	reducedAttributeRequirements: (v) => `${v}% de Redução em Requisitos`,

	// Magic find
	itemRarityIncreasePrefix: (v) => `+${v}% de Raridade de Itens`,
	itemRarityIncreaseSuffix: (v) => `+${v}% de Raridade de Itens`,
};

export function localizeMod(mod: RolledMod): string {
	if (getLocale() === "pt") {
		const formatter = PT_EXPLICIT_FORMATTERS[mod.modifierId];
		if (formatter) return formatter(mod.value);
	}
	return mod.description;
}

// ── Implicits ──
// Implicits don't carry a modifierId — they're text-described on the template.
// We translate by pattern matching on the stored English description. Fragile
// for new patterns but the implicit pool is small (resistances, attributes,
// life, mana, movement speed, accuracy).

const PT_IMPLICIT_PATTERNS: Array<{
	test: RegExp;
	render: (value: number, match: RegExpMatchArray) => string;
}> = [
	{
		test: /^\+\d+% Cold Resistance$/i,
		render: (v) => `+${v}% de Resistência ao Frio`,
	},
	{
		test: /^\+\d+% Fire Resistance$/i,
		render: (v) => `+${v}% de Resistência ao Fogo`,
	},
	{
		test: /^\+\d+% Lightning Resistance$/i,
		render: (v) => `+${v}% de Resistência ao Raio`,
	},
	{
		test: /^\+\d+% Void Resistance$/i,
		render: (v) => `+${v}% de Resistência ao Vácuo`,
	},
	{
		test: /^\+\d+% to all Elemental Resistances$/i,
		render: (v) => `+${v}% a todas Resistências Elementais`,
	},
	{
		test: /^\+\d+ to all Attributes$/i,
		render: (v) => `+${v} a todos Atributos`,
	},
	{ test: /^\+\d+ Strength$/i, render: (v) => `+${v} de Força` },
	{ test: /^\+\d+ Dexterity$/i, render: (v) => `+${v} de Destreza` },
	{ test: /^\+\d+ Intelligence$/i, render: (v) => `+${v} de Inteligência` },
	{ test: /^\+\d+ Maximum Life$/i, render: (v) => `+${v} de Vida Máxima` },
	{ test: /^\+\d+ Maximum Mana$/i, render: (v) => `+${v} de Mana Máxima` },
	{ test: /^\+\d+ Accuracy$/i, render: (v) => `+${v} de Precisão` },
	{ test: /^\+\d+ Armor$/i, render: (v) => `+${v} de Armadura` },
	{ test: /^\+\d+ Evasion$/i, render: (v) => `+${v} de Evasão` },
	{ test: /^\+\d+ Barrier$/i, render: (v) => `+${v} de Barreira` },
	{
		test: /^\+\d+% Movement Speed$/i,
		render: (v) => `+${v}% de Velocidade de Movimento`,
	},
];

export function localizeImplicit(implicit: RolledImplicit): string {
	if (getLocale() === "pt") {
		for (const { test, render } of PT_IMPLICIT_PATTERNS) {
			const match = implicit.description.match(test);
			if (match) return render(implicit.value, match);
		}
	}
	return implicit.description;
}
