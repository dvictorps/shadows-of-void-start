// Naming-lexicon types shared by all locales. Each language defines its own
// concrete tables in lexicon/<locale>.ts. Monster data (sprite, stats, id) is
// kept language-neutral in src/game/monsters; anything that's a grammar
// concern — gender, articles, adjective inflection — lives here.

import type { MonsterId, MonsterModId } from "#/game/monsters";

export type GrammaticalGender = "m" | "f";

// Adjectival mods (PoE-style "Tough <Base>" / "<Base> Furioso"). The cap on
// what counts as a prefix is set in game data (MONSTER_MODIFIERS[id].affixType
// === "prefix"); the lexicon only has to translate the five known prefixes.
export type PrefixMonsterModId = Extract<
	MonsterModId,
	| "monsterIncreasedLife"
	| "monsterIncreasedDamage"
	| "monsterIncreasedEvasion"
	| "monsterAdditionalBarrier"
	| "monsterMoreArmor"
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
>;

// What each locale must provide. Gender is optional because most languages
// don't have grammatical gender; the EN lexicon omits it entirely.
export interface MonsterNameLexicon {
	prefixAdj: Record<PrefixMonsterModId, string | GenderedForm>;
	suffixNoun: Record<SuffixMonsterModId, string | GenderedNoun>;
	compoundAdj: string;
	// Optional — only filled by languages that need it (PT, ES, FR, etc.).
	monsterGender?: Record<MonsterId, GrammaticalGender>;
}

export interface GenderedForm {
	m: string;
	f: string;
}

export interface GenderedNoun {
	noun: string;
	gender: GrammaticalGender;
}
