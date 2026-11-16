import { RuleTester } from "oxlint/plugins-dev";

import { serverOnlyImportsRule } from "./server-only-imports.ts";

const tester = new RuleTester({
	languageOptions: { parserOptions: { lang: "ts" } },
});
const error = { messageId: "valueImport" };
const options = [{ modules: ["#/server", "drizzle-orm", "@trpc/server"] }];
const filename = "/repo/src/lib/api-types.ts";

tester.run("shadows/server-only-imports", serverOnlyImportsRule, {
	valid: [
		{
			code: 'import type { AppRouter } from "#/server/trpc/router";',
			options,
			filename,
		},
		{
			code: 'import type { inferRouterOutputs } from "@trpc/server";',
			options,
			filename,
		},
		{
			code: 'export type { AppRouter } from "#/server/trpc/router";',
			options,
			filename,
		},
		{
			code: 'import { createTRPCClient } from "@trpc/client";',
			options,
			filename,
		},
		{
			code: 'import { SERVER_ERRORS } from "#/lib/server-errors";',
			options,
			filename,
		},
		{
			code: 'import { serverHelper } from "#/server-helpers";',
			options,
			filename,
		},
	],
	invalid: [
		{
			// verbatimModuleSyntax keeps `import {} from "…"`: the module loads.
			code: 'import { type AppRouter } from "#/server/trpc/router";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'import { appRouter } from "#/server/trpc/router";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'import { db } from "../server/db/client";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'import { eq } from "drizzle-orm";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'import { fetchRequestHandler } from "@trpc/server/adapters/fetch";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'import { type AppRouter, appRouter } from "#/server/trpc/router";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'export { auth } from "#/server/auth";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'const { auth } = await import("#/server/auth");',
			options,
			filename,
			errors: [error],
		},
	],
});
