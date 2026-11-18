import { Button } from "#/components/ui/button";
import { useEscapeLayer } from "#/hooks/useEscapeLayer";
import { m } from "#/paraglide/messages";

type ModalProps = {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	className?: string;
	dismissible?: boolean;
	hideHeaderClose?: boolean;
	footer?: React.ReactNode;
};

export default function Modal({
	isOpen,
	onClose,
	title,
	children,
	className = "max-w-md",
	dismissible = true,
	hideHeaderClose = false,
	footer,
}: ModalProps) {
	useEscapeLayer(isOpen, dismissible ? onClose : undefined);

	if (!isOpen) return null;

	const closeLabel = m.modal_close_label();
	const showHeaderClose = dismissible && !hideHeaderClose;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
			{dismissible && (
				<Button
					type="button"
					variant="ghost-purple"
					size="inline"
					onClick={onClose}
					aria-label={closeLabel}
					tabIndex={-1}
					className="absolute inset-0 cursor-default"
				/>
			)}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={title ? "modal-title" : undefined}
				className={`relative flex max-h-full w-full flex-col border border-white bg-black text-white shadow-dialog ${className}`}
			>
				{title && (
					<div className="flex shrink-0 items-center justify-between border-b border-white/20 px-5 py-3">
						<h2
							id="modal-title"
							className="display-title text-base uppercase tracking-title text-white"
						>
							{title}
						</h2>
						{showHeaderClose && (
							<Button
								type="button"
								variant="starkText"
								size="glyph"
								onClick={onClose}
								aria-label={closeLabel}
							>
								×
							</Button>
						)}
					</div>
				)}
				<div className="min-h-0 overflow-y-auto p-5">{children}</div>
				{footer && (
					<div className="shrink-0 border-t border-white/20 px-5 py-3">
						{footer}
					</div>
				)}
			</div>
		</div>
	);
}
