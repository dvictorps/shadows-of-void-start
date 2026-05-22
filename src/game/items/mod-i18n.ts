import { getLocale } from "#/paraglide/runtime";
import { MODIFIERS, type ModifierId } from "./data/modifiers";
import type { GeneratedItem, RolledImplicit, RolledMod } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  Mod localization — renders explicit RolledMod values to the active locale at
//  display time. EN derives from MODIFIERS[id].displayFormat; PT uses a per-id
//  formatter table. Both branches share the slot-aware defense resolver so a
//  +X local defense roll renders as Armor/Evasion/Barrier (Armadura/Evasão/
//  Barreira) per the item's armorType — no longer baked at generation time.
//
//  The stored `mod.description` field is legacy data: kept for back-compat
//  with items already in the database, but ignored by the tooltip.
//
//  Implicits still translate via regex match on their stored description.
//  Migrating implicits to render-at-display requires template-level
//  displayFormat in RolledImplicit, deferred to a future cleanup.
// ─────────────────────────────────────────────────────────────────────────────

// ── Slot-aware defense labels (mirrors generator.ts DEFENSE_LABELS) ──

type ArmorBase = "plate" | "leather" | "silk";

interface DefenseWords {
	flat: string;
	pct: string;
}

const EN_DEFENSE_WORDS: Record<ArmorBase, DefenseWords> = {
	plate: { flat: "Armor", pct: "Armor" },
	leather: { flat: "Evasion Rating", pct: "Evasion" },
	silk: { flat: "Barrier", pct: "Barrier" },
};

const PT_DEFENSE_WORDS: Record<ArmorBase, DefenseWords> = {
	plate: { flat: "Armadura", pct: "Armadura" },
	leather: { flat: "Evasão", pct: "Evasão" },
	silk: { flat: "Barreira", pct: "Barreira" },
};

function resolveDefenseWord(
	item: GeneratedItem,
	op: "flat" | "pct",
	locale: "en" | "pt",
): string {
	const table = locale === "pt" ? PT_DEFENSE_WORDS : EN_DEFENSE_WORDS;
	const armorType = item.armorType as ArmorBase | undefined;
	if (!armorType || !table[armorType]) {
		return locale === "pt" ? "Defesa" : "Defense";
	}
	return table[armorType][op];
}

// ── Value formatting (single value or min-max range) ──

function formatValue(mod: RolledMod): string {
	if (mod.minValue != null && mod.maxValue != null) {
		return `${mod.minValue}-${mod.maxValue}`;
	}
	return String(mod.value);
}

// ── PT explicit formatters (keyed by modifierId) ──

type ModFormatter = (mod: RolledMod, item: GeneratedItem) => string;

