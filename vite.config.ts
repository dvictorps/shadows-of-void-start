import { cloudflare } from "@cloudflare/vite-plugin";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

process.env.SHADOWS_BUILD_ID ??= new Date().toISOString();
const BUILD_ID = process.env.SHADOWS_BUILD_ID;

const config = defineConfig({
	define: {
		__BUILD_ID__: JSON.stringify(BUILD_ID),
	},
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
			strategy: ["globalVariable", "cookie", "preferredLanguage", "baseLocale"],
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
