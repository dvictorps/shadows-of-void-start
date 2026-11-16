import { Button } from "#/components/ui/button";
import { useEscapeLayer } from "#/hooks/useEscapeLayer";
import { m } from "#/paraglide/messages";

type ModalProps = {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	className?: string;
	// When false, ESC and backdrop click do nothing — the modal can only be
	// closed by an explicit action inside (used for forced confirmations like
	// the zone-exit loot picker). ESC doesn't reach a modal beneath either.
	dismissible?: boolean;
	// When true, the small × in the header is suppressed. Use together with
	// a `footer` action bar that hosts an explicit Close button.
	hideHeaderClose?: boolean;
	// Optional action bar pinned to the bottom of the dialog, separated from
	// the body by a divider. The caller renders whatever buttons it wants.
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
	// An open modal is an Escape layer: Escape closes it only when nothing
	// opened above it (a confirmation, a context menu, a drag). A
	// non-dismissible modal still takes the key, so the one beneath stays open.
	useEscapeLayer(isOpen, dismissible ? onClose : undefined);

	if (!isOpen) return null;

	const closeLabel = m.modal_close_label();
	const showHeaderClose = dismissible && !hideHeaderClose;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
			{/* Backdrop click target — a real button so a11y is happy, absolutely
			    positioned behind the dialog, transparent (`ghost-purple` + `inline`
			    add no fill and no box). tabIndex=-1 keeps it out of the tab order;
			    cursor-default avoids the pointer-cursor on the dim area. */}
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
				className={`relative w-full border border-white bg-black text-white shadow-dialog ${className}`}
			>
				{title && (
					<div className="flex items-center justify-between border-b border-white/20 px-5 py-3">
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
				<div className="p-5">{children}</div>
				{footer && (
					<div className="border-t border-white/20 px-5 py-3">{footer}</div>
				)}
			</div>
		</div>
	);
}
