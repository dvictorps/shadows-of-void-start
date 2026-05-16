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
	const confirmClass =
		variant === "destructive"
			? "border-red-400 bg-black text-red-100 hover:bg-red-950/40"
			: "border-white bg-black text-white hover:bg-white/10";

	return (
		<Modal isOpen={isOpen} onClose={onCancel} title={title}>
			{message && (
				<p className="mb-6 text-sm leading-relaxed text-white/80">{message}</p>
			)}
			<div className="flex justify-end gap-3">
				<button
					type="button"
					onClick={onCancel}
					className="border border-white/40 bg-black px-5 py-2 text-sm font-medium uppercase tracking-wider text-white/80 transition hover:bg-white/10 hover:text-white"
				>
					{cancelLabel}
				</button>
				<button
					type="button"
					onClick={onConfirm}
					className={`border px-5 py-2 text-sm font-medium uppercase tracking-wider transition ${confirmClass}`}
				>
					{confirmLabel}
				</button>
			</div>
		</Modal>
	);
}
