// ─────────────────────────────────────────────────────────────────────────────
//  Single-active-session reconciliation for the /world route
//  (docs/security/threat-model.md → Threat #5).
//
//  A fresh tab arriving directly at /world (refresh, bookmark, restored tab)
//  has no prior claim, so one fires automatically. `hasMatched` latches the
//  first time the character shows our token winning; from then on a
//  divergence means another tab or device took the session, and
//  `sessionLost` surfaces the non-dismissible modal. Without reactivity the
//  divergence shows up when the character is refetched: on window focus, or
//  after a write fails with "Session lost" (the router's mutation cache
//  refetches it). There is deliberately no re-claim after a takeover,
//  otherwise two tabs ping-pong forever; the player refreshes to recover.
//
//  A rejected claim (network, server) latches `claimFailure` and does not
//  re-fire on its own, so a failure costs one request, not a burst against
//  the Workers quota. `retryClaim` clears the latch, and the effect claims
//  again.
//  The failure is derived away once our token is seen winning (a claim whose
//  write landed but whose response was lost).
//
//  The claim call is a parameter (the route passes the tRPC mutation), so the
//  tests drive it with a fake.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";

import { useInFlight } from "./useInFlight";

// Boxed so a falsy rejection value still counts as a failure.
export type ClaimFailure = { error: unknown };

export function useSessionClaim({
	tokenMatches,
	characterId,
	sessionToken,
	claim,
}: {
	// The character row's `activeSessionToken` is this tab's token.
	tokenMatches: boolean;
	characterId: number;
	sessionToken: string;
	claim: (args: {
		characterId: number;
		sessionToken: string;
	}) => Promise<object>;
}) {
	const [hasMatched, setHasMatched] = useState(false);
	const [failure, setFailure] = useState<ClaimFailure | null>(null);
	// The in-flight guard keeps a dep change (an unstable `claim`, a new
	// character id) from starting a second claim while one is pending.
	const [isClaiming, runClaim] = useInFlight();
	// Latch during render: once our token has been seen winning, it stays won.
	if (tokenMatches && !hasMatched) setHasMatched(true);

	useEffect(() => {
		// oxlint-disable-next-line you-might-not-need-an-effect/no-event-handler -- the claim fires on arriving at /world (refresh, bookmark, restored tab) with no prior claim; no user action starts it, so this is a mount-time sync with the server, which is what effects are for
		if (tokenMatches || hasMatched || isClaiming || failure) return;
		// Caught inside the in-flight call so the latch is set before the flag
		// drops (the effect never sees "not claiming, no failure" after a
		// rejection); nothing rejects, hence the void.
		void runClaim(async () => {
			try {
				await claim({ characterId, sessionToken });
			} catch (error) {
				setFailure({ error });
			}
		});
	}, [
		tokenMatches,
		hasMatched,
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
