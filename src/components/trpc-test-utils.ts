import { TRPCClientError } from "@trpc/client";

import type { AppRouter } from "#/server/trpc/router";

export function ruleError(message: string) {
	return TRPCClientError.from<AppRouter>({
		error: {
			message,
			code: -32_600,
			data: { code: "BAD_REQUEST", httpStatus: 400 },
		},
	});
}
