import Modal from "#/components/Modal";
import { Slider } from "#/components/ui/slider";
import { useSfxVolume } from "#/hooks/useSfxVolume";
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
	const [sfxVolume, setSfxVolume] = useSfxVolume();
	const sfxVolumePct = Math.round(sfxVolume * 100);

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

				<div>
					<div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/60">
						<span>{m.settings_sfx_volume()}</span>
						<span className="tabular-nums text-white/80">{sfxVolumePct}%</span>
					</div>
					<Slider
						value={[sfxVolumePct]}
						min={0}
						max={100}
						step={1}
						onValueChange={(values) => {
							const next = values[0];
							if (typeof next === "number") setSfxVolume(next / 100);
						}}
						aria-label={m.settings_sfx_volume()}
					/>
				</div>
			</div>
		</Modal>
	);
}
