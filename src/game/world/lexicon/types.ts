// Naming-lexicon types shared by all locales. Each language defines its own
// concrete tables in lexicon/<locale>.ts. Monster data (sprite, stats, id) is
// kept language-neutral in src/game/monsters; anything that's a grammar
// concern — gender, articles, adjective inflection — lives here.

import type { MonsterId, MonsterModId } from "#/game/monsters";

import type {
	GenderedForm,
	GrammaticalGender,
} from "../../i18n/lexicon-shared";

export type { GenderedForm, GrammaticalGender };

// Adjectival mods (PoE-style "Tough <Base>" / "<Base> Furioso"). The cap on
// what counts as a prefix is set in game data (MONSTER_MODIFIERS[id].affixType
// === "prefix"); the lexicon must translate every prefix that exists so
// `Record<PrefixMonsterModId, …>` compile-checks every locale to a complete
// table. Adding a new prefix mod = add it here, fix the resulting type errors.
export type PrefixMonsterModId = Extract<
	MonsterModId,
	| "monsterIncreasedLife"
	| "monsterIncreasedDamage"
	| "monsterIncreasedEvasion"
	| "monsterAdditionalBarrier"
	| "monsterMoreArmor"
	| "monsterCriticalChanceIncrease"
	| "monsterColdDamage"
	| "monsterFireDamage"
	| "monsterLightningDamage"
	| "monsterVoidDamage"
>;

// Noun mods rendered as suffix ("of <noun>" / "de <noun>"). Resistances are
// modeled as suffix-nouns and may also collapse into the compound name when
// two or more roll on the same spawn — that behavior lives in the renderer,
// not here.
export type SuffixMonsterModId = Extract<
	MonsterModId,
	| "monsterIncreasedAttackSpeed"
	| "monsterIncreasedAccuracy"
	| "monsterColdResistance"
	| "monsterFireResistance"
	| "monsterLightningResistance"
	| "monsterVoidResistance"
	| "monsterCriticalMultiplier"
>;

// What each locale must provide. Gender is optional because most languages
// don't have grammatical gender; the EN lexicon omits it entirely.
//
// The `rare*` fields drive the **proper-name** system used for rare (miniboss)
// spawns — instead of stacking mod adjectives, rares get a randomly-composed
// name from two word pools plus an epithet derived from their top mod.
// See `translateEnemyName` in i18n.ts.
export interface MonsterNameLexicon {
	prefixAdj: Record<PrefixMonsterModId, string | GenderedForm>;
	suffixNoun: Record<SuffixMonsterModId, string | GenderedNoun>;
	compoundAdj: string;
	// Optional — only filled by languages that need it (PT, ES, FR, etc.).
	monsterGender?: Record<MonsterId, GrammaticalGender>;
	// Pools for rare proper-name generation. EN joins the two words into a
	// compound ("Stonemaw"); PT renders them as "<Noun1> <de/do/da Noun2>"
	// where the second-pool entries carry the preposition baked in.
	rareFirstWords: readonly string[];
	rareSecondWords: readonly string[];
	// Epithet variants per prefix mod. Picked by seed to add variety while
	// preserving the mod-signal ("the Furious" / "the Vicious" both mean
	// IncreasedDamage). Required: at least one entry per prefix.
	rareEpithetsByPrefix: Record<PrefixMonsterModId, readonly string[]>;
	// Epithets used when 2+ elemental resistances collapse into the compound
	// rule. Same variety mechanism.
	rareCompoundEpithets: readonly string[];
}

export interface GenderedNoun {
	noun: string;
	gender: GrammaticalGender;
}
