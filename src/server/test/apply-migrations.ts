/// <reference types="@cloudflare/vitest-plugin/types" />
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Setup file for the `server` Vitest project (vitest.workers.config.ts).
// Applying is idempotent (tracked in `d1_migrations`), so running it before
// every test file is cheap.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
