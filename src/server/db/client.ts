import { env } from "cloudflare:workers";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export const db = drizzle(env.DB, { schema, casing: "snake_case" });

export type Database = typeof db;

export async function batchAll(
	database: Database,
	statements: readonly BatchItem<"sqlite">[],
): Promise<void> {
	const [first, ...rest] = statements;
	if (first) await database.batch([first, ...rest]);
}
