import Modal from "#/components/Modal";
import { m } from "#/paraglide/messages";
import {
	getLocale,
	type Locale,
	locales,
	setLocale,
} from "#/paraglide/runtime";

type Props = {
	isOpen: boolean;
	onClose: () => void;
};

function localeLabel(locale: string): string {
	if (locale === "pt") return m.language_pt();
	if (locale === "en") return m.language_en();
	return locale.toUpperCase();
}

export default function SettingsModal({ isOpen, onClose }: Props) {
	const current = getLocale();

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={m.settings_title()}
			className="max-w-md"
		>
			<div className="space-y-5">
				<label className="block">
					<span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-white/60">
						{m.settings_language()}
					</span>
					<select
						value={current}
						onChange={(e) => {
							const next = e.target.value as Locale;
							if (next !== current) setLocale(next);
						}}
						className="w-full border border-white/30 bg-black px-3 py-2 text-sm uppercase tracking-wider text-white outline-none transition focus:border-white"
					>
						{locales.map((locale) => (
							<option key={locale} value={locale} className="bg-black">
								{localeLabel(locale)}
							</option>
						))}
					</select>
				</label>
			</div>
		</Modal>
	);
}
