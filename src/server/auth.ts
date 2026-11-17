import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";

import { db } from "./db/client";
import * as schema from "./db/schema";
import { hashPassword, verifyPassword } from "./password";

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: "sqlite", schema }),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		password: { hash: hashPassword, verify: verifyPassword },
	},
	session: {
		cookieCache: { enabled: true, maxAge: 5 * 60 },
	},
	rateLimit: { enabled: true },
	advanced: {
		ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
	},
	user: {
		additionalFields: {
			role: {
				type: [...schema.USER_ROLES],
				required: false,
				defaultValue: "user",
				input: false,
			},
		},
	},
	plugins: [tanstackStartCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
