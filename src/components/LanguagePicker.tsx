import { Button } from "#/components/ui/button";
import { m } from "#/paraglide/messages";
import { getLocale, locales, setLocale } from "#/paraglide/runtime";

type Locale = (typeof locales)[number];

const LOCALE_LABEL = {
	pt: m.language_pt,
	en: m.language_en,
} satisfies Record<Locale, () => string>;

export default function LanguagePicker() {
	const current = getLocale();
	return (
		<div role="group" aria-label={m.settings_language()} className="flex gap-2">
			{locales.map((locale) => (
				<Button
					key={locale}
					type="button"
					variant="toggle"
					size="sm"
					aria-pressed={locale === current}
					onClick={() => {
						if (locale !== current) void setLocale(locale);
					}}
				>
					{LOCALE_LABEL[locale]()}
				</Button>
			))}
		</div>
	);
}
