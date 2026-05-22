import type {
	GenderedForm,
	GrammaticalGender,
} from "#/game/i18n/lexicon-shared";

import type {
	PrefixModifierId,
	SuffixModifierId,
} from "../data/modifiers/affix-ids";
import type { TemplateBaseId, TemplateModifierId } from "./template-ids";

// Re-exported so per-locale lexicons don't have to know about the shared
// primitives' path.
export type { GenderedForm, GrammaticalGender };

// PT bases carry grammatical gender to drive adjective concord on the
// modifier; EN bases omit it (no inflection).
export interface BaseEntry {
	name: string;
	gender?: GrammaticalGender;
}

// PT modifiers are either invariant phrases ("de Ferro", "do Soldado") or
// gendered adjectives ("Sagrado/Sagrada"). EN modifiers are always invariant.
export type ModifierForm = string | GenderedForm;

// Decomposed naming lexicon. Every template id reduces to a (base, modifier)
// tuple; the renderer composes them per locale. Records keyed by the literal
// unions enforce coverage at compile time — a new base/modifier without a
// lexicon entry is a build error.
export interface ItemNameLexicon {
	bases: Record<TemplateBaseId, BaseEntry>;
	modifiers: Record<TemplateModifierId, ModifierForm>;
	// Magic-item affix forms, separate from the template-name modifiers.
	// Partial because tomes / quivers expose modifier ids that never roll as
	// rolled affixes (drift-safe via the union types).
	prefixForms: Partial<Record<PrefixModifierId, ModifierForm>>;
	suffixPhrases: Partial<Record<SuffixModifierId, string>>;
	rareFirstWords: readonly string[];
	rareSecondWords: readonly string[];
}
