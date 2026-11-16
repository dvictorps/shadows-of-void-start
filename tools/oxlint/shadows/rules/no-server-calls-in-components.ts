import { defineRule } from "@oxlint/plugins";

import {
	moduleMatches,
	moduleSourceVisitors,
	stringListOption,
} from "../shared/modules.ts";

/**
 * Components don't call the server. A component that reaches the tRPC client,
 * a query hook or a `use*Mutations` bundle can only be tested with the whole
 * transport mounted, so it goes untested, and an untested component only
 * grows (InventoryModal, CombatScene). The route or a hook makes the calls and
 * hands them down: data as props, calls as a `server` prop typed by an
 * interface the component declares (`InventoryServer`, `ExitFlowServer`).
 * `import type` stays allowed, so that interface can derive its argument
 * types from the hook.
 */
export const noServerCallsInComponentsRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Components take server data and calls as props; they don't import the tRPC client, query hooks or mutation bundles.",
		},
		messages: {
			serverCall:
				"Components don't call the server: `{{source}}` makes this one untestable without the whole tRPC transport. Let the route or a hook make the call, and pass the data as props and the calls as a `server` prop (an interface the component declares, like `InventoryServer` in InventoryModal.tsx). `import type` from the hook is fine for that interface. See docs/playbooks/adding-a-world-component.md.",
		},
		schema: [
			{
				type: "object",
				properties: {
					modules: { type: "array", items: { type: "string" } },
					patterns: { type: "array", items: { type: "string" } },
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{ modules: [], patterns: [] }],
	},
	create(context) {
		const modules = stringListOption(context.options, "modules");
		const patterns = stringListOption(context.options, "patterns").map(
			(pattern) => new RegExp(pattern, "u"),
		);
		return moduleSourceVisitors(
			context,
			"serverCall",
			({ module, typeOnly }) =>
				!typeOnly &&
				(modules.some((entry) => moduleMatches(module, entry)) ||
					patterns.some((pattern) => pattern.test(module))),
		);
	},
});
