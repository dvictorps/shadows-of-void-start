import { Button } from "#/components/ui/button";
import { m } from "#/paraglide/messages";

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
	confirmLabel = m.confirm(),
	cancelLabel = m.cancel(),
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
					size="wide"
					caps
				>
					{cancelLabel}
				</Button>
				<Button
					type="button"
					variant={variant === "destructive" ? "starkDestructive" : "stark"}
					onClick={onConfirm}
					size="wide"
					caps
				>
					{confirmLabel}
				</Button>
			</div>
		</Modal>
	);
}
