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
