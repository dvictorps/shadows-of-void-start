import { getBossConfig } from "#/game/bosses";
import {
	MONSTER_ACCURACY_PER_LEVEL,
	MONSTER_ARMOR_PER_LEVEL,
	MONSTER_CRIT_CHANCE_INCREASE_PCT,
	MONSTER_CRIT_MULTIPLIER_PCT,
	MONSTER_ELEMENTAL_DAMAGE_PCT,
	MONSTER_EVASION_PER_LEVEL,
	MONSTER_MODIFIERS,
	type MonsterDefinition,
	type MonsterId,
	type MonsterModId,
	type MonsterRarity,
	type ScaledMonsterStats,
} from "#/game/monsters";
import { m } from "#/paraglide/messages";
import { getLocale, type Locale } from "#/paraglide/runtime";

import {
	type GenderedForm,
	isGenderedForm,
	pickGendered,
} from "../i18n/lexicon-shared";
import { hasOwnKey } from "../typed-object";
import { lexiconEn } from "./lexicon/en";
import { lexiconPt } from "./lexicon/pt";
import type {
	GenderedNoun,
	MonsterNameLexicon,
	PrefixMonsterModId,
	SuffixMonsterModId,
} from "./lexicon/types";
import type { CampSource, WorldNode } from "./types";

// Three independent uniform-[0, 1] seeds drive the rare proper-name pick.
// Held on each spawned Enemy so re-renders / locale switches keep the same
// name across the spawn's lifetime — and a fresh spawn gets a fresh roll.
export interface RareNameSeed {
	primary: number;
	secondary: number;
	epithet: number;
}

// Structural shape — anything carrying these fields can be named. Lets
// `translateEnemyName` accept the Enemy type from useCombatLoop without
// importing it directly (and without a circular dep).
export interface NameableEnemy {
	def: MonsterDefinition;
	mods: readonly MonsterModId[];
	rarity: MonsterRarity;
	nameSeed: RareNameSeed;
}

// Lookup table over hand-coded switches: adding a zone is a one-line entry
// instead of two parallel switch cases. The `description` slot is optional —
// zones without a description return null and the caller falls back to the
// node name.
interface NodeMessages {
	name: () => string;
	description?: () => string;
}

const NODE_I18N = {
	city: { name: m.zone_city, description: m.zone_city_description },
	forest_starter: {
		name: m.zone_forest_starter,
		description: m.zone_forest_starter_description,
	},
	forest_profunda: {
		name: m.zone_forest_profunda,
		description: m.zone_forest_profunda_description,
	},
	pantano: { name: m.zone_pantano, description: m.zone_pantano_description },
	cripta: { name: m.zone_cripta, description: m.zone_cripta_description },
	castelo: { name: m.zone_castelo, description: m.zone_castelo_description },
	fenda_vazio: {
		name: m.zone_fenda_vazio,
		description: m.zone_fenda_vazio_description,
	},
} satisfies Record<string, NodeMessages>;

/**
 * Resolve a world-node's display name through the active locale's messages.
 * Falls back to the data's canonical `name` for unknown ids so future zones
 * render even before translations land.
 */
export function translateNodeName(node: WorldNode): string {
	return hasOwnKey(NODE_I18N, node.id) ? NODE_I18N[node.id].name() : node.name;
}

/**
 * Resolve a world-node's flavor description, or null when none exists. The
 * caller (TextLog) falls back to the node name in that case.
 */
export function translateNodeDescription(node: WorldNode): string | null {
	if (!hasOwnKey(NODE_I18N, node.id)) return null;
	const entry: NodeMessages = NODE_I18N[node.id];
	return entry.description?.() ?? null;
}

// Three ambient lines per zone that fade in during the camp cinematic. Falls
// back to a neutral set when a zone has no entry. See CONTEXT.md → Acampamento.
type CampLines = [() => string, () => string, () => string];

const CAMP_LINES_I18N = {
	forest_starter: [
		m.camp_line_forest_starter_1,
		m.camp_line_forest_starter_2,
		m.camp_line_forest_starter_3,
	],
	forest_profunda: [
		m.camp_line_forest_profunda_1,
		m.camp_line_forest_profunda_2,
		m.camp_line_forest_profunda_3,
	],
	pantano: [
		m.camp_line_pantano_1,
		m.camp_line_pantano_2,
		m.camp_line_pantano_3,
	],
	cripta: [m.camp_line_cripta_1, m.camp_line_cripta_2, m.camp_line_cripta_3],
	castelo: [
		m.camp_line_castelo_1,
		m.camp_line_castelo_2,
		m.camp_line_castelo_3,
	],
	fenda_vazio: [
		m.camp_line_fenda_vazio_1,
		m.camp_line_fenda_vazio_2,
		m.camp_line_fenda_vazio_3,
	],
} satisfies Record<string, CampLines>;

