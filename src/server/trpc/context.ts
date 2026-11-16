import { type AuthSession, auth } from "../auth";
import { type Database, db } from "../db/client";

// What procedures read from the session. Narrower than Better Auth's
// `AuthSession`, so integration tests can hand the caller a session without
// going through sign-up (src/server/test/harness.ts).
export interface RequestSession {
	user: Pick<AuthSession["user"], "id" | "email" | "name" | "role">;
}

export interface Context {
	db: Database;
	getSession: () => Promise<RequestSession | null>;
	responseHeaders: Headers;
}

// Built once per tRPC request. The session is resolved lazily (public
// procedures never pay for it) and at most once per batch.
//
// Better Auth re-issues its cookie-cache cookie (and, daily, the session
// expiry) on a cache miss. Server routes don't forward cookies set through
// Start's `setCookie`, so the `Set-Cookie` headers are collected here and
// added to the tRPC response by `responseMeta` (src/routes/api/trpc/$.ts).
// Without that, every call after the 5-minute cache window would hit D1.
export function createContext(request: Request): Context {
	const responseHeaders = new Headers();
	let pending: Promise<RequestSession | null> | undefined;

	function getSession(): Promise<RequestSession | null> {
		pending ??= auth.api
			.getSession({ headers: request.headers, returnHeaders: true })
			.then(({ headers, response }) => {
				for (const cookie of headers.getSetCookie()) {
					responseHeaders.append("set-cookie", cookie);
				}
				return response;
			});
		return pending;
	}

	return { db, getSession, responseHeaders };
}
