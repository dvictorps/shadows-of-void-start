import LanguagePicker from "#/components/LanguagePicker";
import Modal from "#/components/Modal";
import { Slider } from "#/components/ui/slider";
import { useSfxVolume } from "#/hooks/useSfxVolume";
import { m } from "#/paraglide/messages";

type Props = {
	isOpen: boolean;
	onClose: () => void;
};

export default function SettingsModal({ isOpen, onClose }: Props) {
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
				<div>
					<span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-white/60">
						{m.settings_language()}
					</span>
					<LanguagePicker />
				</div>

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
							if (next !== undefined) setSfxVolume(next / 100);
						}}
						aria-label={m.settings_sfx_volume()}
					/>
				</div>
			</div>
		</Modal>
	);
}
