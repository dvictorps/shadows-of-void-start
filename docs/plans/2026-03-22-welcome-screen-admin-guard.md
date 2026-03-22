# Welcome Screen & Admin Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a welcome screen post-login and protect `/admin/*` routes so only admin users can access them.

**Architecture:** Create an app-level `userRoles` table in Convex (separate from Better Auth's internal user table) to store role assignments. Backend queries check role via `authComponent.getAuthUser()` + `userRoles` lookup. Frontend uses `useQuery` for conditional rendering and `createServerFn` + `beforeLoad` for route guards. Default role is `"user"` — only admins have explicit records.

**Tech Stack:** Convex (schema + queries/mutations), Better Auth (`authComponent.getAuthUser`), TanStack Router (`beforeLoad` guard), TanStack Start (`createServerFn`), React + Tailwind CSS

---

## Task 1: Add `userRoles` Table to Convex Schema

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Update the schema**

```ts
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
	userRoles: defineTable({
		authUserId: v.string(),
		role: v.union(v.literal("user"), v.literal("admin")),
	}).index("by_authUserId", ["authUserId"]),
})
```

**Step 2: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add userRoles table to Convex schema"
```

---

## Task 2: Create Backend Queries & Mutations

**Files:**
- Create: `convex/users.ts`

**Step 1: Implement queries and mutations**

```ts
import { ConvexError, v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { authComponent } from "./auth"

/**
 * Returns the current user's role. Defaults to "user" if no record exists.
 */
export const getUserRole = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return null

		const roleRecord = await ctx.db
			.query("userRoles")
			.withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
			.unique()

		return {
			role: roleRecord?.role ?? "user",
			name: authUser.name,
			email: authUser.email,
		}
	},
})

/**
 * Returns true if the current user is an admin.
 */
export const isAdmin = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) return false

		const roleRecord = await ctx.db
			.query("userRoles")
			.withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
			.unique()

		return roleRecord?.role === "admin"
	},
})

/**
 * Sets a user's role. Only callable by existing admins.
 * For bootstrapping the first admin, use Convex dashboard to insert directly.
 */
export const setUserRole = mutation({
	args: {
		authUserId: v.string(),
		role: v.union(v.literal("user"), v.literal("admin")),
	},
	handler: async (ctx, { authUserId, role }) => {
		// Check caller is admin
		const callerAuth = await authComponent.getAuthUser(ctx)
		if (!callerAuth) throw new ConvexError("Not authenticated")

		const callerRole = await ctx.db
			.query("userRoles")
			.withIndex("by_authUserId", (q) => q.eq("authUserId", callerAuth._id))
			.unique()

		if (callerRole?.role !== "admin") {
			throw new ConvexError("Only admins can change roles")
		}

		// Upsert target user's role
		const existing = await ctx.db
			.query("userRoles")
			.withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
			.unique()

		if (existing) {
			await ctx.db.patch(existing._id, { role })
		} else {
			await ctx.db.insert("userRoles", { authUserId, role })
		}
	},
})
```

**Step 2: Verify types compile**

```bash
npx convex dev --once
```

**Step 3: Commit**

```bash
git add convex/users.ts
git commit -m "feat: add user role queries and setUserRole mutation"
```

---

## Task 3: Redesign Welcome Screen

**Files:**
- Modify: `src/routes/index.tsx`

**Step 1: Rewrite the home page**

```tsx
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { authClient } from "#/lib/auth-client"
import { Button } from "#/components/ui/button"
import { api } from "../../convex/_generated/api"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
	const { data: session } = authClient.useSession()

	if (!session?.user) {
		return <LandingPage />
	}

	return <WelcomeScreen />
}

function LandingPage() {
	return (
		<main className="flex min-h-[70vh] items-center justify-center px-4">
			<div className="text-center">
				<h1 className="display-title text-4xl font-bold tracking-tight sm:text-5xl">
					Shadows of Void
				</h1>
				<p className="mt-4 text-lg text-neutral-500 dark:text-neutral-400">
					An ARPG with automatic combat. Gear up, loot, conquer.
				</p>
				<div className="mt-8">
					<Link to="/sign-in">
						<Button size="lg">Get started</Button>
					</Link>
				</div>
			</div>
		</main>
	)
}

