import { Button } from "#/components/ui/button";
import { m } from "#/paraglide/messages";

type Props = {
	onClick?: () => void;
};

export default function InventoryButton({ onClick }: Props) {
	return (
		<Button
			type="button"
			variant="hud"
			size="icon-lg"
			onClick={onClick}
			aria-label={m.open_inventory()}
			className="absolute bottom-3 left-3 rounded-md"
		>
			<img
				src="/assets/sprites/ui/mochila.png"
				alt=""
				draggable={false}
				className="pointer-events-none h-8 w-8 select-none object-contain"
			/>
		</Button>
	);
}
