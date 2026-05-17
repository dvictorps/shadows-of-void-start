import { Backpack } from "lucide-react";

type Props = {
	onClick?: () => void;
};

export default function InventoryButton({ onClick }: Props) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Open inventory"
			className="fixed bottom-4 left-4 z-10 flex h-11 w-11 items-center justify-center rounded-md border border-white/40 bg-black/80 text-white/80 backdrop-blur-sm transition hover:border-white hover:bg-white/10 hover:text-white"
		>
			<Backpack className="h-5 w-5" />
		</button>
	);
}
