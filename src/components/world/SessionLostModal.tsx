// Non-dismissible modal shown when another tab or device steals the active
// session token (Threat #5 in docs/security/threat-model.md). The only way
// out is to refresh, which remounts the SessionTokenProvider, generates a
// fresh UUID, and re-claims via the /character-select Play flow (or via
// the auto-claim effect in /world for a direct refresh).

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
