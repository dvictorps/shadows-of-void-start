import Modal from "#/components/Modal";
import { Button } from "#/components/ui/button";

export default function BlockingNoticeModal({
	open,
	title,
	body,
	actionLabel,
	onAction,
}: {
	open: boolean;
	title: string;
	body: string;
	actionLabel: string;
	onAction: () => void;
}) {
	return (
		<Modal
			isOpen={open}
			onClose={() => {}}
			title={title}
			dismissible={false}
			footer={
				<div className="flex justify-center">
					<Button
						type="button"
						variant="starkMuted"
						caps
						onClick={onAction}
						className="px-6 py-2"
					>
						{actionLabel}
					</Button>
				</div>
			}
		>
			<p className="text-sm text-white/80">{body}</p>
		</Modal>
	);
}
