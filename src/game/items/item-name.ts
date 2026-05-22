import { getLocale } from "#/paraglide/runtime";
import { lexiconEn } from "./lexicon/en";
import { lexiconPt } from "./lexicon/pt";
import type {
	GenderedForm,
	GrammaticalGender,
	ItemNameLexicon,
} from "./lexicon/types";
import type { GeneratedItem } from "./types";

// Localized display name for an item. Renders at display time from
// stored data (templateId, prefix/suffix modifier ids, item.id). Stays
// stable for a given item across renders and across locale switches —
// only the strings change.
//
// Rarity dispatch:
//   normal               → template name
//   magic                → prefix + base + suffix (locale-specific order)
//   rare/legendary/epic  → two-word proper name seeded by item.id (UUID),
//                          so each item carries the same name forever
//                          even though no name is stored on the row.
//
// Falls back gracefully for unknown ids — uses the templateId/modifierId
// itself as the rendered string. Means a new base added without a lexicon
// entry shows up as its id (very obvious) instead of crashing.

export function translateItemName(item: GeneratedItem): string {
	const lex = getLocale() === "pt" ? lexiconPt : lexiconEn;
	const base = lex.templateNames[item.templateId] ?? item.templateId;
	if (item.rarity === "normal") return base;
	if (item.rarity === "magic") return renderMagicName(item, lex, base);
	return renderProperName(item, lex);
}

// Public for the tooltip subtitle on rare+ items (shows the template name
// underneath the generated proper name).
export function translateTemplateName(item: GeneratedItem): string {
	const lex = getLocale() === "pt" ? lexiconPt : lexiconEn;
	return lex.templateNames[item.templateId] ?? item.templateId;
}

function renderMagicName(
	item: GeneratedItem,
	lex: ItemNameLexicon,
	base: string,
): string {
	const prefix = item.explicits.find((e) => e.affixType === "prefix");
	const suffix = item.explicits.find((e) => e.affixType === "suffix");
	const isPt = lex === lexiconPt;
	const parts: string[] = [];

	if (isPt) {
		const gender = lex.templateGender?.[item.templateId] ?? "m";
		parts.push(base);
		if (prefix)
			parts.push(
				pickGendered(
					lex.prefixForms[prefix.modifierId],
					gender,
					prefix.modifierId,
				),
			);
		if (suffix)
			parts.push(lex.suffixPhrases[suffix.modifierId] ?? suffix.modifierId);
	} else {
		if (prefix)
			parts.push(
				pickGendered(
					lex.prefixForms[prefix.modifierId],
					"m",
					prefix.modifierId,
				),
			);
		parts.push(base);
		if (suffix)
			parts.push(lex.suffixPhrases[suffix.modifierId] ?? suffix.modifierId);
	}
	return parts.join(" ");
}

function renderProperName(item: GeneratedItem, lex: ItemNameLexicon): string {
	const [h1, h2] = hashItemId(item.id);
	const first = lex.rareFirstWords[Math.floor(h1 * lex.rareFirstWords.length)];
	const second =
		lex.rareSecondWords[Math.floor(h2 * lex.rareSecondWords.length)];
	return `${first} ${second}`;
}

function pickGendered(
	form: string | GenderedForm | undefined,
	gender: GrammaticalGender,
	fallback: string,
): string {
	if (form == null) return fallback;
	return typeof form === "string" ? form : form[gender];
}

// Two independent [0, 1) values derived from the item's UUID. The two
// walks (forward + reverse) decouple the indices so pool sizes that share
// a factor don't collapse onto the same slot.
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
