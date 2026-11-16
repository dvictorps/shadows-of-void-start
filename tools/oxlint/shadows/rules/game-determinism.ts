import { defineRule } from "@oxlint/plugins";

import { isGlobalObject, memberName } from "../shared/globals.ts";

type AmbientSource = { object: string; messageId: "randomness" | "clock" };

// Method name → the global it must be read from to count as ambient.
const AMBIENT_METHODS = new Map<string, AmbientSource[]>([
	["random", [{ object: "Math", messageId: "randomness" }]],
	["randomUUID", [{ object: "crypto", messageId: "randomness" }]],
	["getRandomValues", [{ object: "crypto", messageId: "randomness" }]],
	[
		"now",
		[
			{ object: "Date", messageId: "clock" },
			{ object: "performance", messageId: "clock" },
		],
	],
]);

/**
 * `src/game` never reads the clock or an ambient random source. Time enters as
 * a parameter; randomness goes through `#/lib/rng`, the one seam a test (or a
 * future seeded RNG) can replace.
 *
 * Out of scope on purpose: aliasing the globals (`globalThis.crypto…`,
 * `const { random } = Math`). The rule stops the accidental call, not a
 * deliberate workaround, which review catches.
 */
export const gameDeterminismRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow ambient clock and random-source reads (Date.now, new Date(), performance.now, Math.random, crypto.randomUUID) in src/game.",
		},
		messages: {
			randomness:
				"`{{name}}` is an ambient random source; src/game draws randomness only through `#/lib/rng` (randomUnit, chance, randInt, randSymmetric, pickRandom, pickWeighted, randomId). Use those, or add the helper there, so every roll goes through one replaceable seam.",
			clock:
				"`{{name}}` reads the clock; src/game takes time as a parameter. Add a `now: number` (epoch ms) parameter and let the caller (the tRPC procedure or the hook) pass `Date.now()`.",
		},
	},
	createOnce(context) {
		return {
			MemberExpression(node) {
				const method = memberName(node);
				if (method === null) return;
				for (const { object, messageId } of AMBIENT_METHODS.get(method) ?? []) {
					if (isGlobalObject(context.sourceCode, node.object, object)) {
						context.report({
							node,
							messageId,
							data: { name: `${object}.${method}` },
						});
						return;
					}
				}
			},
			NewExpression(node) {
				if (
					node.arguments.length === 0 &&
					isGlobalObject(context.sourceCode, node.callee, "Date")
				) {
					context.report({
						node,
						messageId: "clock",
						data: { name: "new Date()" },
					});
				}
			},
			CallExpression(node) {
				if (isGlobalObject(context.sourceCode, node.callee, "Date")) {
					context.report({
						node,
						messageId: "clock",
						data: { name: "Date()" },
					});
				}
			},
		};
	},
});
