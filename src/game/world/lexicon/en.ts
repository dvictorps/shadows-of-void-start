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

export const lexiconEn: MonsterNameLexicon = {
	prefixAdj,
	suffixNoun,
	compoundAdj: "Elemental Resistant",
};
