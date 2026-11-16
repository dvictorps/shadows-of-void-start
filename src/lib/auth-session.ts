import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "#/server/auth";

// SSR-safe session read for route `beforeLoad`. Runs on the server (directly
// during SSR, as an RPC from the client after hydration) and reads the
// Better Auth cookie from the incoming request.
export const getSessionUser = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await auth.api.getSession({
			headers: getRequestHeaders(),
		});
		return session?.user ?? null;
	},
);
