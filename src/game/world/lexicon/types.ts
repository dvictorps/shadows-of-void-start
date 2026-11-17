import type { MonsterId, MonsterModId } from "#/game/monsters";

import type {
	GenderedForm,
	GrammaticalGender,
} from "../../i18n/lexicon-shared";

export type { GenderedForm, GrammaticalGender };

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

export interface MonsterNameLexicon {
	prefixAdj: Record<PrefixMonsterModId, string | GenderedForm>;
	suffixNoun: Record<SuffixMonsterModId, string | GenderedNoun>;
	compoundAdj: string;
	monsterGender?: Record<MonsterId, GrammaticalGender>;
	rareFirstWords: readonly string[];
	rareSecondWords: readonly string[];
	rareEpithetsByPrefix: Record<PrefixMonsterModId, readonly string[]>;
	rareCompoundEpithets: readonly string[];
}

export interface GenderedNoun {
	noun: string;
	gender: GrammaticalGender;
}
