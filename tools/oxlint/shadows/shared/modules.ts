import type { Context, ESTree, Options, Visitor } from "@oxlint/plugins";

function pathSegments(filename: string): string[] {
	return filename.replaceAll("\\", "/").split("/");
}

export function baseName(filename: string): string {
	return pathSegments(filename).at(-1) ?? filename;
}

function resolveRelative(filename: string, source: string): string {
	const segments = pathSegments(filename).slice(0, -1);
	for (const segment of source.split("/")) {
		if (segment === "..") segments.pop();
		else if (segment !== "." && segment !== "") segments.push(segment);
	}
	return segments.join("/");
}

export function normalizeModuleSource(
	filename: string,
	source: string,
): string {
	if (!source.startsWith(".")) return source;
	const resolved = resolveRelative(filename, source);
	const srcIndex = resolved.lastIndexOf("/src/");
	return srcIndex === -1
		? resolved
		: `#/${resolved.slice(srcIndex + "/src/".length)}`;
}

export function moduleMatches(source: string, entry: string): boolean {
	return source === entry || source.startsWith(`${entry}/`);
}

export function stringListOption(
	options: Readonly<Options>,
	key: string,
): string[] {
	const first = options[0];
	if (first === null || first === undefined || Array.isArray(first)) return [];
	if (typeof first !== "object") return [];
	const value = first[key];
	if (!Array.isArray(value)) return [];
	return value.filter((entry): entry is string => typeof entry === "string");
}

type ModuleSourceNode =
	| ESTree.ImportDeclaration
	| ESTree.ExportNamedDeclaration
	| ESTree.ExportAllDeclaration
	| ESTree.ImportExpression;

function literalSource(node: ModuleSourceNode): ESTree.StringLiteral | null {
	const source = node.source;
	if (
		source === null ||
		source.type !== "Literal" ||
		typeof source.value !== "string"
	) {
		return null;
	}
	return source;
}

function isErasedTypeImport(node: ModuleSourceNode): boolean {
	if (node.type === "ImportExpression") return false;
	if (node.type === "ImportDeclaration") return node.importKind === "type";
	return node.exportKind === "type";
}

export interface ModuleImport {
	module: string;
	written: string;
	typeOnly: boolean;
}

export function moduleSourceVisitors(
	context: Context,
	messageId: string,
	isViolation: (moduleImport: ModuleImport) => boolean,
): Visitor {
	function check(node: ModuleSourceNode): void {
		const source = literalSource(node);
		if (source === null) return;
		const moduleImport = {
			module: normalizeModuleSource(context.filename, source.value),
			written: source.value,
			typeOnly: isErasedTypeImport(node),
		};
		if (!isViolation(moduleImport)) return;
		context.report({ node: source, messageId, data: { source: source.value } });
	}

	return {
		ImportDeclaration: check,
		ExportNamedDeclaration: check,
		ExportAllDeclaration: check,
		ImportExpression: check,
	};
}
