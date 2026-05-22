import { getLocale } from "#/paraglide/runtime";
import { MODIFIERS, type ModifierId } from "./data/modifiers";
import { type DEFENSE_LABELS, resolveDefenseFormat } from "./generator";
import type { GeneratedItem, RolledImplicit, RolledMod } from "./types";

// Renders explicit RolledMod values to the active locale at display time. EN
// reuses MODIFIERS[id].displayFormat and the same slot-aware resolver as the
// generator. PT keeps a per-id formatter table because gender/word-order don't
// translate well from the EN displayFormat. Slot-aware defense mods read
// item.armorType to pick Armor/Evasion/Barrier (Armadura/Evasão/Barreira).

type ArmorBase = keyof typeof DEFENSE_LABELS;

const PT_DEFENSE_WORDS: Record<ArmorBase, { flat: string; pct: string }> = {
	plate: { flat: "Armadura", pct: "Armadura" },
	leather: { flat: "Evasão", pct: "Evasão" },
	silk: { flat: "Barreira", pct: "Barreira" },
};

function ptDefenseWord(item: GeneratedItem, op: "flat" | "pct"): string {
	const armorType = item.armorType as ArmorBase | undefined;
	const words = armorType ? PT_DEFENSE_WORDS[armorType] : undefined;
	return words ? words[op] : "Defesa";
}

function formatValue(mod: RolledMod): string {
	if (mod.minValue != null && mod.maxValue != null) {
		return `${mod.minValue}-${mod.maxValue}`;
	}
	return String(mod.value);
}

// Factories for repeated PT damage templates — share the formatter across the
// weapon-local mod and its jewelry/quiver *Global twin (identical EN
// displayFormat, identical PT output).
type ModFormatter = (mod: RolledMod, item: GeneratedItem) => string;

const ptPhysDamageToAttacks: ModFormatter = (m) =>
	`+${formatValue(m)} de Dano Físico em Ataques`;

const ptElementalToAttacks =
	(element: string): ModFormatter =>
	(m) =>
		`+${formatValue(m)} de Dano de ${element} em Ataques`;

const ptElementalToSpells =
	(element: string): ModFormatter =>
	(m) =>
		`+${formatValue(m)} de Dano de ${element} em Conjurações`;

const ptTomeGainAsExtra =
	(element: string): ModFormatter =>
	(m) =>
		`Ganha ${m.value}% do Dano de Conjuração como Dano de ${element} Adicional`;

const PT_EXPLICIT_FORMATTERS: Record<string, ModFormatter> = {
	strengthFlat: (m) => `+${m.value} de Força`,
	dexterityFlat: (m) => `+${m.value} de Destreza`,
	intelligenceFlat: (m) => `+${m.value} de Inteligência`,

	healthFlat: (m) => `+${m.value} de Vida`,
	manaFlat: (m) => `+${m.value} de Mana`,
	healthRegenFlat: (m) => `+${m.value} de Regen. de Vida por segundo`,
	manaRegenFlat: (m) => `+${m.value} de Regen. de Mana por segundo`,

	coldResistance: (m) => `+${m.value}% de Resistência ao Frio`,
	fireResistance: (m) => `+${m.value}% de Resistência ao Fogo`,
	lightningResistance: (m) => `+${m.value}% de Resistência ao Raio`,
	voidResistance: (m) => `+${m.value}% de Resistência ao Vácuo`,

	armorFlat: (m) => `+${m.value} de Armadura`,
	evasionFlat: (m) => `+${m.value} de Evasão`,
	barrierFlat: (m) => `+${m.value} de Barreira`,
	accuracyFlat: (m) => `+${m.value} de Precisão`,
	thornsDamageFlat: (m) => `${m.value} de Dano Refletido`,
	blockChanceIncrease: (m) => `+${m.value}% de Chance de Bloqueio`,

	globalArmorIncrease: (m) => `+${m.value}% de Armadura`,
	globalEvasionIncrease: (m) => `+${m.value}% de Evasão`,
	globalBarrierIncrease: (m) => `+${m.value}% de Barreira`,

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

	globalAttackSpeedIncrease: (m) => `+${m.value}% de Velocidade de Ataque`,
	globalCastSpeedIncrease: (m) => `+${m.value}% de Velocidade de Conjuração`,

	globalCriticalChanceIncrease: (m) => `+${m.value}% de Chance Crítica`,
	criticalStrikeMultiplierFlat: (m) => `+${m.value}% de Multiplicador Crítico`,

	physicalDamageFlat: ptPhysDamageToAttacks,
	physicalDamageFlatGlobal: ptPhysDamageToAttacks,
	coldDamageToAttacksFlat: ptElementalToAttacks("Frio"),
	coldDamageToAttacksFlatGlobal: ptElementalToAttacks("Frio"),
	fireDamageToAttacksFlat: ptElementalToAttacks("Fogo"),
	fireDamageToAttacksFlatGlobal: ptElementalToAttacks("Fogo"),
	lightningDamageToAttacksFlat: ptElementalToAttacks("Raio"),
	lightningDamageToAttacksFlatGlobal: ptElementalToAttacks("Raio"),
	voidDamageToAttacksFlat: ptElementalToAttacks("Vácuo"),
	voidDamageToAttacksFlatGlobal: ptElementalToAttacks("Vácuo"),

	coldDamageFlat: ptElementalToSpells("Frio"),
	fireDamageFlat: ptElementalToSpells("Fogo"),
	lightningDamageFlat: ptElementalToSpells("Raio"),
	voidDamageFlat: ptElementalToSpells("Vácuo"),

	physicalDamageIncrease: (m) => `+${m.value}% de Dano Físico`,
	attackSpeedIncrease: (m) => `+${m.value}% de Velocidade de Ataque`,
	criticalChanceIncrease: (m) => `+${m.value}% de Chance Crítica`,

	localDefenseFlat: (m, item) =>
		`+${m.value} de ${ptDefenseWord(item, "flat")}`,
	localDefenseIncrease: (m, item) =>
		`+${m.value}% de ${ptDefenseWord(item, "pct")}`,

	tomeGainAsExtraCold: ptTomeGainAsExtra("Frio"),
	tomeGainAsExtraFire: ptTomeGainAsExtra("Fogo"),
	tomeGainAsExtraLightning: ptTomeGainAsExtra("Raio"),
	tomeGainAsExtraVoid: ptTomeGainAsExtra("Vácuo"),

	movementSpeedIncrease: (m) => `+${m.value}% de Velocidade de Movimento`,
	lifeGainOnHitFlat: (m) => `+${m.value} de Vida no Acerto`,
	manaGainOnHitFlat: (m) => `+${m.value} de Mana no Acerto`,
	lifeOnKillFlat: (m) => `+${m.value} de Vida no Abate`,
	manaOnKillFlat: (m) => `+${m.value} de Mana no Abate`,
	lifeLeechPercent: (m) => `${m.value}% de Roubo de Vida do Dano Físico`,
	stunDurationIncrease: (m) => `+${m.value}% de Duração do Atordoamento`,
	reducedAttributeRequirements: (m) => `${m.value}% de Redução em Requisitos`,

	itemRarityIncreasePrefix: (m) => `+${m.value}% de Raridade de Itens`,
	itemRarityIncreaseSuffix: (m) => `+${m.value}% de Raridade de Itens`,
};

