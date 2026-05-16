import { useEffect } from "react";

type ModalProps = {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	className?: string;
};

export default function Modal({
	isOpen,
	onClose,
	title,
	children,
	className = "max-w-md",
}: ModalProps) {
	useEffect(() => {
		if (!isOpen) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
			onClick={onClose}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
			}}
			role="presentation"
		>
			<div
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby={title ? "modal-title" : undefined}
				className={`w-full border border-white bg-black text-white shadow-[0_20px_60px_rgba(0,0,0,0.7)] ${className}`}
			>
				{title && (
					<div className="flex items-center justify-between border-b border-white/20 px-5 py-3">
						<h2
							id="modal-title"
							className="display-title text-base uppercase tracking-[0.15em] text-white"
						>
							{title}
						</h2>
						<button
							type="button"
							onClick={onClose}
							className="text-lg leading-none text-white/60 transition hover:text-white"
							aria-label="Close"
						>
							×
						</button>
					</div>
				)}
				<div className="p-5">{children}</div>
			</div>
		</div>
	);
}
