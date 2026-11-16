import { defineRule } from "@oxlint/plugins";
import type { ESTree, SourceCode } from "@oxlint/plugins";

import { globalMethod, isGlobalObject, memberName } from "../shared/globals.ts";

const PARSE_METHODS = new Set(["parse"]);
const BUILTIN_PARSERS = ["JSON", "Date"];
const SCHEMA_METHODS = new Set([
	"parse",
	"safeParse",
	"parseAsync",
	"safeParseAsync",
]);

function isJsonParse(sourceCode: SourceCode, callee: ESTree.Node): boolean {
	return globalMethod(sourceCode, callee, "JSON", PARSE_METHODS) !== null;
}

/** `Schema.parse(JSON.parse(raw))`: the parse result goes straight into a schema. */
function feedsSchema(
	sourceCode: SourceCode,
	call: ESTree.CallExpression,
): boolean {
	const parent = call.parent;
	if (parent?.type !== "CallExpression" || parent.arguments[0] !== call) {
		return false;
	}
	const callee = parent.callee;
	// `JSON.parse(JSON.parse(raw))` and `Date.parse(JSON.parse(raw))` share
	// the method name but validate nothing.
	if (
		callee.type === "MemberExpression" &&
		BUILTIN_PARSERS.some((name) =>
			isGlobalObject(sourceCode, callee.object, name),
		)
	) {
		return false;
	}
	const method = memberName(callee);
	return method !== null && SCHEMA_METHODS.has(method);
}

/** `JSON.parse(raw) as unknown`, or `const parsed: unknown = JSON.parse(raw)`. */
function typedAsUnknown(call: ESTree.CallExpression): boolean {
	const parent = call.parent;
	if (parent?.type === "TSAsExpression") {
		return parent.typeAnnotation.type === "TSUnknownKeyword";
	}
	if (parent?.type !== "VariableDeclarator" || parent.init !== call) {
		return false;
	}
	return parent.id.typeAnnotation?.typeAnnotation.type === "TSUnknownKeyword";
}

/**
 * `JSON.parse` returns `any`, which silently takes whatever type the next line
 * assumes. Stored JSON (D1 text columns, localStorage, sessionStorage) can be
 * from an older schema or tampered with, so its shape is checked before use.
 */
export const noUnvalidatedJsonParseRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Require JSON.parse output to go straight into a schema or to be typed `unknown`.",
		},
		messages: {
			unvalidated:
				'`JSON.parse` returns `any`, so stored or remote JSON would flow on unchecked. Validate it at the boundary: `Schema.parse(JSON.parse(raw))` / `Schema.safeParse(JSON.parse(raw))` with a zod schema, or `const parsed: unknown = JSON.parse(raw)` followed by a type guard. For a D1 JSON column, let Drizzle\'s `text({ mode: "json" })` decode it.',
		},
	},
	createOnce(context) {
		return {
			CallExpression(node) {
				if (!isJsonParse(context.sourceCode, node.callee)) return;
				if (feedsSchema(context.sourceCode, node) || typedAsUnknown(node)) {
					return;
				}
				context.report({ node, messageId: "unvalidated" });
			},
		};
	},
});
