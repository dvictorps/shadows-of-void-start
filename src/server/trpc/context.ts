import { type AuthSession, auth } from "../auth";
import { type Database, db } from "../db/client";

export interface RequestSession {
	user: Pick<AuthSession["user"], "id" | "email" | "name" | "role">;
}

export interface Context {
	db: Database;
	getSession: () => Promise<RequestSession | null>;
	responseHeaders: Headers;
}

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
