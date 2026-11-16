import { RuleTester } from "oxlint/plugins-dev";

import { gameImportsRule } from "./game-imports.ts";

const tester = new RuleTester({
	languageOptions: { parserOptions: { lang: "ts" } },
});
const error = { messageId: "notAllowed" };
const options = [{ allow: ["#/game", "#/lib/rng", "#/paraglide"] }];
const filename = "/repo/src/game/items/generator.ts";

tester.run("shadows/game-imports", gameImportsRule, {
	valid: [
		{ code: 'import { randInt } from "#/lib/rng";', options, filename },
		{
			code: 'import { MODIFIERS } from "#/game/items/data/modifiers";',
			options,
			filename,
		},
		{
			code: 'import { MODIFIERS } from "./data/modifiers";',
			options,
			filename,
		},
		{ code: 'import { randInt } from "../../lib/rng";', options, filename },
		{ code: 'import { m } from "#/paraglide/messages";', options, filename },
		{ code: 'export { rollDrop } from "../loot/drops";', options, filename },
		{ code: "const local = 1; export { local };", options, filename },
	],
	invalid: [
		{
			code: 'import { useState } from "react";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'import { db } from "#/server/db/client";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'import type { AppRouter } from "#/server/trpc/router";',
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
			code: 'import { TRPCError } from "@trpc/server";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'import { useAuth } from "#/integrations/auth";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'import { authClient } from "../../lib/auth-client";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'import { rngHelper } from "#/lib/rng-extra";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'export * from "#/hooks/useBarrier";',
			options,
			filename,
			errors: [error],
		},
		{
			code: 'const mod = await import("better-auth");',
			options,
			filename,
			errors: [error],
		},
	],
});
