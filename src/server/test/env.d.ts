/// <reference types="@cloudflare/vitest-plugin/types" />

// Binding that only exists in the `server` Vitest project
// (vitest.workers.config.ts): the Drizzle migrations read in Node and applied
// inside workerd by apply-migrations.ts.
declare namespace Cloudflare {
	interface Env {
		TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
	}
}
