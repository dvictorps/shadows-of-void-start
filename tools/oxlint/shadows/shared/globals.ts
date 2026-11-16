import type { ESTree, Scope, SourceCode, Variable } from "@oxlint/plugins";

function resolveVariable(
	sourceCode: SourceCode,
	identifier: ESTree.IdentifierReference,
): Variable | null {
	let scope: Scope | null = sourceCode.getScope(identifier);
	while (scope !== null) {
		const variable = scope.set.get(identifier.name);
		if (variable !== undefined) return variable;
		scope = scope.upper;
	}
	return null;
}

/** The expression is the global `name` (`Math`, `JSON`, …), not a local binding that shadows it. */
export function isGlobalObject(
	sourceCode: SourceCode,
	expression: ESTree.Node,
	name: string,
): boolean {
	if (expression.type !== "Identifier" || expression.name !== name)
		return false;
	if (sourceCode.isGlobalReference(expression)) return true;
	const variable = resolveVariable(sourceCode, expression);
	return variable === null || variable.defs.length === 0;
}

/** Name of the property a member expression reads (`a.b` and `a["b"]`), or null when computed. */
export function memberName(node: ESTree.Node): string | null {
	if (node.type !== "MemberExpression") return null;
	if (!node.computed)
		return node.property.type === "Identifier" ? node.property.name : null;
	return node.property.type === "Literal" &&
		typeof node.property.value === "string"
		? node.property.value
		: null;
}

/** The node is `<global object>.<method>` for one of `methods`; returns the method name. */
export function globalMethod(
	sourceCode: SourceCode,
	node: ESTree.Node,
	object: string,
	methods: ReadonlySet<string>,
): string | null {
	if (node.type !== "MemberExpression") return null;
	const name = memberName(node);
	if (name === null || !methods.has(name)) return null;
	return isGlobalObject(sourceCode, node.object, object) ? name : null;
}
