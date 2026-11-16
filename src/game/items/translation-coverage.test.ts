import { describe, expect, it } from "vitest";

import { getModifier, MODIFIER_IDS } from "./data/modifiers";
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

const ROLLABLE_EXPLICITS = MODIFIER_IDS.filter(
	(id) => getModifier(id).applicableTo.length > 0,
);

// Runtime affixType is the source of truth; affix-ids.ts mirrors it at type
// level. A drift between the two surfaces as a missing lexicon entry below.
const ROLLABLE_PREFIXES = ROLLABLE_EXPLICITS.filter(
	(id): id is PrefixModifierId => getModifier(id).affixType === "prefix",
);
const ROLLABLE_SUFFIXES = ROLLABLE_EXPLICITS.filter(
	(id): id is SuffixModifierId => getModifier(id).affixType === "suffix",
);

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
			expect(Object.hasOwn(PT_EXPLICIT_FORMATTERS, id)).toBe(true);
		});

		it("has no dead entries (every key resolves to a known modifier)", () => {
			const knownIds = new Set<string>(MODIFIER_IDS);
			const deadKeys = Object.keys(PT_EXPLICIT_FORMATTERS).filter(
				(key) => !knownIds.has(key),
			);
			expect(deadKeys).toEqual([]);
		});
	});
});
