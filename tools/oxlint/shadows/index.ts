import { eslintCompatPlugin } from "@oxlint/plugins";

import { gameDeterminismRule } from "./rules/game-determinism.ts";
import { gameImportsRule } from "./rules/game-imports.ts";
import { noCommentsRule } from "./rules/no-comments.ts";
import { noServerCallsInComponentsRule } from "./rules/no-server-calls-in-components.ts";
import { noUnvalidatedJsonParseRule } from "./rules/no-unvalidated-json-parse.ts";
import { requireSessionProcedureRule } from "./rules/require-session-procedure.ts";
import { serverOnlyImportsRule } from "./rules/server-only-imports.ts";

const shadowsPlugin = eslintCompatPlugin({
	meta: { name: "shadows" },
	rules: {
		"game-determinism": gameDeterminismRule,
		"game-imports": gameImportsRule,
		"no-comments": noCommentsRule,
		"no-server-calls-in-components": noServerCallsInComponentsRule,
		"no-unvalidated-json-parse": noUnvalidatedJsonParseRule,
		"require-session-procedure": requireSessionProcedureRule,
		"server-only-imports": serverOnlyImportsRule,
	},
});

export default shadowsPlugin;
