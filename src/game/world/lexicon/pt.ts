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

// "Resistente" was the previous Life mod; it collided with the elemental
// compound ("Resistente a Elementos"). "Robusto/Robusta" sidesteps that and
// also reads more naturally as a creature descriptor.
const prefixAdj: Record<PrefixMonsterModId, GenderedForm> = {
	monsterIncreasedLife: { m: "Robusto", f: "Robusta" },
	monsterIncreasedDamage: { m: "Furioso", f: "Furiosa" },
	monsterIncreasedEvasion: { m: "Esquivo", f: "Esquiva" },
	monsterAdditionalBarrier: { m: "Barreirado", f: "Barreirada" },
	monsterMoreArmor: { m: "Blindado", f: "Blindada" },
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
};

export const lexiconPt: MonsterNameLexicon = {
	monsterGender,
	prefixAdj,
	suffixNoun,
	// "Resistente a Elementos" is invariable in PT (Resistente reads the same
	// for either gender), so a single string serves both.
	compoundAdj: "Resistente a Elementos",
};
