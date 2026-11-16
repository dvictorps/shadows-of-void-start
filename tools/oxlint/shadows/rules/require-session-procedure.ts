import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

import { memberName } from "../shared/globals.ts";
import { baseName, stringListOption } from "../shared/modules.ts";

/** The identifier a builder chain starts from: `characterSessionProcedure` in `characterSessionProcedure.input(x).mutation`. */
function chainRoot(expression: ESTree.Node): string | null {
	let current = expression;
	for (;;) {
		if (current.type === "Identifier") return current.name;
		if (current.type === "CallExpression") current = current.callee;
		else if (current.type === "MemberExpression") current = current.object;
		else return null;
	}
}

/** The key the procedure is registered under in its `router({ … })` object. */
function procedureKey(node: ESTree.CallExpression): string | null {
	const parent = node.parent;
	if (parent?.type !== "Property" || parent.value !== node) return null;
	if (parent.key.type === "Identifier") return parent.key.name;
	return parent.key.type === "Literal" && typeof parent.key.value === "string"
		? parent.key.value
		: null;
}

/** `src/server/trpc/routers/characters.ts` → `characters` (the key in `appRouter`). */
function routerName(filename: string): string {
	return baseName(filename).replace(/\..*$/, "");
}

/**
 * Every tRPC mutation goes through `characterSessionProcedure`: it loads the
 * character, checks ownership and the single-active-session token (threat #5
 * in docs/security/threat-model.md). Builders that are safe by construction
 * (`procedures`, e.g. `adminProcedure`) and named exceptions (`allow`, as
 * `router.procedure`) are listed in oxlint.config.ts.
 *
 * `router` is the file's base name, which matches its key in `appRouter`
 * (src/server/trpc/router.ts: one file per sub-router, ADR 0009). A nested
 * `router({ sub: router({ … }) })` would still key as `file.procedure`.
 */
export const requireSessionProcedureRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Require tRPC mutations to be built from characterSessionProcedure unless explicitly allowed.",
		},
		messages: {
			missingSession:
				"Mutation `{{key}}` is built from `{{root}}`, which skips the character ownership + single-active-session check (threat #5). Build it from `characterSessionProcedure` and read the row from `ctx.character`. If it truly cannot have a claimed session (it creates or claims the character, or acts on the account), add `{{key}}` to the rule's `allow` list in oxlint.config.ts with a comment saying why.",
		},
		schema: [
			{
				type: "object",
				properties: {
					procedures: { type: "array", items: { type: "string" } },
					allow: { type: "array", items: { type: "string" } },
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{ procedures: ["characterSessionProcedure"], allow: [] }],
	},
	create(context) {
		const procedures = new Set(stringListOption(context.options, "procedures"));
		const allow = new Set(stringListOption(context.options, "allow"));

		return {
			CallExpression(node) {
				if (
					memberName(node.callee) !== "mutation" ||
					node.callee.type !== "MemberExpression"
				) {
					return;
				}
				const root = chainRoot(node.callee.object) ?? "<expression>";
				if (procedures.has(root)) return;
				const key = `${routerName(context.filename)}.${procedureKey(node) ?? "<anonymous>"}`;
				if (allow.has(key)) return;
				context.report({
					node: node.callee.property,
					messageId: "missingSession",
					data: { key, root },
				});
			},
		};
	},
});
