import type {
	GenderedForm,
	GrammaticalGender,
} from "#/game/i18n/lexicon-shared";

import type { ModifierId } from "../data/modifiers";

// Re-exported so per-locale lexicons don't have to know about the shared
// primitives' path.
export type { GenderedForm, GrammaticalGender };

// Item-naming lexicon contract — one implementation per locale. Template
// names stay loosely keyed (EquipmentTemplate.id is `string`, not a literal
// union) but modifier-keyed records are tightened to ModifierId so a new
// affix that forgets a lexicon entry fails at compile time, not at runtime.

export interface ItemNameLexicon {
	templateNames: Record<string, string>;
	prefixForms: Partial<Record<ModifierId, string | GenderedForm>>;
	suffixPhrases: Partial<Record<ModifierId, string>>;
	rareFirstWords: readonly string[];
	rareSecondWords: readonly string[];
	templateGender?: Record<string, GrammaticalGender>;
}
