// tRPC helpers shared by the component and hook tests.

import { TRPCClientError } from "@trpc/client";

import type { AppRouter } from "#/server/trpc/router";

/** A tRPC rule violation, the way the client receives one. */
export function ruleError(message: string) {
	return TRPCClientError.from<AppRouter>({
		error: {
			message,
			code: -32_600,
			data: { code: "BAD_REQUEST", httpStatus: 400 },
		},
	});
}