const PT_EXPLICIT_FORMATTERS: Record<string, ModFormatter> = {
	// Attributes
	strengthFlat: (m) => `+${m.value} de Força`,
	dexterityFlat: (m) => `+${m.value} de Destreza`,
	intelligenceFlat: (m) => `+${m.value} de Inteligência`,

	// Life / mana
	healthFlat: (m) => `+${m.value} de Vida`,
	manaFlat: (m) => `+${m.value} de Mana`,
	healthRegenFlat: (m) => `+${m.value} de Regen. de Vida por segundo`,
	manaRegenFlat: (m) => `+${m.value} de Regen. de Mana por segundo`,

	// Resistances
	coldResistance: (m) => `+${m.value}% de Resistência ao Frio`,
	fireResistance: (m) => `+${m.value}% de Resistência ao Fogo`,
	lightningResistance: (m) => `+${m.value}% de Resistência ao Raio`,
	voidResistance: (m) => `+${m.value}% de Resistência ao Vácuo`,

	// Defenses (flat)
	armorFlat: (m) => `+${m.value} de Armadura`,
	evasionFlat: (m) => `+${m.value} de Evasão`,
	barrierFlat: (m) => `+${m.value} de Barreira`,
	accuracyFlat: (m) => `+${m.value} de Precisão`,
	thornsDamageFlat: (m) => `${m.value} de Dano Refletido`,
	blockChanceIncrease: (m) => `+${m.value}% de Chance de Bloqueio`,

	// Defenses (global %)
	globalArmorIncrease: (m) => `+${m.value}% de Armadura`,
	globalEvasionIncrease: (m) => `+${m.value}% de Evasão`,
	globalBarrierIncrease: (m) => `+${m.value}% de Barreira`,

	// Damage increased %
	globalPhysicalDamageIncrease: (m) => `+${m.value}% de Dano Físico`,
	globalColdDamageIncrease: (m) => `+${m.value}% de Dano de Frio`,
	globalFireDamageIncrease: (m) => `+${m.value}% de Dano de Fogo`,
	globalLightningDamageIncrease: (m) => `+${m.value}% de Dano de Raio`,
	globalVoidDamageIncrease: (m) => `+${m.value}% de Dano de Vácuo`,
	globalElementalDamageIncrease: (m) => `+${m.value}% de Dano Elemental`,
	globalElementalDamageWithAttacksIncrease: (m) =>
		`+${m.value}% de Dano Elemental com Ataques`,
	globalMeleeDamageIncrease: (m) => `+${m.value}% de Dano Corpo a Corpo`,
	globalSpellDamageIncrease: (m) => `+${m.value}% de Dano de Conjuração`,

	// Speed
	globalAttackSpeedIncrease: (m) => `+${m.value}% de Velocidade de Ataque`,
	globalCastSpeedIncrease: (m) => `+${m.value}% de Velocidade de Conjuração`,

	// Crit
	globalCriticalChanceIncrease: (m) => `+${m.value}% de Chance Crítica`,
	criticalStrikeMultiplierFlat: (m) => `+${m.value}% de Multiplicador Crítico`,

	// Flat damage to attacks (range — uses formatValue for min-max)
	physicalDamageFlatGlobal: (m) =>
		`+${formatValue(m)} de Dano Físico em Ataques`,
	coldDamageToAttacksFlat: (m) =>
		`+${formatValue(m)} de Dano de Frio em Ataques`,
	fireDamageToAttacksFlat: (m) =>
		`+${formatValue(m)} de Dano de Fogo em Ataques`,
	lightningDamageToAttacksFlat: (m) =>
		`+${formatValue(m)} de Dano de Raio em Ataques`,
	voidDamageToAttacksFlat: (m) =>
		`+${formatValue(m)} de Dano de Vácuo em Ataques`,

	// Flat damage to spells (caster weapons, range)
	coldDamageFlat: (m) => `+${formatValue(m)} de Dano de Frio em Conjurações`,
	fireDamageFlat: (m) => `+${formatValue(m)} de Dano de Fogo em Conjurações`,
	lightningDamageFlat: (m) =>
		`+${formatValue(m)} de Dano de Raio em Conjurações`,
	voidDamageFlat: (m) => `+${formatValue(m)} de Dano de Vácuo em Conjurações`,

	// Local weapon mods
	physicalDamageFlat: (m) => `+${formatValue(m)} de Dano Físico`,
	physicalDamageIncrease: (m) => `+${m.value}% de Dano Físico`,
	attackSpeedIncrease: (m) => `+${m.value}% de Velocidade de Ataque`,
	criticalChanceIncrease: (m) => `+${m.value}% de Chance Crítica`,

	// Local defense (slot-aware: Armadura / Evasão / Barreira per armorType)
	localDefenseFlat: (m, item) =>
		`+${m.value} de ${resolveDefenseWord(item, "flat", "pt")}`,
	localDefenseIncrease: (m, item) =>
		`+${m.value}% de ${resolveDefenseWord(item, "pct", "pt")}`,

	// Utility
	movementSpeedIncrease: (m) => `+${m.value}% de Velocidade de Movimento`,
	lifeGainOnHitFlat: (m) => `+${m.value} de Vida no Acerto`,
	manaGainOnHitFlat: (m) => `+${m.value} de Mana no Acerto`,
	lifeOnKillFlat: (m) => `+${m.value} de Vida no Abate`,
	manaOnKillFlat: (m) => `+${m.value} de Mana no Abate`,
	lifeLeechPercent: (m) => `${m.value}% de Roubo de Vida do Dano Físico`,
	stunDurationIncrease: (m) => `+${m.value}% de Duração do Atordoamento`,
	reducedAttributeRequirements: (m) => `${m.value}% de Redução em Requisitos`,

	// Magic find
	itemRarityIncreasePrefix: (m) => `+${m.value}% de Raridade de Itens`,
	itemRarityIncreaseSuffix: (m) => `+${m.value}% de Raridade de Itens`,
};

// ── EN render path (derive from MODIFIERS, apply slot-aware substitution) ──

function renderEn(mod: RolledMod, item: GeneratedItem): string {
	const modDef = MODIFIERS[mod.modifierId as ModifierId];
	if (!modDef) return mod.description; // legacy / unknown mod id
	let displayFormat = modDef.displayFormat;
	if (mod.modifierId === "localDefenseFlat") {
		displayFormat = displayFormat.replace(
			"Defense",
			resolveDefenseWord(item, "flat", "en"),
		);
	} else if (mod.modifierId === "localDefenseIncrease") {
		displayFormat = displayFormat.replace(
			"Defense",
			resolveDefenseWord(item, "pct", "en"),
		);
	}
	return displayFormat.replace("{value}", formatValue(mod));
}

// ── Public API ──

export function localizeMod(mod: RolledMod, item: GeneratedItem): string {
	if (getLocale() === "pt") {
		const formatter = PT_EXPLICIT_FORMATTERS[mod.modifierId];
		if (formatter) return formatter(mod, item);
	}
	return renderEn(mod, item);
}

// ── Implicits ──
// Implicits don't carry a displayFormat on RolledImplicit (the template owns
// it), so the renderer can't look it up at display time. PT translates by
// pattern matching the stored EN description. Fragile for new patterns but the
// implicit pool is small. Migrating implicits to render-at-display requires
// adding displayFormat to RolledImplicit — deferred to a future cleanup.

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
