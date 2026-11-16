// Primitives shared by every naming lexicon in the game (monsters, items,
// future zones if their names ever become noun phrases). Anything that's a
// grammatical concern — gender, articles, adjective inflection — anchors
// here. Per-domain lexicons (src/game/world/lexicon/, src/game/items/lexicon/)
// build on top.

export type GrammaticalGender = "m" | "f";

export interface GenderedForm {
	m: string;
	f: string;
}

export function isGenderedForm(form: string | GenderedForm): form is GenderedForm {
	return typeof form !== "string";
}

// Resolve a possibly-gendered form to its concrete string for the given noun
// gender. Strings (locales without gender concord) pass through unchanged.
export function pickGendered(
	form: string | GenderedForm,
	gender: GrammaticalGender,
): string {
	return isGenderedForm(form) ? form[gender] : form;
}
