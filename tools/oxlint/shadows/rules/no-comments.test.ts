import { RuleTester } from "oxlint/plugins-dev";

import { noCommentsRule } from "./no-comments.ts";

const tester = new RuleTester({
	languageOptions: { parserOptions: { lang: "tsx" } },
});
const comment = { messageId: "comment" };

tester.run("shadows/no-comments", noCommentsRule, {
	valid: [
		"const a = 1;",
		'const url = "https://example.com/path";',
		'const glob = "src/**/*.ts";',
		"const re = /\\/\\*.*\\*\\//;",
		"const t = `// not a comment ${a} /* nor this */`;",
		"const el = <a href='http://x.y'>// text, not a comment</a>;",
		"// oxlint-disable-next-line no-console -- the CLI prints to stdout\nconsole.log(a);",
		"// oxlint-disable-next-line no-console\nconsole.log(a);",
		"console.log(a); // oxlint-disable-line no-console",
		"/* oxlint-disable no-console */\nconsole.log(a);\n/* oxlint-enable no-console */",
		"// eslint-disable-next-line no-console\nconsole.log(a);",
		"// The CLI prints to stdout, and the\n// logger is not wired up this early.\n// oxlint-disable-next-line no-console\nconsole.log(a);",
		"/* The CLI prints to stdout. */\n// oxlint-disable-next-line no-console\nconsole.log(a);",
		"// @vitest-environment jsdom\nconst a = 1;",
		'/// <reference types="vite/client" />\nconst a = 1;',
		"#!/usr/bin/env node\nconst a = 1;",
		"// SAFETY: the keys of a literal table are exactly its declared keys.\nconst k = Object.keys(t) as Key[];",
		"// SAFETY: the keys of a literal table\n// are exactly its declared keys.\nconst k = Object.keys(t) as Key[];",
		"/* SAFETY: the keys of a literal table\n   are exactly its declared keys. */\nconst k = Object.keys(t) as Key[];",
	],
	invalid: [
		{ code: "// explains the next line\nconst a = 1;", errors: [comment] },
		{ code: "const a = 1; // trailing", errors: [comment] },
		{ code: "/* block */ const a = 1;", errors: [comment] },
		{ code: "/** JSDoc */\nexport function f() {}", errors: [comment] },
		{ code: "const el = <div>{/* jsx */}</div>;", errors: [comment] },
		{ code: "// TODO: later\nconst a = 1;", errors: [comment] },
		{ code: "// see https://example.com\nconst a = 1;", errors: [comment] },
		{
			code: "// two lines\n// of prose\nconst a = 1;",
			errors: [comment, comment],
		},
		{
			code: "// prose, then a gap\n\n// oxlint-disable-next-line no-console\nconsole.log(a);",
			errors: [comment],
		},
		{
			code: "// prose before\n// SAFETY: not first in its block\nconst k = Object.keys(t) as Key[];",
			errors: [comment, comment],
		},
		{
			code: "// SAFETY: allowed\nconst k = Object.keys(t) as Key[];\n// but this is not\nconst a = 1;",
			errors: [comment],
		},
	],
});
