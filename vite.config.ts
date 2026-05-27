import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: {
		tsconfigPaths: true,
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
		tanstackStart(),
		nitro(),
		viteReact(),
	],
});

export default config;
