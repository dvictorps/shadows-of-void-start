import { pickGendered } from "#/game/i18n/lexicon-shared";
import { getLocale } from "#/paraglide/runtime";
import { lexiconEn } from "./lexicon/en";
import { lexiconPt } from "./lexicon/pt";
import type { ItemNameLexicon } from "./lexicon/types";
import type { GeneratedItem } from "./types";

// Localized display name for an item. Renders at display time from
// templateId + explicits + item.id (UUID). Stays stable across renders
// and locale switches — only the strings change.
//
// Rarity dispatch:
//   normal               → template name
//   magic                → prefix + base + suffix (locale-specific order)
//   rare/legendary/epic  → two-word proper name seeded by item.id (UUID),
//                          so each item carries the same name forever
//                          even though no name is stored on the row.
//
// Unknown ids (template/modifier missing from the active lexicon) fall
// back to the id string — a deliberately ugly signal that the lexicon
// needs an entry.

type Locale = "en" | "pt";

function selectLexicon(locale: Locale): ItemNameLexicon {
	return locale === "pt" ? lexiconPt : lexiconEn;
}

export function translateItemName(item: GeneratedItem): string {
	const locale: Locale = getLocale() === "pt" ? "pt" : "en";
	const lex = selectLexicon(locale);
	const base = lex.templateNames[item.templateId] ?? item.templateId;
	if (item.rarity === "normal") return base;
	if (item.rarity === "magic") return renderMagicName(item, lex, locale, base);
	return renderProperName(item, lex);
}

// Public for the tooltip subtitle on rare+ items (template name underneath
// the generated proper name).
export function translateTemplateName(item: GeneratedItem): string {
	const lex = selectLexicon(getLocale() === "pt" ? "pt" : "en");
	return lex.templateNames[item.templateId] ?? item.templateId;
}

function renderMagicName(
	item: GeneratedItem,
	lex: ItemNameLexicon,
	locale: Locale,
	base: string,
): string {
	const prefix = item.explicits.find((e) => e.affixType === "prefix");
	const suffix = item.explicits.find((e) => e.affixType === "suffix");
	const gender =
		locale === "pt" ? (lex.templateGender?.[item.templateId] ?? "m") : "m";
	const prefixWord = prefix
		? (() => {
				const form = lex.prefixForms[prefix.modifierId];
				return form ? pickGendered(form, gender) : prefix.modifierId;
			})()
		: null;
	const suffixWord = suffix
		? (lex.suffixPhrases[suffix.modifierId] ?? suffix.modifierId)
		: null;

	const parts =
		locale === "pt"
			? [base, prefixWord, suffixWord]
			: [prefixWord, base, suffixWord];
	return parts.filter((p): p is string => p != null).join(" ");
}

function renderProperName(item: GeneratedItem, lex: ItemNameLexicon): string {
	const [h1, h2] = hashItemId(item.id);
	const first = lex.rareFirstWords[Math.floor(h1 * lex.rareFirstWords.length)];
	const second =
		lex.rareSecondWords[Math.floor(h2 * lex.rareSecondWords.length)];
	return `${first} ${second}`;
}

// Two independent [0, 1) values from the item's UUID. Forward + reverse FNV-1a
// walks decouple the indices so pool sizes that share factors don't collapse
// onto the same slot.
function hashItemId(id: string): [number, number] {
	let h1 = 2166136261;
	let h2 = 2166136261;
	for (let i = 0; i < id.length; i++) {
		h1 = Math.imul(h1 ^ id.charCodeAt(i), 16777619);
	}
	for (let i = id.length - 1; i >= 0; i--) {
		h2 = Math.imul(h2 ^ id.charCodeAt(i), 16777619);
	}
	return [(h1 >>> 0) / 4294967296, (h2 >>> 0) / 4294967296];
}