const CAMP_LINES_FALLBACK: CampLines = [
	m.camp_line_fallback_1,
	m.camp_line_fallback_2,
	m.camp_line_fallback_3,
];

const CAMP_LINES_INCENSE: CampLines = [
	m.camp_line_incense_1,
	m.camp_line_incense_2,
	m.camp_line_incense_3,
];

/**
 * Three ambient lines for the camp cinematic, locale-resolved. `source`
 * picks the generic incense lines over the zone-specific baked-camp set —
 * see CONTEXT.md → Incenso Etéreo for the flavor rationale.
 */
export function translateCampLines(
	zoneId: string,
	source: CampSource = "baked",
): [string, string, string] {
	if (source === "incense") {
		return [
			CAMP_LINES_INCENSE[0](),
			CAMP_LINES_INCENSE[1](),
			CAMP_LINES_INCENSE[2](),
		];
	}
	const entry = hasOwnKey(CAMP_LINES_I18N, zoneId)
		? CAMP_LINES_I18N[zoneId]
		: CAMP_LINES_FALLBACK;
	return [entry[0](), entry[1](), entry[2]()];
}

const MONSTER_I18N = {
	goblin: m.monster_goblin,
	slime: m.monster_slime,
	macaco: m.monster_macaco,
	morcego: m.monster_morcego,
	serpente: m.monster_serpente,
	esqueleto: m.monster_esqueleto,
	esqueleto_armadurado: m.monster_esqueleto_armadurado,
	esqueleto_lanca: m.monster_esqueleto_lanca,
	zumbi: m.monster_zumbi,
	vampiro: m.monster_vampiro,
	lich: m.monster_lich,
	olho_do_vazio: m.monster_olho_do_vazio,
	criatura_do_vazio: m.monster_criatura_do_vazio,
} satisfies Record<MonsterId, () => string>;

// Elemental resistances participate in the compound-name rule: two or more
// collapse into a single "Elemental Resistant" adjective instead of stacking
// individual suffixes ("of Frost and Flame" / "de Frio e Fogo"). One resist
// still renders normally as a suffix.
const RESIST_MOD_IDS: ReadonlySet<SuffixMonsterModId> = new Set([
	"monsterColdResistance",
	"monsterFireResistance",
	"monsterLightningResistance",
	"monsterVoidResistance",
]);

function isPrefixMod(id: MonsterModId): id is PrefixMonsterModId {
	return MONSTER_MODIFIERS[id].affixType === "prefix";
}

function isSuffixMod(id: MonsterModId): id is SuffixMonsterModId {
	return MONSTER_MODIFIERS[id].affixType === "suffix";
}

// Every resist mod is a suffix (RESIST_MOD_IDS is typed that way), so the
// isSuffixMod check never rejects a resist — it only narrows the type.
function isResistMod(id: MonsterModId): id is SuffixMonsterModId {
	return isSuffixMod(id) && RESIST_MOD_IDS.has(id);
}

/**
 * Compose the localized display name of a (possibly modified) monster.
 *
 * EN: PoE-style — adjectives stack before the base, then "of <noun1> and
 *   <noun2>" trailing. The compound name "Elemental Resistant" joins the
 *   prefix stack when two or more resists roll.
 *
 * PT: adjectives go after the base and agree with the monster's grammatical
 *   gender. Suffix nouns carry their own gender ("do Frio" / "da
 *   Velocidade") and join with " e ". The compound "Resistente a Elementos"
 *   trails the regular adjectives.
 *
 * Falls back to the monster's canonical name when no mods are present.
 */
export function translateMonsterName(
	def: MonsterDefinition,
	mods?: readonly MonsterModId[],
): string {
	const base = hasOwnKey(MONSTER_I18N, def.id)
		? MONSTER_I18N[def.id]()
		: def.name;
	if (!mods || mods.length === 0) return base;
	const locale = getLocale();
	if (locale === "pt") return renderPt(def, base, mods);
	return renderEn(base, mods, lexiconEn);
}

interface PartitionedMods {
	prefixIds: PrefixMonsterModId[];
	suffixIds: SuffixMonsterModId[];
	resists: SuffixMonsterModId[];
}

