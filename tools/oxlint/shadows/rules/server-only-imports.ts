import { defineRule } from "@oxlint/plugins";

import {
	moduleMatches,
	moduleSourceVisitors,
	stringListOption,
} from "../shared/modules.ts";

/**
 * Server-only modules may reach the client bundle only as erased types. The
 * rule is switched off (in oxlint.config.ts) for the code that runs on the
 * Worker: `src/server`, the API routes, and the isomorphic server branch of
 * the tRPC client.
 */
export const serverOnlyImportsRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Outside the server, import server-only modules (src/server, Drizzle, @trpc/server) with a top-level `import type` only.",
		},
		messages: {
			valueImport:
				"`{{source}}` is server-only (D1, auth secrets, tRPC internals) and this file ships to the browser. Import its types with a top-level `import type { … }` (an inline `import { type … }` still loads the module under verbatimModuleSyntax), or call the server through the tRPC client (`#/integrations/trpc/client`). A file that legitimately runs only on the server (API route, isomorphic server branch) belongs in the rule's override in oxlint.config.ts, with a comment saying why.",
		},
		schema: [
			{
				type: "object",
				properties: {
					modules: { type: "array", items: { type: "string" } },
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{ modules: [] }],
	},
	create(context) {
		const modules = stringListOption(context.options, "modules");
		return moduleSourceVisitors(
			context,
			"valueImport",
			({ module, typeOnly }) =>
				!typeOnly && modules.some((entry) => moduleMatches(module, entry)),
		);
	},
});
