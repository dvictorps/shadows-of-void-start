import Tooltip from "#/components/ui/tooltip";

type Props = {
	rubys: number;
};

/**
 * Display-only ruby balance pinned to the bottom-right of the equipment panel.
 * Visual twin of the bottom-left `InventoryButton` so the panel reads as two
 * symmetric corners. Not interactive — pure status indicator.
 */
export default function RubyCounter({ rubys }: Props) {
	return (
		<Tooltip content="Rubis — moeda do jogo">
			<div
				role="img"
				aria-label={`${rubys} rubys`}
				className="absolute right-3 bottom-3 inline-flex h-10 items-center gap-1.5 rounded-md border border-white/40 bg-black px-3 text-white/80"
			>
				<img
					src="/assets/sprites/ui/moedaRubi.png"
					alt=""
					draggable={false}
					className="pointer-events-none h-6 w-6 select-none object-contain"
				/>
				<span className="display-title text-sm tabular-nums tracking-wider">
					{rubys}
				</span>
			</div>
		</Tooltip>
	);
}
