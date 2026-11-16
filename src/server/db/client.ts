import { env } from "cloudflare:workers";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

// One Drizzle instance per isolate. `cloudflare:workers` exposes the bindings
// at module scope, and the D1 binding is stateless, so this is safe to share
// across requests. `casing` must match `drizzle.config.ts`.
export const db = drizzle(env.DB, { schema, casing: "snake_case" });

export type Database = typeof db;

/**
 * Runs `statements` as one atomic D1 batch, or nothing when the list is
 * empty (Drizzle's `batch` needs at least one statement).
 */
export async function batchAll(
	database: Database,
	statements: readonly BatchItem<"sqlite">[],
): Promise<void> {
	const [first, ...rest] = statements;
	if (first) await database.batch([first, ...rest]);
}
