import { m } from "#/paraglide/messages";

import ConfirmationModal from "./ConfirmationModal";

export default function UpdateAvailableModal({
	open,
	onUpdate,
	onLater,
}: {
	open: boolean;
	onUpdate: () => void;
	onLater: () => void;
}) {
	return (
		<ConfirmationModal
			isOpen={open}
			title={m.update_available_title()}
			message={m.update_available_body()}
			confirmLabel={m.update_available_now()}
			cancelLabel={m.update_available_later()}
			onConfirm={onUpdate}
			onCancel={onLater}
		/>
	);
}
