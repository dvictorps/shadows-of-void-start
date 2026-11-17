import { TRPCError } from "@trpc/server";

export function fail(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

export function notFound(message: string): never {
	throw new TRPCError({ code: "NOT_FOUND", message });
}

export function forbidden(message: string): never {
	throw new TRPCError({ code: "FORBIDDEN", message });
}
