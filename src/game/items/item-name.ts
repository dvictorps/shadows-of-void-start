import { pickGendered } from "#/game/i18n/lexicon-shared";
import { getLocale } from "#/paraglide/runtime";
import { lexiconEn } from "./lexicon/en";
import { lexiconPt } from "./lexicon/pt";
import type {
	TemplateBaseId,
	TemplateModifierId,
} from "./lexicon/template-ids";
import type { ItemNameLexicon } from "./lexicon/types";
import type { GeneratedItem } from "./types";

// Localized display name for an item, rendered at display time from
// templateId / nameBase / nameModifier / explicits / item.id.
//
// Composition (all rarities except rare+):
//   1. Base name = `<modifier> <base>` (EN) or `<base> <modifier>` (PT,
//      modifier inflects to base.gender if it's an adjective).
//   2. Magic items also append the rolled prefix + suffix:
//        EN: `<prefix> <base name> <suffix>`
//        PT: `<base name> <prefix-gendered> <suffix>`
//
// Rare/legendary/epic skip the base composition entirely and use a UUID-
// seeded two-word proper name from the locale's rare pools. Same item.id →
// same name forever; locale switch picks the equivalent slot in the other
// pool.

type Locale = "en" | "pt";

function selectLexicon(locale: Locale): ItemNameLexicon {
	return locale === "pt" ? lexiconPt : lexiconEn;
}

function currentLocale(): Locale {
	return getLocale() === "pt" ? "pt" : "en";
}

export function translateItemName(item: GeneratedItem): string {
	const locale = currentLocale();
	const lex = selectLexicon(locale);
	if (
		item.rarity === "rare" ||
		item.rarity === "legendary" ||
		item.rarity === "epic"
	) {
		return renderProperName(item, lex);
	}
	const baseName = renderBaseName(item, lex, locale);
	if (item.rarity === "normal") return baseName;
	return appendMagicAffixes(item, lex, locale, baseName);
}

// Public for the tooltip subtitle on rare+ items (template name underneath
// the generated proper name).
export function translateTemplateName(item: GeneratedItem): string {
	const locale = currentLocale();
	return renderBaseName(item, selectLexicon(locale), locale);
}

function renderBaseName(
	item: GeneratedItem,
	lex: ItemNameLexicon,
	locale: Locale,
): string {
	if (!item.nameBase) return item.templateId;
	const baseEntry = lex.bases[item.nameBase as TemplateBaseId];
	if (!baseEntry) return item.templateId;
	const baseName = baseEntry.name;
	if (item.nameModifier == null) return baseName;
	const modifier = lex.modifiers[item.nameModifier as TemplateModifierId];
	if (!modifier) return baseName;
	const gender = baseEntry.gender ?? "m";
	const modifierWord = pickGendered(modifier, gender);
	return locale === "pt"
		? `${baseName} ${modifierWord}`
		: `${modifierWord} ${baseName}`;
}

function appendMagicAffixes(
	item: GeneratedItem,
	lex: ItemNameLexicon,
	locale: Locale,
	baseName: string,
): string {
	const prefix = item.explicits.find((e) => e.affixType === "prefix");
	const suffix = item.explicits.find((e) => e.affixType === "suffix");
	const gender =
		locale === "pt" && item.nameBase
			? (lex.bases[item.nameBase as TemplateBaseId]?.gender ?? "m")
			: "m";
	const prefixWord = prefix
		? (renderAffixPrefix(lex, prefix.modifierId, gender) ?? prefix.modifierId)
		: null;
	const suffixWord = suffix
		? (lex.suffixPhrases[suffix.modifierId as keyof typeof lex.suffixPhrases] ??
			suffix.modifierId)
		: null;
	const parts =
		locale === "pt"
			? [baseName, prefixWord, suffixWord]
			: [prefixWord, baseName, suffixWord];
	return parts.filter((p): p is string => p != null).join(" ");
}

function renderAffixPrefix(
	lex: ItemNameLexicon,
	modifierId: string,
	gender: "m" | "f",
): string | null {
	const form = lex.prefixForms[modifierId as keyof typeof lex.prefixForms];
	if (form == null) return null;
	return pickGendered(form, gender);
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
