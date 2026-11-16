import type { Context, ESTree, Options, Visitor } from "@oxlint/plugins";

// Plain string path handling: tools/oxlint sits outside tsconfig.json, so
// `node:path` would have no types under the type-aware rules.
function pathSegments(filename: string): string[] {
	return filename.replaceAll("\\", "/").split("/");
}

/** `src/server/trpc/routers/characters.ts` → `characters.ts`. */
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

/**
 * The module an import source names, in the repo's own vocabulary: `#/` aliases
 * stay as written, relative paths that land in `src/` are rewritten to `#/…`
 * (so `../../lib/rng` and `#/lib/rng` compare equal), and bare package names
 * come back unchanged.
 */
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

/** `entry` names `source` exactly, or one of its parent paths (`#/game` covers `#/game/items`). */
export function moduleMatches(source: string, entry: string): boolean {
	return source === entry || source.startsWith(`${entry}/`);
}

/** A string-list option of the rule's first options object (validated by the rule's schema). */
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

/** The literal module source of an import / re-export / dynamic import, or null. */
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

/**
 * The statement is erased at compile time. Only a top-level `import type` /
 * `export type` counts: under `verbatimModuleSyntax` (tsconfig.json),
 * `import { type A } from "m"` still compiles to `import {} from "m"`, which
 * loads the module.
 */
function isErasedTypeImport(node: ModuleSourceNode): boolean {
	if (node.type === "ImportExpression") return false;
	if (node.type === "ImportDeclaration") return node.importKind === "type";
	return node.exportKind === "type";
}

export interface ModuleImport {
	/** The source as `normalizeModuleSource` resolves it. */
	module: string;
	/** The source as written. */
	written: string;
	/** Erased at compile time (`import type` / `export type`). */
	typeOnly: boolean;
}

/**
 * Visitors for every statement that names a module (import, re-export,
 * dynamic import with a literal). Reports `messageId` with `{{source}}` when
 * `isViolation` says so.
 */
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
