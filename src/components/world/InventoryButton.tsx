import { m } from "#/paraglide/messages";

type Props = {
	onClick?: () => void;
};

export default function InventoryButton({ onClick }: Props) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={m.open_inventory()}
			className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-md border border-white/40 bg-black text-white/80 transition hover:border-white hover:bg-white/10 hover:text-white"
		>
			<img
				src="/assets/sprites/ui/mochila.png"
				alt=""
				draggable={false}
				className="pointer-events-none h-8 w-8 select-none object-contain"
			/>
		</button>
	);
}
