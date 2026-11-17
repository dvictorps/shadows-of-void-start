import { getLocale, type Locale } from "#/paraglide/runtime";

const INTL_LOCALE = { pt: "pt-BR", en: "en-US" } satisfies Record<
	Locale,
	string
>;

export function intlLocale(): string {
	return INTL_LOCALE[getLocale()];
}

export function formatDate(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleDateString(intlLocale(), {
		year: "numeric",
		month: "short",
		day: "2-digit",
	});
}
