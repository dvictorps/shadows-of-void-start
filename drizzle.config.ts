import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only diffs the schema against `drizzle/meta`, so it
// needs no database credentials. Migrations are applied by wrangler, which
// reads the same folder (`migrations_dir` in wrangler.jsonc):
//   pnpm db:migrate:local | db:migrate:staging | db:migrate:production
export default defineConfig({
	schema: "./src/server/db/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	casing: "snake_case",
});