// Splits a mod list into its three lexical buckets. Resist mods are pulled
// out of `suffixIds` because they participate in the compound-name rule (2+
// collapse into "Elemental Resistant" / "Resistente a Elementos") that the
// per-locale renderers apply differently.
function partitionMods(mods: readonly MonsterModId[]): PartitionedMods {
	const prefixIds: PrefixMonsterModId[] = [];
	const suffixIds: SuffixMonsterModId[] = [];
	const resists: SuffixMonsterModId[] = [];
	for (const id of mods) {
		if (isResistMod(id)) {
			resists.push(id);
		} else if (isPrefixMod(id)) {
			prefixIds.push(id);
		} else if (isSuffixMod(id)) {
			suffixIds.push(id);
		}
	}
	return { prefixIds, suffixIds, resists };
}

function renderEn(
	base: string,
	mods: readonly MonsterModId[],
	lex: MonsterNameLexicon,
): string {
	const { prefixIds, suffixIds, resists } = partitionMods(mods);
	const prefixes = prefixIds.map((id) => formAsString(lex.prefixAdj[id]));
	const suffixes = suffixIds.map((id) => nounAsString(lex.suffixNoun[id]));

	if (resists.length >= 2) prefixes.push(lex.compoundAdj);
	else if (resists.length === 1)
		suffixes.push(nounAsString(lex.suffixNoun[resists[0]]));

	let result = base;
	if (prefixes.length > 0) result = `${prefixes.join(" ")} ${result}`;
	if (suffixes.length > 0) {
		const joined =
			suffixes.length === 1
				? suffixes[0]
				: `${suffixes.slice(0, -1).join(", ")} and ${suffixes.at(-1)}`;
		result = `${result} of ${joined}`;
	}
	return result;
}

function renderPt(
	def: MonsterDefinition,
	base: string,
	mods: readonly MonsterModId[],
): string {
	const lex = lexiconPt;
	const genders = lex.monsterGender;
	const gender = genders && hasOwnKey(genders, def.id) ? genders[def.id] : "m";
	const { prefixIds, suffixIds, resists } = partitionMods(mods);
	const adjectives = prefixIds.map((id) =>
		pickGendered(lex.prefixAdj[id], gender),
	);
	const suffixPhrases = suffixIds.map((id) =>
		suffixPhrasePt(lex.suffixNoun[id]),
	);

	if (resists.length >= 2) adjectives.push(lex.compoundAdj);
	else if (resists.length === 1)
		suffixPhrases.push(suffixPhrasePt(lex.suffixNoun[resists[0]]));

	let result = base;
	if (adjectives.length > 0) result = `${result} ${adjectives.join(" ")}`;
	if (suffixPhrases.length > 0) {
		result = `${result} ${suffixPhrases.join(" e ")}`;
	}
	return result;
}

function isGenderedNoun(noun: string | GenderedNoun): noun is GenderedNoun {
	return typeof noun !== "string";
}

function nounAsString(noun: string | GenderedNoun): string {
	return isGenderedNoun(noun) ? noun.noun : noun;
}

function formAsString(form: string | GenderedForm): string {
	return isGenderedForm(form) ? form.m : form;
}

function suffixPhrasePt(noun: string | GenderedNoun): string {
	if (!isGenderedNoun(noun)) return noun;
	const article = noun.gender === "m" ? "do" : "da";
	return `${article} ${noun.noun}`;
}

// BossConfig.nameKey → its zero-arg paraglide message. An explicit table
// (like MONSTER_I18N) instead of indexing `m` by string: `m` mixes zero-arg
// and required-input messages, so a dynamic lookup can't be typed. A new
// boss adds its key here; a missing entry falls back to def.name.
const BOSS_NAME_I18N = {
	boss_gralfor_name: m.boss_gralfor_name,
} satisfies Record<string, () => string>;

/**
 * Localized display name for any combat enemy. Normal / magic monsters fall
 * through to the mod-based renderer (translateMonsterName); rares get a
 * proper compound name + epithet drawn from the active locale's pool, keyed
 * by the spawn's nameSeed so re-renders stay stable. Uniques (act bosses)
 * resolve their handcrafted name via the BossConfig.nameKey paraglide key —
 * the proper-noun part is locale-invariant by convention; the epithet
 * localizes ("Gralfor, O Persistente" / "Gralfor, the Persistent"). See
 * CONTEXT.md → Boss.
 */
export function translateEnemyName(enemy: NameableEnemy): string {
	if (enemy.rarity === "unique") {
		const boss = getBossConfig(enemy);
		if (boss && hasOwnKey(BOSS_NAME_I18N, boss.nameKey))
			return BOSS_NAME_I18N[boss.nameKey]();
		// Fallback — if the BossConfig or paraglide key is missing for any
		// reason, fall through to the def.name so we always render something.
		return enemy.def.name;
	}
	if (enemy.rarity === "rare") {
		const locale = getLocale();
		const lex = locale === "pt" ? lexiconPt : lexiconEn;
		const epithetPool = pickRareEpithetPool(enemy.mods, lex);
		const baseName = composeRareBaseName(enemy.nameSeed, lex, locale);
		const epithet =
			epithetPool[Math.floor(enemy.nameSeed.epithet * epithetPool.length)];
		return `${baseName}, ${epithet}`;
	}
	return translateMonsterName(enemy.def, enemy.mods);
}

