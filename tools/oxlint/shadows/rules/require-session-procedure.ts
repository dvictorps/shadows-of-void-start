import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

import { memberName } from "../shared/globals.ts";
import { baseName, stringListOption } from "../shared/modules.ts";

function chainRoot(expression: ESTree.Node): string | null {
	let current = expression;
	for (;;) {
		if (current.type === "Identifier") return current.name;
		if (current.type === "CallExpression") current = current.callee;
		else if (current.type === "MemberExpression") current = current.object;
		else return null;
	}
}

function procedureKey(node: ESTree.CallExpression): string | null {
	const parent = node.parent;
	if (parent?.type !== "Property" || parent.value !== node) return null;
	if (parent.key.type === "Identifier") return parent.key.name;
	return parent.key.type === "Literal" && typeof parent.key.value === "string"
		? parent.key.value
		: null;
}

function routerName(filename: string): string {
	return baseName(filename).replace(/\..*$/, "");
}

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
