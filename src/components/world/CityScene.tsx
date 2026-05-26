import { Archive, ArrowLeft, Store } from "lucide-react";
import { m } from "#/paraglide/messages";

type Props = {
	cityName: string;
	onLeave: () => void;
	onOpenVendor: () => void;
	onOpenStash: () => void;
};

export default function CityScene({ cityName, onLeave, onOpenVendor, onOpenStash }: Props) {
	return (
		<section className="relative flex flex-col items-center justify-center rounded-md border border-white/40 bg-black p-8">
			{/* Vertically-centered vendor button on the left edge — the city's
			 * primary CTA. Stacks icon + label as a chunky tile (~3x the size
			 * of the corner controls). */}
			<button
				type="button"
				onClick={onOpenVendor}
				aria-label={m.city_open_vendor()}
				className="-translate-y-1/2 absolute top-1/2 left-8 inline-flex flex-col items-center gap-2 border-2 border-white/40 bg-black px-6 py-5 font-medium text-white/80 uppercase tracking-[0.2em] transition hover:border-white hover:bg-white/10 hover:text-white"
			>
				<Store className="h-12 w-12" strokeWidth={1.5} />
				<span className="display-title text-base">
					{m.city_vendor_label()}
				</span>
			</button>

			<button
				type="button"
				onClick={onOpenStash}
				aria-label={m.city_open_stash()}
				className="-translate-y-1/2 absolute top-1/2 right-8 inline-flex flex-col items-center gap-2 border-2 border-white/40 bg-black px-6 py-5 font-medium text-white/80 uppercase tracking-[0.2em] transition hover:border-white hover:bg-white/10 hover:text-white"
			>
				<Archive className="h-12 w-12" strokeWidth={1.5} />
				<span className="display-title text-base">
					{m.city_stash_label()}
				</span>
			</button>

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