function renderEn(mod: RolledMod, item: GeneratedItem): string {
	const modDef = MODIFIERS[mod.modifierId as ModifierId];
	if (!modDef) return mod.description;
	const displayFormat = resolveDefenseFormat(
		mod.modifierId,
		modDef.displayFormat,
		item.armorType,
	);
	return displayFormat.replace("{value}", formatValue(mod));
}

export function localizeMod(mod: RolledMod, item: GeneratedItem): string {
	if (getLocale() === "pt") {
		const formatter = PT_EXPLICIT_FORMATTERS[mod.modifierId];
		if (formatter) return formatter(mod, item);
	}
	return renderEn(mod, item);
}

// Implicits translate via regex match on the stored EN description because
// their displayFormat lives on the template, not on RolledImplicit. Migrating
// to render-at-display needs displayFormat on RolledImplicit — deferred.
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
	{ test: /^\+\d+ to Maximum Life$/i, render: (v) => `+${v} de Vida Máxima` },
	{ test: /^\+\d+ to Maximum Mana$/i, render: (v) => `+${v} de Mana Máxima` },
	{
		test: /^\+\d+ to Maximum Barrier$/i,
		render: (v) => `+${v} de Barreira Máxima`,
	},
	// Legacy phrasing — older items rolled before templates added "to Maximum".
	{ test: /^\+\d+ Maximum Life$/i, render: (v) => `+${v} de Vida Máxima` },
	{ test: /^\+\d+ Maximum Mana$/i, render: (v) => `+${v} de Mana Máxima` },
	{ test: /^\+\d+ Accuracy Rating$/i, render: (v) => `+${v} de Precisão` },
	{ test: /^\+\d+ Accuracy$/i, render: (v) => `+${v} de Precisão` },
	{ test: /^\+\d+ Armor$/i, render: (v) => `+${v} de Armadura` },
	{ test: /^\+\d+ Evasion$/i, render: (v) => `+${v} de Evasão` },
	{ test: /^\+\d+ Barrier$/i, render: (v) => `+${v} de Barreira` },
	{
		test: /^\+\d+% Block Chance$/i,
		render: (v) => `+${v}% de Chance de Bloqueio`,
	},
	{
		test: /^\+\d+% Critical Strike Multiplier$/i,
		render: (v) => `+${v}% de Multiplicador Crítico`,
	},
	{
		test: /^\+\d+% Movement Speed$/i,
		render: (v) => `+${v}% de Velocidade de Movimento`,
	},
	{
		test: /^\+\d+% increased Attack Speed$/i,
		render: (v) => `+${v}% de Velocidade de Ataque`,
	},
	{
		test: /^\+\d+% Spell Damage$/i,
		render: (v) => `+${v}% de Dano de Conjuração`,
	},
	{
		test: /^\+\d+% increased Spell Damage$/i,
		render: (v) => `+${v}% de Dano de Conjuração`,
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
