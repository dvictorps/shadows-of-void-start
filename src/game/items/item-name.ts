import { pickGendered } from "#/game/i18n/lexicon-shared";
import { hasOwnKey } from "#/game/typed-object";
import { hashStringToUnit } from "#/lib/rng";
import { getLocale } from "#/paraglide/runtime";

import { lexiconEn } from "./lexicon/en";
import { lexiconPt } from "./lexicon/pt";
import type { BaseEntry, ItemNameLexicon } from "./lexicon/types";
import type { GeneratedItem } from "./types";

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

export function translateTemplateName(item: GeneratedItem): string {
	const locale = currentLocale();
	return renderBaseName(item, selectLexicon(locale), locale);
}

function renderBaseName(
	item: GeneratedItem,
	lex: ItemNameLexicon,
	locale: Locale,
): string {
	const baseEntry = findBaseEntry(item, lex);
	if (!baseEntry) return item.templateId;
	const baseName = baseEntry.name;
	if (item.nameModifier == null) return baseName;
	const modifier = hasOwnKey(lex.modifiers, item.nameModifier)
		? lex.modifiers[item.nameModifier]
		: undefined;
	if (!modifier) return baseName;
	const gender = baseEntry.gender ?? "m";
	const modifierWord = pickGendered(modifier, gender);
	return locale === "pt"
		? `${baseName} ${modifierWord}`
		: `${modifierWord} ${baseName}`;
}

function findBaseEntry(
	item: GeneratedItem,
	lex: ItemNameLexicon,
): BaseEntry | undefined {
	if (!item.nameBase || !hasOwnKey(lex.bases, item.nameBase)) return undefined;
	return lex.bases[item.nameBase];
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
			? (findBaseEntry(item, lex)?.gender ?? "m")
			: "m";
	const prefixWord = prefix
		? (renderAffixPrefix(lex, prefix.modifierId, gender) ?? prefix.modifierId)
		: null;
	const suffixWord = suffix
		? ((hasOwnKey(lex.suffixPhrases, suffix.modifierId)
				? lex.suffixPhrases[suffix.modifierId]
				: undefined) ?? suffix.modifierId)
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
	if (!hasOwnKey(lex.prefixForms, modifierId)) return null;
	const form = lex.prefixForms[modifierId];
	if (form == null) return null;
	return pickGendered(form, gender);
}

function renderProperName(item: GeneratedItem, lex: ItemNameLexicon): string {
	const h1 = hashStringToUnit(item.id, 0);
	const h2 = hashStringToUnit(item.id, 1);
	const first = lex.rareFirstWords[Math.floor(h1 * lex.rareFirstWords.length)];
	const second =
		lex.rareSecondWords[Math.floor(h2 * lex.rareSecondWords.length)];
	return `${first} ${second}`;
}
