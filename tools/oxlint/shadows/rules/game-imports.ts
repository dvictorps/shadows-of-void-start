import { defineRule } from "@oxlint/plugins";

import {
	moduleMatches,
	moduleSourceVisitors,
	stringListOption,
} from "../shared/modules.ts";

/**
 * `src/game` is the pure engine: the server and the client both call it, and
 * its tests run without a DOM, a database or a network. Its imports are an
 * allowlist (set in oxlint.config.ts), so a new dependency is a decision made
 * in the config, not something an edit slips in. Type-only imports count too:
 * the engine doesn't depend on server shapes.
 */
export const gameImportsRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Restrict src/game imports to the engine itself and an explicit allowlist of pure modules.",
		},
		messages: {
			notAllowed:
				"`{{source}}` is not on the src/game import allowlist. src/game is the pure engine shared by the Worker and the client: keep React, the server, D1/Drizzle, tRPC and auth out of it. Have the caller (src/server or src/hooks) do the impure work and pass the result in as a parameter. Only extend the `allow` list in oxlint.config.ts for a module that is itself pure.",
		},
		schema: [
			{
				type: "object",
				properties: {
					allow: { type: "array", items: { type: "string" } },
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{ allow: [] }],
	},
	create(context) {
		const allow = stringListOption(context.options, "allow");
		return moduleSourceVisitors(
			context,
			"notAllowed",
			({ module }) => !allow.some((entry) => moduleMatches(module, entry)),
		);
	},
});
