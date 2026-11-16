// Wraps an async handler with spam-click protection. `run(fn)` is a no-op
// when a previous invocation is still in flight; otherwise it sets the
// pending flag, awaits fn, and clears it via try/finally so a throw still
// frees the next click.
//
// Pass `resetOn` to clear the flag on a natural close boundary (view change,
// modal close) so a slow request finishing mid-close doesn't leave the next
// session with stale disabled state.
//
// Defense-in-depth on top of `disabled={isPending}` — the early-return
// covers the render-cycle window where a click arrives before React commits
// the disabled state. Real abuse hardening (someone hitting the tRPC
// endpoint directly) needs server-side rate limiting; see
// docs/security/threat-model.md.

import { useCallback, useRef, useState } from "react";

// A primitive boundary value (modal `isOpen`, the current view, ...);
// compared with `!==`, so any change starts a new epoch.
type ResetBoundary = boolean | string | number;

export function useInFlight(
	resetOn?: ResetBoundary,
): [boolean, <T>(fn: () => Promise<T>) => Promise<T | undefined>] {
	const [isPending, setIsPending] = useState(false);
	// Each `resetOn` flip starts a new epoch. Clearing happens during render
	// (React's "adjust state while rendering" pattern): the visible flag drops
	// and the epoch bump hands out a fresh `run`, so a request still in flight
	// from the previous epoch no longer blocks clicks.
	const [epoch, setEpoch] = useState(0);
	const [prevResetOn, setPrevResetOn] = useState(resetOn);
	if (resetOn !== prevResetOn) {
		setPrevResetOn(resetOn);
		setEpoch((e) => e + 1);
		setIsPending(false);
	}

	// Epoch of the request in flight, or null. Read by `run` directly so a
	// click arriving in the same tick as a previous one (before React has
	// committed the setIsPending(true)) still observes the in-flight state.
	// Mirrors the stateRef pattern used in useCombatLoop.
	const inFlightEpochRef = useRef<number | null>(null);

	const run = useCallback(
		async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
			if (inFlightEpochRef.current === epoch) return undefined;
			inFlightEpochRef.current = epoch;
			setIsPending(true);
			try {
				return await fn();
			} finally {
				// A stale-epoch request settling must not release the guard (or
				// clear the pending flag) of a request started after the reset.
				if (inFlightEpochRef.current === epoch) {
					inFlightEpochRef.current = null;
					setIsPending(false);
				}
			}
		},
		[epoch],
	);

	return [isPending, run];
}
