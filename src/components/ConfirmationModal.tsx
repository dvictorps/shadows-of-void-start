import { Button } from "#/components/ui/button";
import Modal from "./Modal";

type Variant = "default" | "destructive";

export type ConfirmationConfig = {
	title: string;
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: Variant;
};

type Props = ConfirmationConfig & {
	isOpen: boolean;
	onConfirm: () => void;
	onCancel: () => void;
};

export default function ConfirmationModal({
	isOpen,
	title,
	message,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	variant = "default",
	onConfirm,
	onCancel,
}: Props) {
	return (
		<Modal isOpen={isOpen} onClose={onCancel} title={title}>
			{message && (
				<p className="mb-6 text-sm leading-relaxed text-white/80">{message}</p>
			)}
			<div className="flex justify-end gap-3">
				<Button
					type="button"
					variant="starkMuted"
					onClick={onCancel}
					className="px-5 py-2 uppercase tracking-wider"
				>
					{cancelLabel}
				</Button>
				<Button
					type="button"
					variant={variant === "destructive" ? "starkDestructive" : "stark"}
					onClick={onConfirm}
					className="px-5 py-2 uppercase tracking-wider"
				>
					{confirmLabel}
				</Button>
			</div>
		</Modal>
	);
}