function composeRareBaseName(
	seed: RareNameSeed,
	lex: MonsterNameLexicon,
	locale: Locale,
): string {
	const first =
		lex.rareFirstWords[Math.floor(seed.primary * lex.rareFirstWords.length)];
	const second =
		lex.rareSecondWords[
			Math.floor(seed.secondary * lex.rareSecondWords.length)
		];
	// EN compounds the two words ("Stonemaw"); PT keeps them separate with the
	// preposition that's already baked into the second-pool entry ("Garra de
	// Aço").
	return locale === "pt" ? `${first} ${second}` : `${first}${second}`;
}

function pickRareEpithetPool(
	mods: readonly MonsterModId[],
	lex: MonsterNameLexicon,
): readonly string[] {
	// 2+ resists collapse into the compound rule — same precedence as the
	// magic/normal renderers.
	let resistCount = 0;
	let firstPrefix: PrefixMonsterModId | null = null;
	for (const id of mods) {
		if (isResistMod(id)) resistCount += 1;
		else if (isPrefixMod(id) && firstPrefix === null) firstPrefix = id;
	}
	if (resistCount >= 2) return lex.rareCompoundEpithets;
	if (firstPrefix !== null) return lex.rareEpithetsByPrefix[firstPrefix];
	// Fallback: rares always roll ≥1 prefix per the affix cap, so this branch
	// shouldn't fire in practice — but keep something safe just in case.
	return lex.rareCompoundEpithets;
}

// `scaled` carries everything: `scaled.level` drives the level-scaled flats
// (evasion, accuracy, more armor); `scaled.barrier` is the precomputed
// barrier amount (depends on whether Increased Life co-rolled, so it isn't
// derivable from level alone). Keep this in sync with the apply()s in
// src/game/monsters/modifiers.ts.
export function translateMonsterModDescription(
	id: MonsterModId,
	scaled: ScaledMonsterStats,
): string {
	const level = scaled.level;
	switch (id) {
		case "monsterIncreasedLife":
			return m.monster_mod_increased_life_desc();
		case "monsterIncreasedDamage":
			return m.monster_mod_increased_damage_desc();
		case "monsterIncreasedAttackSpeed":
			return m.monster_mod_increased_attack_speed_desc();
		case "monsterIncreasedEvasion":
			return m.monster_mod_increased_evasion_desc({
				value: MONSTER_EVASION_PER_LEVEL * level,
			});
		case "monsterIncreasedAccuracy":
			return m.monster_mod_increased_accuracy_desc({
				value: MONSTER_ACCURACY_PER_LEVEL * level,
			});
		case "monsterColdResistance":
			return m.monster_mod_cold_resistance_desc();
		case "monsterFireResistance":
			return m.monster_mod_fire_resistance_desc();
		case "monsterLightningResistance":
			return m.monster_mod_lightning_resistance_desc();
		case "monsterVoidResistance":
			return m.monster_mod_void_resistance_desc();
		case "monsterAdditionalBarrier":
			return m.monster_mod_additional_barrier_desc({ value: scaled.barrier });
		case "monsterMoreArmor":
			return m.monster_mod_more_armor_desc({
				value: MONSTER_ARMOR_PER_LEVEL * level,
			});
		case "monsterCriticalChanceIncrease":
			return m.monster_mod_critical_chance_desc({
				pct: MONSTER_CRIT_CHANCE_INCREASE_PCT,
			});
		case "monsterCriticalMultiplier":
			return m.monster_mod_critical_multiplier_desc({
				pct: MONSTER_CRIT_MULTIPLIER_PCT,
			});
		case "monsterColdDamage":
			return m.monster_mod_cold_damage_desc({
				pct: MONSTER_ELEMENTAL_DAMAGE_PCT,
			});
		case "monsterFireDamage":
			return m.monster_mod_fire_damage_desc({
				pct: MONSTER_ELEMENTAL_DAMAGE_PCT,
			});
		case "monsterLightningDamage":
			return m.monster_mod_lightning_damage_desc({
				pct: MONSTER_ELEMENTAL_DAMAGE_PCT,
			});
		case "monsterVoidDamage":
			return m.monster_mod_void_damage_desc({
				pct: MONSTER_ELEMENTAL_DAMAGE_PCT,
			});
	}
}
