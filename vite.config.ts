import { cloudflare } from "@cloudflare/vite-plugin";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

const config = defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					// Lint-rule tests run under node --test (pnpm test:lint-rules).
					// Integration tests need workerd: vitest.workers.config.ts.
					exclude: [
						...configDefaults.exclude,
						"tools/**",
						// Agent worktrees are full repo copies.
						".claude/**",
						"**/*.integration.test.ts",
					],
				},
			},
			"./vitest.workers.config.ts",
		],
	},
	plugins: [
		devtools(),
		paraglideVitePlugin({
			project: "./project.inlang",
			outdir: "./src/paraglide",
			// SPA without locale-prefixed routes (no /en/world etc.) — use a
			// localStorage-backed strategy so language is a user preference, not a
			// URL segment. preferredLanguage seeds from the browser the first time.
			strategy: ["localStorage", "preferredLanguage", "baseLocale"],
		}),
		tailwindcss(),
		// Workers runtime for SSR + server routes (replaces nitro). Skipped under
		// Vitest: the unit tests are plain Node and never need workerd.
		...(process.env.VITEST
			? []
			: [cloudflare({ viteEnvironment: { name: "ssr" } })]),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
