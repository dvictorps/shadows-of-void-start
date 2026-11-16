import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

// One Drizzle instance per isolate. `cloudflare:workers` exposes the bindings
// at module scope, and the D1 binding is stateless, so this is safe to share
// across requests. `casing` must match `drizzle.config.ts`.
export const db = drizzle(env.DB, { schema, casing: "snake_case" });

export type Database = typeof db;
