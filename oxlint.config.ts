import { defineConfig } from "oxlint";

const GAME_IMPORT_ALLOWLIST = [
	"#/game",
	"#/lib/rng",
	"#/lib/server-errors",
	"#/paraglide",
];

const SERVER_CALL_MODULES = {
	modules: [
		"#/integrations/trpc",
		"@trpc/tanstack-react-query",
		"@tanstack/react-query",
	],
	patterns: ["^#/hooks/use\\w*Mutations$"],
};

export default defineConfig({
	options: { typeAware: true },
	ignorePatterns: [
		".claude/**",
		".output/**",
		".nitro/**",
		".tanstack/**",
		".wrangler/**",
		"dist/**",
		"public/**",
		"src/routeTree.gen.ts",
		"src/paraglide/**",
		"worker-configuration.d.ts",
		"tools/oxlint/anti-slop/**",
	],
	plugins: [
		"typescript",
		"unicorn",
		"react",
		"oxc",
		"import",
		"promise",
		"node",
		"vitest",
	],
	jsPlugins: [
		"@shadcn/lint",
		{ name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
		{
			name: "you-might-not-need-an-effect",
			specifier: "./tools/oxlint/you-might-not-need-an-effect/index.ts",
		},
		{ name: "shadows", specifier: "./tools/oxlint/shadows/index.ts" },
	],
	env: {
		browser: true,
		node: true,
	},
	settings: {
		shadcn: { ui: "#/components/ui" },
	},
	categories: {
		correctness: "error",
		suspicious: "error",
		perf: "error",
		pedantic: "error",
	},
	rules: {
		"react/react-in-jsx-scope": "off",
		"max-lines": "off",
		"max-lines-per-function": "off",
		"max-depth": "off",
		"max-classes-per-file": "off",
		"no-redeclare": "off",
		"no-unused-vars": [
			"error",
			{
				varsIgnorePattern: "^_",
				argsIgnorePattern: "^_",
				caughtErrorsIgnorePattern: "^_",
				destructuredArrayIgnorePattern: "^_",
			},
		],
		complexity: ["error", { max: 20 }],
		"import/max-dependencies": "off",
		"no-inline-comments": "off",
		"no-underscore-dangle": "off",
		"no-negated-condition": "off",
		"unicorn/no-negated-condition": "off",
		"no-warning-comments": "off",
		"sort-vars": "off",
		"require-unicode-regexp": "off",
		"unicorn/no-array-callback-reference": "off",
		"unicorn/consistent-function-scoping": "off",
		"unicorn/prefer-top-level-await": "off",
		"vitest/no-conditional-in-test": "off",
		"vitest/expect-expect": [
			"error",
			{ assertFunctionNames: ["expect", "expectServerError"] },
		],
		"no-await-in-loop": "off",
		"require-await": "off",
		"typescript/require-await": "off",
		"typescript/prefer-readonly-parameter-types": "off",
		"typescript/strict-boolean-expressions": "off",
		"typescript/no-confusing-void-expression": "off",
		"typescript/strict-void-return": "off",
		"typescript/consistent-return": "off",
		"typescript/no-unnecessary-type-parameters": "off",
		"typescript/no-unsafe-type-assertion": "off",
		"typescript/prefer-nullish-coalescing": [
			"error",
			{ ignorePrimitives: { boolean: true, number: true, string: true } },
		],
		"typescript/switch-exhaustiveness-check": [
			"error",
			{ considerDefaultExhaustiveForUnions: true },
		],
		"typescript/no-floating-promises": "error",
		"typescript/no-misused-promises": [
			"error",
			{ checksVoidReturn: { attributes: false } },
		],
		"typescript/only-throw-error": [
			"error",
			{
				allow: [
					{
						from: "package",
						package: "@tanstack/router-core",
						name: "Redirect",
					},
				],
			},
		],
		"typescript/await-thenable": "error",
		"shadows/no-unvalidated-json-parse": "error",
		"shadows/no-comments": "error",
		"react/no-unstable-nested-components": ["error", { allowAsProps: true }],
		"react/no-array-index-key": "off",
		"react-hooks/exhaustive-deps": "error",
		"react/incompatible-library": "warn",
		"import/no-named-as-default": "off",
		"oxc/no-map-spread": "off",
		eqeqeq: ["error", "always", { null: "ignore" }],
		"import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
		"anti-slop/no-chained-type-assertions": "error",
		"anti-slop/no-conditional-empty-object-spread": "error",
		"anti-slop/no-known-value-widening": "error",
		"anti-slop/no-module-mocking": "error",
		"anti-slop/no-object-parameters": "error",
		"anti-slop/no-reflect-apply": "error",
		"anti-slop/no-reflect-get": "error",
		"anti-slop/no-runtime-typeof": ["error", { allowInTypeGuards: true }],
		"anti-slop/no-shape-in-symbol-names": "error",
		"anti-slop/no-unknown-parameters": "error",
		"anti-slop/no-unknown-returns": "error",
		"anti-slop/no-unknown-type-aliases": "error",
		"anti-slop/no-unsafe-dictionary-type": "error",
		"anti-slop/no-widen-then-assert": "error",
		"anti-slop/require-safety-comment-for-type-assertion": "error",
		"you-might-not-need-an-effect/no-adjust-state-on-prop-change": "warn",
		"you-might-not-need-an-effect/no-chain-state-updates": "error",
		"you-might-not-need-an-effect/no-derived-state": "error",
		"you-might-not-need-an-effect/no-event-handler": "warn",
		"you-might-not-need-an-effect/no-external-store-subscription": "error",
		"you-might-not-need-an-effect/no-initialize-state": "error",
		"you-might-not-need-an-effect/no-pass-data-to-parent": "warn",
		"you-might-not-need-an-effect/no-pass-live-state-to-parent": "error",
		"you-might-not-need-an-effect/no-reset-all-state-on-prop-change": "error",
		"shadcn/no-restyle": ["error", { allow: ["layout"] }],
		"shadcn/no-raw-colors": "error",
		"shadcn/no-arbitrary-values": "error",
		"shadcn/no-inline-styles": "error",
		"shadcn/no-unknown-classes": "error",
		"shadcn/require-static-classes": "error",
		"react/forbid-elements": [
			"error",
			{
				forbid: [
					{
						element: "button",
						message: "Use <Button> from #/components/ui/button.",
					},
					{
						element: "select",
						message:
							"Use <NativeSelect> from #/components/ui/native-select (the browser's picker) or <Select> from #/components/ui/select (the Radix menu).",
					},
					{
						element: "textarea",
						message: "Use <Textarea> from #/components/ui/textarea.",
					},
				],
			},
		],
	},
	overrides: [
		{
			files: ["**/*.d.ts"],
			rules: { "import/no-unassigned-import": "off" },
		},
		{
			files: ["src/components/ui/**"],
			rules: {
				"react/forbid-elements": "off",
				"shadcn/no-restyle": "off",
				"you-might-not-need-an-effect/no-event-handler": "off",
			},
		},
		{
			files: ["src/components/world/**", "src/components/game/**"],
			rules: {
				"shadcn/no-restyle": "off",
				"shadcn/no-raw-colors": "off",
				"shadcn/no-arbitrary-values": "off",
				"shadcn/no-inline-styles": "off",
				"shadcn/no-unknown-classes": "off",
				"shadcn/require-static-classes": "off",
			},
		},
		{
			files: ["tools/oxlint/**"],
			rules: { "anti-slop/no-runtime-typeof": "off" },
		},
		{
			files: [
				"tools/oxlint/you-might-not-need-an-effect/**",
				"docs/playbooks/_examples/**",
			],
			rules: { "shadows/no-comments": "off" },
		},
		{
			files: ["src/game/**"],
			rules: {
				"shadows/game-imports": ["error", { allow: GAME_IMPORT_ALLOWLIST }],
				"shadows/game-determinism": "error",
			},
		},
		{
			files: ["src/game/**/*.test.ts"],
			rules: {
				"shadows/game-imports": [
					"error",
					{ allow: [...GAME_IMPORT_ALLOWLIST, "vitest"] },
				],
			},
		},
		{
			files: ["src/server/trpc/routers/**"],
			rules: {
				"shadows/require-session-procedure": [
					"error",
					{
						procedures: ["characterSessionProcedure", "adminProcedure"],
						allow: [
							"characters.create",
							"characters.remove",
							"characters.claimCharacterSession",
						],
					},
				],
			},
		},
		{
			files: ["src/**"],
			rules: {
				"shadows/server-only-imports": [
					"error",
					{ modules: ["#/server", "drizzle-orm", "@trpc/server"] },
				],
			},
		},
		{
			files: [
				"src/server/**",
				"src/server.ts",
				"src/routes/api/**",
				"src/integrations/trpc/client.ts",
			],
			rules: { "shadows/server-only-imports": "off" },
		},
		{
			files: ["src/components/**"],
			rules: {
				"shadows/no-server-calls-in-components": ["error", SERVER_CALL_MODULES],
			},
		},
	],
});
