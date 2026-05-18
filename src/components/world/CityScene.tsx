import { ArrowLeft } from "lucide-react";
import { m } from "#/paraglide/messages";

type Props = {
	cityName: string;
	onLeave: () => void;
};

export default function CityScene({ cityName, onLeave }: Props) {
	return (
		<section className="relative flex flex-col items-center justify-center rounded-md border border-white/40 bg-black p-8">
			{/* Top-right back button — mirrors the combat-view retreat affordance so
			 * the player has a consistent "leave area" pattern across views. */}
			<button
				type="button"
				onClick={onLeave}
				aria-label={m.back_to_map()}
				className="absolute top-3 right-3 inline-flex items-center gap-1.5 border border-white/40 bg-black px-3 py-1.5 font-medium text-[10px] text-white/80 uppercase tracking-wider transition hover:border-white hover:bg-white/10 hover:text-white"
			>
				<ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
				{m.back()}
			</button>

			<div className="display-title text-3xl uppercase tracking-[0.2em] text-white">
				{cityName}
			</div>
			<p className="mt-3 text-sm uppercase tracking-wider text-white/50">
				{m.city_safe_zone()}
			</p>
			<p className="mt-1 max-w-sm text-center text-xs text-white/40">
				{m.city_description()}
			</p>
		</section>
	);
}
