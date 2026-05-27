// Portuguese naming lexicon. Gender lives here because it's a grammatical
// property of how a monster's *name* is rendered in this language — not a
// property of the monster itself. The same monster can be masculine in PT
// and ungendered in EN, or even a different gender in another language.

import type { MonsterId } from "#/game/monsters";
import type {
	GenderedForm,
	GenderedNoun,
	MonsterNameLexicon,
	PrefixMonsterModId,
	SuffixMonsterModId,
} from "./types";

const monsterGender: Record<MonsterId, "m" | "f"> = {
	goblin: "m",
	slime: "m",
	macaco: "m",
	morcego: "m",
	serpente: "f",
	esqueleto: "m",
	esqueleto_armadurado: "m",
	esqueleto_lanca: "m",
	zumbi: "m",
	vampiro: "m",
	lich: "m",
	olho_do_vazio: "m",
	criatura_do_vazio: "f",
};

const prefixAdj: Record<PrefixMonsterModId, GenderedForm> = {
	monsterIncreasedLife: { m: "Robusto", f: "Robusta" },
	monsterIncreasedDamage: { m: "Furioso", f: "Furiosa" },
	monsterIncreasedEvasion: { m: "Esquivo", f: "Esquiva" },
	monsterAdditionalBarrier: { m: "Protegido", f: "Protegida" },
	monsterMoreArmor: { m: "Blindado", f: "Blindada" },
	monsterCriticalChanceIncrease: { m: "Mortífero", f: "Mortífera" },
	monsterColdDamage: { m: "Gélido", f: "Gélida" },
	monsterFireDamage: { m: "Flamejante", f: "Flamejante" },
	monsterLightningDamage: { m: "Crepitante", f: "Crepitante" },
	monsterVoidDamage: { m: "Sombrio", f: "Sombria" },
};

// Suffix nouns carry their own gender so the renderer can pick "do" (m) vs
// "da" (f). Two suffixes join with " e " in PT.
const suffixNoun: Record<SuffixMonsterModId, GenderedNoun> = {
	monsterIncreasedAttackSpeed: { noun: "Velocidade", gender: "f" },
	monsterIncreasedAccuracy: { noun: "Precisão", gender: "f" },
	monsterColdResistance: { noun: "Frio", gender: "m" },
	monsterFireResistance: { noun: "Fogo", gender: "m" },
	monsterLightningResistance: { noun: "Raio", gender: "m" },
	monsterVoidResistance: { noun: "Vazio", gender: "m" },
	monsterCriticalMultiplier: { noun: "Massacre", gender: "m" },
};

// Rare proper-name pools. Format: "<FirstNoun> <SecondPhrase>" with the
// preposition (de / do / da / das) baked into the second-pool entry so the
// renderer doesn't need to reason about gender/number for the linkage. The
// epithet is invariably masculine — see lexicon/README and the design notes
// in CONTEXT.md: monsters are genderless entities; words have gender, so
// adjective→noun concord stays in the *magic* naming, while the rare epithet
// is a referential title for the creature itself.
const rareFirstWords: readonly string[] = [
	"Braço",
	"Olho",
	"Crânio",
	"Punho",
	"Sopro",
	"Coração",
	"Garra",
	"Presa",
	"Mandíbula",
	"Cauda",
	"Lâmina",
	"Boca",
	"Pele",
	"Olhar",
	"Veneno",
];

const rareSecondWords: readonly string[] = [
	"de Sangue",
	"de Pedra",
	"de Aço",
	"de Ferro",
	"de Fogo",
	"de Gelo",
	"de Ossos",
	"de Espinhos",
	"do Vazio",
	"das Sombras",
	"das Trevas",
	"da Fúria",
	"da Morte",
	"do Inverno",
	"do Caos",
];

const rareEpithetsByPrefix: Record<PrefixMonsterModId, readonly string[]> = {
	monsterIncreasedLife: ["o Robusto", "o Resoluto", "o Vigoroso", "o Tenaz"],
	monsterIncreasedDamage: [
		"o Furioso",
		"o Cruel",
		"o Selvagem",
		"o Sanguinário",
	],
	monsterIncreasedEvasion: [
		"o Furtivo",
		"o Fugaz",
		"o Etéreo",
		"o Inalcançável",
	],
	monsterAdditionalBarrier: ["o Protegido", "o Velado", "o Resguardado"],
	monsterMoreArmor: ["o Blindado", "o Couraçado", "o Reforçado"],
	monsterCriticalChanceIncrease: [
		"o Mortífero",
		"o Letal",
		"o Preciso",
		"o Sangrento",
	],
	monsterColdDamage: ["o Gélido", "o Glacial", "o Congelante", "o Invernal"],
	monsterFireDamage: [
		"o Flamejante",
		"o Ardente",
		"o Incandescente",
		"o Inferno",
	],
	monsterLightningDamage: [
		"o Crepitante",
		"o Tempestuoso",
		"o Fulgurante",
		"o Eletrizante",
	],
	monsterVoidDamage: ["o Sombrio", "o Profano", "o Maculado", "o Aberrante"],
};

const rareCompoundEpithets: readonly string[] = [
	"o Inquebrável",
	"o Inabalável",
	"o Resiliente",
];

export const lexiconPt: MonsterNameLexicon = {
	monsterGender,
	prefixAdj,
	suffixNoun,
	// "Resistente a Elementos" is invariable in PT (Resistente reads the same
	// for either gender), so a single string serves both.
	compoundAdj: "Resistente a Elementos",
	rareFirstWords,
	rareSecondWords,
	rareEpithetsByPrefix,
	rareCompoundEpithets,
};
