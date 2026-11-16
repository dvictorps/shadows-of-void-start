import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineProject } from "vitest/config";

// Integration tests for the tRPC procedures (src/server/**/*.integration.test.ts).
// They run inside workerd against a local D1 with the real Drizzle migrations
// applied, so they exercise the same SQL as staging. Referenced from the
// `projects` list in vite.config.ts, so `pnpm test` runs them too.
//
// The Worker is configured here instead of from wrangler.jsonc: the tests call
// procedures through a tRPC caller and never need the `main` entry (TanStack
// Start's server bundle).
export default defineProject(async () => {
	const migrations = await readD1Migrations("./drizzle");
	return {
		resolve: { tsconfigPaths: true },
		plugins: [
			cloudflareTest({
				remoteBindings: false,
				miniflare: {
					compatibilityDate: "2026-11-10",
					compatibilityFlags: ["nodejs_compat"],
					d1Databases: ["DB"],
					bindings: {
						TEST_MIGRATIONS: migrations,
						BETTER_AUTH_URL: "http://localhost:3002",
						BETTER_AUTH_SECRET: "integration-tests-only-not-a-secret",
					},
				},
			}),
		],
		test: {
			name: "server",
			include: ["src/server/**/*.integration.test.ts"],
			setupFiles: ["./src/server/test/apply-migrations.ts"],
		},
	};
});
