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

export interface RareNameSeed {
	primary: number;
	secondary: number;
	epithet: number;
}

export interface NameableEnemy {
	def: MonsterDefinition;
	mods: readonly MonsterModId[];
	rarity: MonsterRarity;
	nameSeed: RareNameSeed;
}

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

export function translateNodeName(node: WorldNode): string {
	return hasOwnKey(NODE_I18N, node.id) ? NODE_I18N[node.id].name() : node.name;
}

export function translateNodeDescription(node: WorldNode): string | null {
	if (!hasOwnKey(NODE_I18N, node.id)) return null;
	const entry: NodeMessages = NODE_I18N[node.id];
	return entry.description?.() ?? null;
}

const CAMP_LINE_I18N = {
	forest_starter: m.camp_line_forest_starter,
	forest_profunda: m.camp_line_forest_profunda,
	pantano: m.camp_line_pantano,
	cripta: m.camp_line_cripta,
	castelo: m.camp_line_castelo,
	fenda_vazio: m.camp_line_fenda_vazio,
} satisfies Record<string, () => string>;

export function translateCampLine(
	zoneId: string,
	source: CampSource = "baked",
): string {
	if (source === "incense") return m.camp_line_incense();
	return hasOwnKey(CAMP_LINE_I18N, zoneId)
		? CAMP_LINE_I18N[zoneId]()
		: m.camp_line_fallback();
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

function isResistMod(id: MonsterModId): id is SuffixMonsterModId {
	return isSuffixMod(id) && RESIST_MOD_IDS.has(id);
}

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

const BOSS_NAME_I18N = {
	boss_gralfor_name: m.boss_gralfor_name,
} satisfies Record<string, () => string>;

export function translateEnemyName(enemy: NameableEnemy): string {
	if (enemy.rarity === "unique") {
		const boss = getBossConfig(enemy);
		if (boss && hasOwnKey(BOSS_NAME_I18N, boss.nameKey))
			return BOSS_NAME_I18N[boss.nameKey]();
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
	return locale === "pt" ? `${first} ${second}` : `${first}${second}`;
}

function pickRareEpithetPool(
	mods: readonly MonsterModId[],
	lex: MonsterNameLexicon,
): readonly string[] {
	let resistCount = 0;
	let firstPrefix: PrefixMonsterModId | null = null;
	for (const id of mods) {
		if (isResistMod(id)) resistCount += 1;
		else if (isPrefixMod(id) && firstPrefix === null) firstPrefix = id;
	}
	if (resistCount >= 2) return lex.rareCompoundEpithets;
	if (firstPrefix !== null) return lex.rareEpithetsByPrefix[firstPrefix];
	return lex.rareCompoundEpithets;
}

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
