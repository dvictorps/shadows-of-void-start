import { describe, expect, it } from "vitest";
import { MODIFIERS } from "./data/modifiers";
import type {
	PrefixModifierId,
	SuffixModifierId,
} from "./data/modifiers/affix-ids";
import { lexiconEn } from "./lexicon/en";
import { lexiconPt } from "./lexicon/pt";
import { PT_EXPLICIT_FORMATTERS } from "./mod-i18n";

// Cross-coverage check: a modifier that can roll as an explicit must have a
// translation entry in every place a tooltip / name renderer reaches into.
// Without this, adding a modifier without its lexicon + mod-i18n entries
// silently falls back to the raw id at display time. Implicit-only mods
// (applicableTo: []) render via PT_IMPLICIT_PATTERNS (regex on description)
// and are out of scope here.

const ROLLABLE_EXPLICITS = Object.keys(MODIFIERS).filter(
	(id) => MODIFIERS[id].applicableTo.length > 0,
);

const ROLLABLE_PREFIXES = ROLLABLE_EXPLICITS.filter(
	(id) => MODIFIERS[id].affixType === "prefix",
) as PrefixModifierId[];
const ROLLABLE_SUFFIXES = ROLLABLE_EXPLICITS.filter(
	(id) => MODIFIERS[id].affixType === "suffix",
) as SuffixModifierId[];

describe("translation coverage", () => {
	describe.each([
		["EN", lexiconEn],
		["PT", lexiconPt],
	] as const)("%s lexicon", (_locale, lex) => {
		it.each(ROLLABLE_PREFIXES)("has prefixForms entry for %s", (id) => {
			expect(lex.prefixForms[id]).toBeDefined();
		});

		it.each(ROLLABLE_SUFFIXES)("has suffixPhrases entry for %s", (id) => {
			expect(lex.suffixPhrases[id]).toBeDefined();
		});
	});

	describe("PT explicit formatters (mod-i18n)", () => {
		it.each(ROLLABLE_EXPLICITS)("has formatter for %s", (id) => {
			expect(PT_EXPLICIT_FORMATTERS[id]).toBeDefined();
		});

		it("has no dead entries (every key resolves to a known modifier)", () => {
			const knownIds = new Set(Object.keys(MODIFIERS));
			const deadKeys = Object.keys(PT_EXPLICIT_FORMATTERS).filter(
				(key) => !knownIds.has(key),
			);
			expect(deadKeys).toEqual([]);
		});
	});
});
