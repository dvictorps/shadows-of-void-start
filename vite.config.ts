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
					exclude: [
						...configDefaults.exclude,
						"tools/**",
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
			strategy: ["localStorage", "preferredLanguage", "baseLocale"],
		}),
		tailwindcss(),
		...(process.env.VITEST
			? []
			: [cloudflare({ viteEnvironment: { name: "ssr" } })]),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
