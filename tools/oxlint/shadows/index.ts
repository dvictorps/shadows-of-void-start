import { eslintCompatPlugin } from "@oxlint/plugins";

import { gameDeterminismRule } from "./rules/game-determinism.ts";
import { gameImportsRule } from "./rules/game-imports.ts";
import { noUnvalidatedJsonParseRule } from "./rules/no-unvalidated-json-parse.ts";
import { requireSessionProcedureRule } from "./rules/require-session-procedure.ts";
import { serverOnlyImportsRule } from "./rules/server-only-imports.ts";

/**
 * Shadows of Void's architecture, as lint. Each rule encodes a boundary the
 * docs describe (pure engine, session-checked mutations, server-only modules,
 * validated stored JSON); the path scoping and allowlists live in
 * oxlint.config.ts.
 */
const shadowsPlugin = eslintCompatPlugin({
	meta: { name: "shadows" },
	rules: {
		"game-determinism": gameDeterminismRule,
		"game-imports": gameImportsRule,
		"no-unvalidated-json-parse": noUnvalidatedJsonParseRule,
		"require-session-procedure": requireSessionProcedureRule,
		"server-only-imports": serverOnlyImportsRule,
	},
});

export default shadowsPlugin;
