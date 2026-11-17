import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineProject } from "vitest/config";

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