function WelcomeScreen() {
	const { data: session } = authClient.useSession()
	const userRole = useQuery(api.users.getUserRole)
	const userName = session?.user?.name || session?.user?.email || "Adventurer"
	const isAdmin = userRole?.role === "admin"

	return (
		<main className="flex min-h-[70vh] items-center justify-center px-4">
			<div className="island-shell w-full max-w-lg rounded-2xl p-8 text-center">
				<p className="island-kicker mb-2">Welcome back</p>
				<h1 className="display-title text-3xl font-bold tracking-tight sm:text-4xl">
					{userName}
				</h1>
				<p className="mt-4 text-sm text-[var(--sea-ink-soft)]">
					The void awaits. Prepare your gear and face the shadows.
				</p>

				<div className="mt-8 flex flex-col items-center gap-3">
					{isAdmin && (
						<Link to="/admin" className="no-underline">
							<Button variant="outline" className="gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
								</svg>
								Admin Dashboard
							</Button>
						</Link>
					)}
				</div>
			</div>
		</main>
	)
}
```

**Step 2: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat: redesign home page with welcome screen and conditional admin button"
```

---

## Task 4: Protect Admin Routes (Frontend)

**Files:**
- Modify: `src/routes/admin.tsx`

**Step 1: Add beforeLoad guard with createServerFn**

```tsx
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { fetchAuthQuery } from "#/lib/auth-server"
import { api } from "../../convex/_generated/api"

const checkIsAdmin = createServerFn({ method: "GET" }).handler(async () => {
	return await fetchAuthQuery(api.users.isAdmin)
})

export const Route = createFileRoute("/admin")({
	beforeLoad: async ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/sign-in" })
		}

		const isAdmin = await checkIsAdmin()
		if (!isAdmin) {
			throw redirect({ to: "/" })
		}
	},
	component: AdminLayout,
})

function AdminLayout() {
	return (
		<div className="flex min-h-[calc(100vh-64px)]">
			<aside className="w-52 shrink-0 border-r border-[var(--line)] bg-neutral-50 p-4 dark:bg-neutral-900/50">
				<h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-neutral-400">
					Admin
				</h2>
				<nav className="space-y-1">
					<Link
						to="/admin/items"
						className="block rounded-md px-3 py-2 text-sm font-medium text-neutral-700 no-underline transition hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
						activeProps={{
							className:
								"block rounded-md px-3 py-2 text-sm font-medium no-underline bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100",
						}}
					>
						Item Generator
					</Link>
				</nav>
			</aside>
			<main className="flex-1 p-6">
				<Outlet />
			</main>
		</div>
	)
}
```

**Step 2: Commit**

```bash
git add src/routes/admin.tsx
git commit -m "feat: add auth + admin guard to /admin routes via beforeLoad"
```

---

## Task 5: Backend Protection Helper

The `assertAdmin` pattern is already demonstrated in `setUserRole`. For any future admin-only query/mutation, use this pattern at the top:

```ts
const authUser = await authComponent.getAuthUser(ctx)
if (!authUser) throw new ConvexError("Not authenticated")

const roleRecord = await ctx.db
	.query("userRoles")
	.withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
	.unique()

if (roleRecord?.role !== "admin") {
	throw new ConvexError("Admin access required")
}
```

This is already covered by Task 2's `setUserRole` mutation. No additional files needed until more admin endpoints are added.

---

## Task 6: Bootstrap First Admin

**Manual step via Convex Dashboard:**

1. Open the Convex dashboard for `dev:quick-bee-700`
2. Find the auth user's `_id` from the Better Auth component tables
3. Insert into `userRoles`: `{ authUserId: "<the_id>", role: "admin" }`

Alternatively, temporarily add a seed mutation (remove after use):

```ts
// Temporary — add to convex/users.ts, remove after bootstrapping
export const bootstrapAdmin = mutation({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.getAuthUser(ctx)
		if (!authUser) throw new ConvexError("Not authenticated")
		await ctx.db.insert("userRoles", {
			authUserId: authUser._id,
			role: "admin",
		})
	},
})
```

---

## Acceptance Checklist

- [ ] After login, user sees welcome screen with their name
- [ ] "Admin Dashboard" button appears ONLY for admin users
- [ ] Navigating to `/admin` without admin role redirects to `/`
- [ ] Navigating to `/admin` without auth redirects to `/sign-in`
- [ ] `setUserRole` mutation rejects non-admin callers
- [ ] No regressions to existing functionality
