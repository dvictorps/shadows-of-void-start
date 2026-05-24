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
// the disabled state. Real abuse hardening (someone hitting the Convex
// endpoint directly) needs server-side rate limiting; see
// docs/security/threat-model.md.

import { useCallback, useEffect, useRef, useState } from "react";

export function useInFlight(
	resetOn?: unknown,
): [boolean, <T>(fn: () => Promise<T>) => Promise<T | undefined>] {
	const [isPending, setIsPending] = useState(false);
	// Read by `run` directly so a click arriving in the same tick as a
	// previous one (before React has committed the setIsPending(true)) still
	// observes the in-flight state. Mirrors the stateRef pattern used in
	// useCombatLoop.
	const pendingRef = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: setters are stable; only the dep change should clear.
	useEffect(() => {
		pendingRef.current = false;
		setIsPending(false);
	}, [resetOn]);

	const run = useCallback(
		async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
			if (pendingRef.current) return undefined;
			pendingRef.current = true;
			setIsPending(true);
			try {
				return await fn();
			} finally {
				pendingRef.current = false;
				setIsPending(false);
			}
		},
		[],
	);

	return [isPending, run];
}
