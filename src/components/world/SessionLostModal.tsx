// Non-dismissible modal shown when another tab or device steals the active
// session token (Threat #5 in docs/security/threat-model.md). The only way
// out is to refresh, which remounts the SessionTokenProvider, generates a
// fresh UUID, and re-claims via the /character-select Play flow (or via
// the auto-claim effect in /world for a direct refresh).

import Modal from "#/components/Modal";
import { m } from "#/paraglide/messages";

export default function SessionLostModal({ open }: { open: boolean }) {
	return (
		<Modal
			isOpen={open}
			onClose={() => {}}
			title={m.session_lost_title()}
			dismissible={false}
			hideHeaderClose
			footer={
				<div className="flex justify-center">
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="border-2 border-white/40 bg-black px-6 py-2 font-medium text-sm text-white/80 uppercase tracking-[0.25em] transition hover:border-white hover:bg-white/10 hover:text-white"
					>
						{m.session_lost_refresh()}
					</button>
				</div>
			}
		>
			<p className="text-sm text-white/80">{m.session_lost_body()}</p>
		</Modal>
	);
}
