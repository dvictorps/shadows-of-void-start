import { RuleTester } from "oxlint/plugins-dev";

import { gameDeterminismRule } from "./game-determinism.ts";

const tester = new RuleTester({
	languageOptions: { parserOptions: { lang: "ts" } },
});
const randomness = { messageId: "randomness" };
const clock = { messageId: "clock" };

tester.run("shadows/game-determinism", gameDeterminismRule, {
	valid: [
		"import { randInt } from '#/lib/rng'; const roll = randInt(1, 6);",
		"function arrivesAt(now: number, travelMs: number) { return now + travelMs; }",
		"const at = new Date(startedAt);",
		"const floor = Math.floor(value * 2);",
		"const Math = { random: () => 0.5 }; const roll = Math.random();",
		"function roll(Date: { now(): number }) { return Date.now(); }",
		"const id = rng.randomUUID();",
	],
	invalid: [
		{ code: "const roll = Math.random();", errors: [randomness] },
		{ code: "const pick = Math['random']();", errors: [randomness] },
		{ code: "const source = Math.random;", errors: [randomness] },
		{ code: "const id = crypto.randomUUID();", errors: [randomness] },
		{ code: "crypto.getRandomValues(buffer);", errors: [randomness] },
		{ code: "const now = Date.now();", errors: [clock] },
		{ code: "const now = new Date();", errors: [clock] },
		{ code: "const stamp = Date();", errors: [clock] },
		{ code: "const t = performance.now();", errors: [clock] },
	],
});
