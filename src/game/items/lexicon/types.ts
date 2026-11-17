import type {
	GenderedForm,
	GrammaticalGender,
} from "#/game/i18n/lexicon-shared";

import type {
	PrefixModifierId,
	SuffixModifierId,
} from "../data/modifiers/affix-ids";
import type { TemplateBaseId, TemplateModifierId } from "./template-ids";

export type { GenderedForm, GrammaticalGender };

export interface BaseEntry {
	name: string;
	gender?: GrammaticalGender;
}

export type ModifierForm = string | GenderedForm;

export interface ItemNameLexicon {
	bases: Record<TemplateBaseId, BaseEntry>;
	modifiers: Record<TemplateModifierId, ModifierForm>;
	prefixForms: Partial<Record<PrefixModifierId, ModifierForm>>;
	suffixPhrases: Partial<Record<SuffixModifierId, string>>;
	rareFirstWords: readonly string[];
	rareSecondWords: readonly string[];
}
