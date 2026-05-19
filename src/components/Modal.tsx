import { useEffect } from "react";
import { m } from "#/paraglide/messages";

type ModalProps = {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	className?: string;
	// When false, ESC and backdrop click do nothing — the modal can only be
	// closed by an explicit action inside (used for forced confirmations like
	// the zone-exit loot picker).
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
	useEffect(() => {
		if (!isOpen || !dismissible) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isOpen, dismissible, onClose]);

	if (!isOpen) return null;

	const closeLabel = m.modal_close_label();
	const showHeaderClose = dismissible && !hideHeaderClose;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
			{/* Backdrop click target — a real <button> so a11y is happy, absolutely
			    positioned behind the dialog. tabIndex=-1 keeps it out of the tab
			    order; cursor-default avoids the pointer-cursor on the dim area. */}
			{dismissible && (
				<button
					type="button"
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
				className={`relative w-full border border-white bg-black text-white shadow-[0_20px_60px_rgba(0,0,0,0.7)] ${className}`}
			>
				{title && (
					<div className="flex items-center justify-between border-b border-white/20 px-5 py-3">
						<h2
							id="modal-title"
							className="display-title text-base uppercase tracking-[0.15em] text-white"
						>
							{title}
						</h2>
						{showHeaderClose && (
							<button
								type="button"
								onClick={onClose}
								className="text-lg leading-none text-white/60 transition hover:text-white"
								aria-label={closeLabel}
							>
								×
							</button>
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
