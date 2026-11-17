import { m } from "#/paraglide/messages";

import BlockingNoticeModal from "./BlockingNoticeModal";

export default function SessionLostModal({ open }: { open: boolean }) {
	return (
		<BlockingNoticeModal
			open={open}
			title={m.session_lost_title()}
			body={m.session_lost_body()}
			actionLabel={m.session_lost_refresh()}
			onAction={() => window.location.reload()}
		/>
	);
}
