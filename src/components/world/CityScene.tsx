import { Button } from "#/components/ui/button";
import { m } from "#/paraglide/messages";

type Props = {
	cityName: string;
	onLeave: () => void;
};

export default function CityScene({ cityName, onLeave }: Props) {
	return (
		<section className="relative flex flex-col items-center justify-center rounded-md border border-white/40 bg-black p-8">
			<div className="display-title text-3xl uppercase tracking-[0.2em] text-white">
				{cityName}
			</div>
			<p className="mt-3 text-sm uppercase tracking-wider text-white/50">
				{m.city_safe_zone()}
			</p>
			<p className="mt-1 max-w-sm text-center text-xs text-white/40">
				{m.city_description()}
			</p>
			<div className="mt-6">
				<Button
					variant="stark"
					onClick={onLeave}
					className="uppercase tracking-wider"
				>
					{m.back_to_map()}
				</Button>
			</div>
		</section>
	);
}
