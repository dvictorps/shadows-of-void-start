import { RuleTester } from "oxlint/plugins-dev";

import { requireSessionProcedureRule } from "./require-session-procedure.ts";

const tester = new RuleTester({
	languageOptions: { parserOptions: { lang: "ts" } },
});
const error = { messageId: "missingSession" };
const options = [
	{
		procedures: ["characterSessionProcedure", "adminProcedure"],
		allow: ["characters.create", "characters.claimCharacterSession"],
	},
];
const filename = "/repo/src/server/trpc/routers/characters.ts";
const combat = "/repo/src/server/trpc/routers/combat.ts";

tester.run("shadows/require-session-procedure", requireSessionProcedureRule, {
	valid: [
		{
			code: "export const r = router({ syncHp: characterSessionProcedure.input(schema).mutation(async () => {}) });",
			options,
			filename: combat,
		},
		{
			code: "export const r = router({ enterCity: characterSessionProcedure.mutation(async () => {}) });",
			options,
			filename: combat,
		},
		{
			code: "export const r = router({ setUserRole: adminProcedure.input(schema).mutation(async () => {}) });",
			options,
			filename,
		},
		{
			code: "export const r = router({ create: authedProcedure.input(schema).mutation(async () => {}) });",
			options,
			filename,
		},
		{
			code: "export const r = router({ list: authedProcedure.query(async () => []) });",
			options,
			filename,
		},
		{
			code: "export const r = router({ 'claimCharacterSession': authedProcedure.mutation(async () => {}) });",
			options,
			filename,
		},
	],
	invalid: [
		{
			code: "export const r = router({ remove: authedProcedure.input(schema).mutation(async () => {}) });",
			options,
			filename,
			errors: [error],
		},
		{
			code: "export const r = router({ syncHp: publicProcedure.input(schema).mutation(async () => {}) });",
			options,
			filename: combat,
			errors: [error],
		},
		{
			code: "export const r = router({ create: authedProcedure.mutation(async () => {}) });",
			options,
			filename: combat,
			errors: [error],
		},
		{
			code: "const base = authedProcedure; export const r = router({ syncHp: base.mutation(async () => {}) });",
			options,
			filename: combat,
			errors: [error],
		},
		{
			code: "export const r = router({ syncHp: makeProcedure().mutation(async () => {}) });",
			options,
			filename: combat,
			errors: [error],
		},
	],
});
