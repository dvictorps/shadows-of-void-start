import { defineRule } from "@oxlint/plugins";
import type { Comment } from "@oxlint/plugins";

const LINT_DIRECTIVE = /^(?:oxlint|eslint)-(?:disable|enable)\b/;
const TOOL_DIRECTIVE = /^@vitest-environment\s/;
const TRIPLE_SLASH_REFERENCE = /^\/\s*<reference\s/;
const SAFETY_JUSTIFICATION = /^SAFETY\s*:/;

function text(comment: Comment): string {
	return comment.value.replace(/^\*?\s*/, "").trim();
}

function isStandaloneDirective(comment: Comment): boolean {
	if (comment.type === "Shebang") return true;
	if (comment.type === "Line" && TRIPLE_SLASH_REFERENCE.test(comment.value)) {
		return true;
	}
	return TOOL_DIRECTIVE.test(text(comment));
}

function adjacentRuns(comments: Comment[]): Comment[][] {
	const runs: Comment[][] = [];
	for (const comment of comments) {
		const run = runs.at(-1);
		const previous = run?.at(-1);
		if (
			run &&
			previous &&
			comment.loc.start.line === previous.loc.end.line + 1
		) {
			run.push(comment);
		} else {
			runs.push([comment]);
		}
	}
	return runs;
}

function runIsAllowed(run: Comment[]): boolean {
	const [first] = run;
	if (first && SAFETY_JUSTIFICATION.test(text(first))) return true;
	return run.some((comment) => LINT_DIRECTIVE.test(text(comment)));
}

export const noCommentsRule = defineRule({
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Forbid comments in code; the information lives in the .md docs.",
		},
		messages: {
			comment:
				"Comments are not allowed in code: the information lives in the .md docs. A game rule goes to CONTEXT.md, a file's role, invariant or hazard to its row in docs/codebase-map.md, a recipe to docs/playbooks/, a load-bearing decision to docs/adr/. Allowed in code: lint directives (`oxlint-disable…` / `eslint-disable…`) with the justification comment beside them, the `SAFETY:` comment anti-slop requires before a type assertion, `@vitest-environment`, `/// <reference …>` and a shebang.",
		},
	},
	createOnce(context) {
		return {
			Program() {
				const comments = context.sourceCode
					.getAllComments()
					.filter((comment) => !isStandaloneDirective(comment));
				for (const run of adjacentRuns(comments)) {
					if (runIsAllowed(run)) continue;
					for (const comment of run) {
						context.report({ node: comment, messageId: "comment" });
					}
				}
			},
		};
	},
});
