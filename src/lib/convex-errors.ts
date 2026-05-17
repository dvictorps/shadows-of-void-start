import { ConvexError } from "convex/values";

/**
 * Extracts a user-presentable string from an unknown error thrown by a Convex
 * query/mutation. ConvexError carries its payload on `.data`; everything else
 * falls back to the provided default message.
 */
export function convexErrorMessage(err: unknown, fallback: string): string {
	if (err instanceof ConvexError) return String(err.data);
	return fallback;
}
