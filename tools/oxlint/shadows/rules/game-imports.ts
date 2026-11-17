import { defineRule } from "@oxlint/plugins";

import {
	moduleMatches,
	moduleSourceVisitors,
	stringListOption,
} from "../shared/modules.ts";

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
