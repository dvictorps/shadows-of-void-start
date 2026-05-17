import { Backpack } from "lucide-react";

type Props = {
	onClick?: () => void;
};

export default function InventoryButton({ onClick }: Props) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Abrir inventário"
			className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-md border border-white/40 bg-black text-white/80 transition hover:border-white hover:bg-white/10 hover:text-white"
		>
			<Backpack className="h-5 w-5" />
		</button>
	);
}
