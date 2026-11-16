import { RuleTester } from "oxlint/plugins-dev";

import { noServerCallsInComponentsRule } from "./no-server-calls-in-components.ts";

const tester = new RuleTester({
	languageOptions: { parserOptions: { lang: "ts" } },
});
const error = { messageId: "serverCall" };
const options = [
	{
		modules: [
			"#/integrations/trpc",
			"@trpc/tanstack-react-query",
			"@tanstack/react-query",
		],
		patterns: ["^#/hooks/use\\w*Mutations$"],
	},
];
const filename = "/repo/src/components/world/SomeModal.tsx";

tester.run(
	"shadows/no-server-calls-in-components",
	noServerCallsInComponentsRule,
	{
		valid: [
			{
				// The server interface derives its argument types from the hook.
				code: 'import type { useInventoryMutations } from "#/hooks/useInventoryMutations";',
				options,
				filename,
			},
			{
				code: 'import type { RouterOutputs } from "#/integrations/trpc/client";',
				options,
				filename,
			},
			{
				code: 'import { useModal } from "#/hooks/useModal";',
				options,
				filename,
			},
			{
				code: 'import { useMutationObserver } from "#/hooks/useMutationObserver";',
				options,
				filename,
			},
			{
				code: 'import { toast } from "sonner";',
				options,
				filename,
			},
			{
				code: 'export type { RouterOutputs } from "#/integrations/trpc/client";',
				options,
				filename,
			},
			{
				// The error class, not a call (component tests build rule errors).
				code: 'import { TRPCClientError } from "@trpc/client";',
				options,
				filename,
			},
		],
		invalid: [
			{
				code: 'import { useTRPC } from "#/integrations/trpc/client";',
				options,
				filename,
				errors: [error],
			},
			{
				code: 'import { useQuery } from "@tanstack/react-query";',
				options,
				filename,
				errors: [error],
			},
			{
				code: 'import { useInventoryMutations } from "#/hooks/useInventoryMutations";',
				options,
				filename,
				errors: [error],
			},
			{
				code: 'import { useWorldMutations } from "../../hooks/useWorldMutations";',
				options,
				filename,
				errors: [error],
			},
			{
				code: 'const m = await import("#/integrations/trpc/client");',
				options,
				filename,
				errors: [error],
			},
			{
				code: 'import { createTRPCContext } from "@trpc/tanstack-react-query";',
				options,
				filename,
				errors: [error],
			},
			{
				// verbatimModuleSyntax keeps `import {} from "…"`: the module loads.
				code: 'import { type RouterOutputs } from "#/integrations/trpc/client";',
				options,
				filename,
				errors: [error],
			},
			{
				code: 'export { useTRPC } from "#/integrations/trpc/client";',
				options,
				filename,
				errors: [error],
			},
			{
				code: 'export * from "@tanstack/react-query";',
				options,
				filename,
				errors: [error],
			},
			{
				code: 'import { x } from "@tanstack/react-query/build/modern";',
				options,
				filename,
				errors: [error],
			},
		],
	},
);
