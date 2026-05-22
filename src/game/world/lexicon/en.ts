// English naming lexicon. No grammatical gender, no articles on suffix nouns
// — the renderer just stacks "<Adj> <Adj> <Base> of <Noun> and <Noun>".

import type {
	MonsterNameLexicon,
	PrefixMonsterModId,
	SuffixMonsterModId,
} from "./types";

const prefixAdj: Record<PrefixMonsterModId, string> = {
	monsterIncreasedLife: "Tough",
	monsterIncreasedDamage: "Vicious",
	monsterIncreasedEvasion: "Elusive",
	monsterAdditionalBarrier: "Warded",
	monsterMoreArmor: "Armored",
};

const suffixNoun: Record<SuffixMonsterModId, string> = {
	monsterIncreasedAttackSpeed: "Swiftness",
	monsterIncreasedAccuracy: "Precision",
	monsterColdResistance: "Frost",
	monsterFireResistance: "Flame",
	monsterLightningResistance: "Storm",
	monsterVoidResistance: "Void",
};

// Rare proper-name pools. First word stays capitalized, second word stays
// lowercase, then concatenated without a space ("Stonemaw", "Frostfang").
// Pool size is intentionally not huge — we want recognizable names, not a
// combinatorial explosion of forgettable strings.
const rareFirstWords: readonly string[] = [
	"Iron",
	"Stone",
	"Blood",
	"Bone",
	"Frost",
	"Storm",
	"Shadow",
	"Ash",
	"Fury",
	"Dread",
	"Void",
	"Doom",
	"Soul",
	"Death",
	"Grim",
];

const rareSecondWords: readonly string[] = [
	"maw",
	"fang",
	"claw",
	"hide",
	"eye",
	"gaze",
	"jaw",
	"blade",
	"hunter",
	"render",
	"breath",
	"heart",
];

const rareEpithetsByPrefix: Record<PrefixMonsterModId, readonly string[]> = {
	monsterIncreasedLife: [
		"the Tough",
		"the Resolute",
		"the Hardy",
		"the Stalwart",
	],
	monsterIncreasedDamage: [
		"the Furious",
		"the Vicious",
		"the Cruel",
		"the Savage",
	],
	monsterIncreasedEvasion: [
		"the Elusive",
		"the Fleeting",
		"the Spectral",
		"the Veiled",
	],
	monsterAdditionalBarrier: ["the Warded", "the Guarded", "the Shrouded"],
	monsterMoreArmor: ["the Armored", "the Ironclad", "the Plated"],
};

const rareCompoundEpithets: readonly string[] = [
	"the Unbroken",
	"the Resilient",
	"the Indomitable",
	"the Steadfast",
];

export const lexiconEn: MonsterNameLexicon = {
	prefixAdj,
	suffixNoun,
	compoundAdj: "Elemental Resistant",
	rareFirstWords,
	rareSecondWords,
	rareEpithetsByPrefix,
	rareCompoundEpithets,
};
