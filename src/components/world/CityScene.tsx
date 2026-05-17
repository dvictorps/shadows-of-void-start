import { Button } from "#/components/ui/button";

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
				Zona Segura
			</p>
			<p className="mt-1 max-w-sm text-center text-xs text-white/40">
				Your HP has been fully restored. Visit the vendor and stash here when
				they're available.
			</p>
			<div className="mt-6">
				<Button
					variant="stark"
					onClick={onLeave}
					className="uppercase tracking-wider"
				>
					Voltar ao mapa
				</Button>
			</div>
		</section>
	);
}
