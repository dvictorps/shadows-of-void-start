import type {
	MonsterNameLexicon,
	PrefixMonsterModId,
	SuffixMonsterModId,
} from "./types";

const prefixAdj = {
	monsterIncreasedLife: "Tough",
	monsterIncreasedDamage: "Vicious",
	monsterIncreasedEvasion: "Elusive",
	monsterAdditionalBarrier: "Warded",
	monsterMoreArmor: "Armored",
	monsterCriticalChanceIncrease: "Deadly",
	monsterColdDamage: "Frostbitten",
	monsterFireDamage: "Burning",
	monsterLightningDamage: "Sparking",
	monsterVoidDamage: "Voidtouched",
} satisfies Record<PrefixMonsterModId, string>;

const suffixNoun = {
	monsterIncreasedAttackSpeed: "Swiftness",
	monsterIncreasedAccuracy: "Precision",
	monsterColdResistance: "Frost",
	monsterFireResistance: "Flame",
	monsterLightningResistance: "Storm",
	monsterVoidResistance: "Void",
	monsterCriticalMultiplier: "Slaughter",
} satisfies Record<SuffixMonsterModId, string>;

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

const rareEpithetsByPrefix = {
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
	monsterCriticalChanceIncrease: [
		"the Deadly",
		"the Lethal",
		"the Razor-Sharp",
		"the Precise",
	],
	monsterColdDamage: [
		"the Frostbitten",
		"the Glacial",
		"the Frozen-Hearted",
		"the Winterborn",
	],
	monsterFireDamage: [
		"the Burning",
		"the Searing",
		"the Ember-Cloaked",
		"the Hellfire",
	],
	monsterLightningDamage: [
		"the Sparking",
		"the Storm-Forged",
		"the Thunderstruck",
		"the Galvanic",
	],
	monsterVoidDamage: [
		"the Voidtouched",
		"the Tainted",
		"the Hollow-Eyed",
		"the Cursed",
	],
} satisfies Record<PrefixMonsterModId, readonly string[]>;

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
