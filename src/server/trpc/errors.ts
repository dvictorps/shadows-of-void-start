import { TRPCError } from "@trpc/server";

// Thrown for every rule a procedure enforces. The message is what Convex
// threw as `ConvexError` data, so the client's `translateServerError` keeps
// matching it; exact-match strings come from `SERVER_ERRORS`.
export function fail(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

export function notFound(message: string): never {
	throw new TRPCError({ code: "NOT_FOUND", message });
}

export function forbidden(message: string): never {
	throw new TRPCError({ code: "FORBIDDEN", message });
}
