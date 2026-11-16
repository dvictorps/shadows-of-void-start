import { ConvexQueryClient } from "@convex-dev/react-query";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
	console.error("missing envar VITE_CONVEX_URL");
}

// Auth moved to Better Auth on D1 (ADR 0009, phase 1), so this client is
// anonymous until the phase 3 swap deletes it. No `expectAuth`: it would
// park every query forever waiting for a token that never comes.
export const convexQueryClient = new ConvexQueryClient(CONVEX_URL);
