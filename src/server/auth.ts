import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";

import { db } from "./db/client";
import * as schema from "./db/schema";
import { hashPassword, verifyPassword } from "./password";

// Module scope is fine on Workers: `cloudflare:workers` exposes bindings and
// secrets before the first request.
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
		// Signed session cookie that skips the D1 session lookup for 5 min.
		// Every tRPC call resolves the session, so this saves a read per
		// request. A revoked session can live up to `maxAge` on other devices.
		cookieCache: { enabled: true, maxAge: 5 * 60 },
	},
	// Better Auth's default is `NODE_ENV === "production"`; don't let a build
	// mode decide whether sign-in is rate limited.
	rateLimit: { enabled: true },
	advanced: {
		// Cloudflare puts the client IP here. Without it Better Auth skips its
		// rate limiter (per-isolate memory store: a speed bump against
		// password guessing, not a hard guarantee).
		ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
	},
	user: {
		additionalFields: {
			// Replaces Convex's `userRoles`. `input: false` keeps sign-up from
			// setting it. Promote admins with SQL (`wrangler d1 execute`).
			role: {
				type: [...schema.USER_ROLES],
				required: false,
				defaultValue: "user",
				input: false,
			},
		},
	},
	// Must stay last: lets server functions that call auth.api set cookies.
	plugins: [tanstackStartCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
