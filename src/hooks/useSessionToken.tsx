// Per-tab session token — closes Threat #5 in docs/security/threat-model.md.
// A UUID generated once per Provider mount lives in a Context; every
// state-mutating Convex call threads it through via `withSession`. The
// server stamps the token on `claimCharacterSession` and rejects every
// mutation whose `sessionToken` doesn't match. Refreshing the tab remounts
// the root, generates a fresh UUID, and the character-select Play button
// re-claims — that's the recovery path for the "Session lost" modal.
//
// Token is intentionally NOT persisted (no localStorage). Multi-tab abuse
// shouldn't survive a refresh, and a refresh winning the race is the
// desired UX after a takeover.

import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";

const SessionTokenContext = createContext<string | null>(null);

export function SessionTokenProvider({ children }: { children: ReactNode }) {
	// Lazy init: `crypto.randomUUID()` is available in modern browsers and
	// Node 19+. SSR runs this once with a value that's never read for DOM
	// output, so the inevitable client/server divergence on hydration is
	// invisible — the client's UUID is the only one that matters.
	const [token] = useState(() => crypto.randomUUID());
	return (
		<SessionTokenContext.Provider value={token}>
			{children}
		</SessionTokenContext.Provider>
	);
}

export type WithSession<A> = A & { sessionToken: string };

// Hook returns the token plus a `withSession(args)` helper. The helper is
// the recommended call shape — every Convex mutation call site reads as
// `await something(withSession({ characterId, ... }))`, which centralises
// the token threading and makes the diff against a session-less call site
// minimal. See docs/plans/in-progress.md "Single active session per
// character" → useSessionToken hook + withSession helper.
export function useSessionToken(): {
	sessionToken: string;
	withSession: <A extends object>(args: A) => WithSession<A>;
} {
	const token = useContext(SessionTokenContext);
	if (token === null)
		throw new Error("useSessionToken: missing SessionTokenProvider in tree");
	return useMemo(
		() => ({
			sessionToken: token,
			withSession: <A extends object>(args: A): WithSession<A> => ({
				...args,
				sessionToken: token,
			}),
		}),
		[token],
	);
}
