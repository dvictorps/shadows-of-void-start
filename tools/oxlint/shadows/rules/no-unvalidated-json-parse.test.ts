import { RuleTester } from "oxlint/plugins-dev";

import { noUnvalidatedJsonParseRule } from "./no-unvalidated-json-parse.ts";

const tester = new RuleTester({
	languageOptions: { parserOptions: { lang: "ts" } },
});
const error = { messageId: "unvalidated" };

tester.run("shadows/no-unvalidated-json-parse", noUnvalidatedJsonParseRule, {
	valid: [
		"const flash = FlashSchema.safeParse(JSON.parse(raw));",
		"const flash = FlashSchema.parse(JSON.parse(raw));",
		"const flash = await FlashSchema.parseAsync(JSON.parse(raw));",
		"const parsed: unknown = JSON.parse(raw);",
		"const parsed = JSON.parse(raw) as unknown;",
		"const text = JSON.stringify(value);",
		"const JSON = { parse: (raw: string) => raw.length }; const n = JSON.parse(raw);",
	],
	invalid: [
		{ code: "const flash = JSON.parse(raw);", errors: [error] },
		{ code: "const flash = JSON.parse(raw) as Flash;", errors: [error] },
		{ code: "const flash: Flash = JSON.parse(raw);", errors: [error] },
		{ code: "use(JSON.parse(raw));", errors: [error] },
		{
			code: "const flash = FlashSchema.parse(JSON.parse(raw).payload);",
			errors: [error],
		},
		{
			code: "const flash = FlashSchema.safeParse(other, JSON.parse(raw));",
			errors: [error],
		},
		{ code: "const flash = JSON['parse'](raw);", errors: [error] },
		{
			code: "const flash = FlashSchema.parse(JSON.parse(JSON.parse(raw)));",
			errors: [error],
		},
		{ code: "const at = Date.parse(JSON.parse(raw));", errors: [error] },
	],
});
