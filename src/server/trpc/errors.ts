import { TRPCError } from "@trpc/server";

// Thrown for every rule a procedure enforces. The client's
// `translateServerError` matches the message; exact-match strings come from `SERVER_ERRORS`.
export function fail(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

export function notFound(message: string): never {
	throw new TRPCError({ code: "NOT_FOUND", message });
}

export function forbidden(message: string): never {
	throw new TRPCError({ code: "FORBIDDEN", message });
}
