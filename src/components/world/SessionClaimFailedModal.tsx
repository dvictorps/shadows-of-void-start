// Non-dismissible modal shown when the auto-claim on arriving at /world was
// rejected (Threat #5 in docs/security/threat-model.md). Combat stays paused
// until the session is ours, so the player sees why and retries by hand; the
// claim never re-fires on its own (see useSessionClaim).

import type { ClaimFailure } from "#/hooks/useSessionClaim";
import { serverErrorMessage } from "#/lib/server-error-message";
import { m } from "#/paraglide/messages";

import BlockingNoticeModal from "./BlockingNoticeModal";

export default function SessionClaimFailedModal({
	failure,
	onRetry,
}: {
	failure: ClaimFailure | null;
	onRetry: () => void;
}) {
	return (
		<BlockingNoticeModal
			open={failure !== null}
			title={m.session_claim_failed_title()}
			body={
				failure
					? serverErrorMessage(failure.error, m.session_claim_failed_body())
					: ""
			}
			actionLabel={m.session_claim_failed_retry()}
			onAction={onRetry}
		/>
	);
}
