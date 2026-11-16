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
//  The claim call is a parameter (the route passes the tRPC mutation), so the
//  tests drive it with a fake.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";

import { useInFlight } from "./useInFlight";

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
	// Belt-and-suspenders: the effect's deps already gate re-runs to the
	// tokenMatches / hasMatched flips, but the guard removes any reliance on
	// `claim` staying stable, so the 50ms combat re-render can't burst-fire
	// claims.
	const [isClaiming, runClaim] = useInFlight();
	// Latch during render: once our token has been seen winning, it stays won.
	if (tokenMatches && !hasMatched) setHasMatched(true);

	useEffect(() => {
		// oxlint-disable-next-line you-might-not-need-an-effect/no-event-handler -- the claim fires on arriving at /world (refresh, bookmark, restored tab) with no prior claim; no user action starts it, so this is a mount-time sync with the server, which is what effects are for
		if (tokenMatches || hasMatched || isClaiming) return;
		void runClaim(() => claim({ characterId, sessionToken }));
	}, [
		tokenMatches,
		hasMatched,
		isClaiming,
		runClaim,
		claim,
		characterId,
		sessionToken,
	]);

	return { sessionLost: hasMatched && !tokenMatches };
}
