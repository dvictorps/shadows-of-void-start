import { useCallback, useEffect, useState } from "react";

import { useInFlight } from "./useInFlight";

export type ClaimFailure = { error: unknown };

export function useSessionClaim({
	tokenMatches,
	characterId,
	sessionToken,
	claim,
}: {
	tokenMatches: boolean;
	characterId: number;
	sessionToken: string;
	claim: (args: {
		characterId: number;
		sessionToken: string;
	}) => Promise<object>;
}) {
	const [hasMatched, setHasMatched] = useState(false);
	const [claimed, setClaimed] = useState(false);
	const [failure, setFailure] = useState<ClaimFailure | null>(null);
	const [isClaiming, runClaim] = useInFlight();
	if (tokenMatches && !hasMatched) setHasMatched(true);

	useEffect(() => {
		// oxlint-disable-next-line you-might-not-need-an-effect/no-event-handler -- the claim fires on arriving at /world (refresh, bookmark, restored tab) with no prior claim; no user action starts it, so this is a mount-time sync with the server, which is what effects are for
		if (tokenMatches || hasMatched || claimed || isClaiming || failure) return;
		void runClaim(async () => {
			try {
				await claim({ characterId, sessionToken });
				setClaimed(true);
			} catch (error) {
				setFailure({ error });
			}
		});
	}, [
		tokenMatches,
		hasMatched,
		claimed,
		isClaiming,
		failure,
		runClaim,
		claim,
		characterId,
		sessionToken,
	]);

	const retryClaim = useCallback(() => setFailure(null), []);

	return {
		sessionLost: hasMatched && !tokenMatches,
		claimFailure: hasMatched ? null : failure,
		retryClaim,
	};
}
