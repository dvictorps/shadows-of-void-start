# 0009 — Leave Convex: Cloudflare Workers + D1 + Drizzle + tRPC

**Status**: Accepted (shipped — production cutover 2026-11-16, see "Update (phase 4)")
**Date**: 2026-11-15

## Context

The backend is Convex: ~3.3k lines under `convex/`, 84 functions (53 queries, 31 mutations, 4 internal mutations, 1 internal action), 7 tables, one hourly cron, Better Auth via the `@convex-dev/better-auth` component. The frontend is TanStack Start (SSR via Nitro) and talks to Convex through `@convex-dev/react-query`.

Convex's cost model is the problem. The gameplay loop is a stream of small, frequent writes (`recordKill`, `syncHp`, inventory moves), and every write also re-runs every reactive query subscribed to the touched documents — each of those re-runs is a billed function call plus bandwidth. A previous plan (`docs/plans/2026-05-28-convex-bandwidth-v3.md`, retired in phase 3; see git history) already spent effort denormalizing to tame this. The game is mostly single-player state; it pays for reactivity it barely uses.

Constraints set by the owner:

- Host everything on Cloudflare, on the **Workers Free plan** (solo testing for now).
- **No data migration** — the new database starts empty; production Convex data is discarded at cutover.

## Decision

One Cloudflare Worker serves the whole app:

| Concern                  | Choice                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| SSR + static assets      | TanStack Start, built for Workers                                                                             |
| Database                 | **D1** (SQLite), one database per environment (`staging`, `production`)                                       |
| Query layer / migrations | **Drizzle ORM** + `drizzle-kit` (D1 driver)                                                                   |
| API                      | **tRPC** mounted at the `/api/trpc/$` server route (fetch adapter), consumed via `@trpc/tanstack-react-query` |
| Auth                     | **Better Auth** with the Drizzle adapter on D1, still served at `/api/auth/$`                                 |
| Cron                     | Workers **Cron Trigger** (`scheduled` handler) replaces `convex/crons.ts`                                     |
| Errors                   | `TRPCError` with the same message strings, so `translateServerError` keeps working                            |

Rules that carry over unchanged in intent:

- **Pure decisions stay in `src/game/`**; procedures are thin auth + IO wrappers (the extraction pattern from PRs #68/#69).
- **Optimistic updates** (ADR 0001) keep the same must / must-not lists; the mechanism moves from `withOptimisticUpdate(localStore)` to react-query `onMutate` / `setQueryData` with rollback in `onError`.
- **Single active session per character** (threat #5) keeps the `activeSessionToken` check, now as a tRPC middleware.
- **Leaderboard snapshot** (ADR 0006) keeps the cron-written snapshot table; clients refetch on an interval instead of subscribing.

Because nothing is migrated, the schema is rebuilt clean: the legacy fields that `characters` kept as a lazy-migration fallback (progression arrays, combat-state fields duplicated in `combatState`) are dropped. Structured blobs (`items.data`, arrays, `bossKillCounts`) are JSON text columns typed through Drizzle's `$type<>()` — `src/game/items/types` stays the single type source, which also retires the hand-synced `convex/itemValidator.ts` hazard.

## Alternatives considered

### Elysia instead of tRPC

- **Pro**: fast, ergonomic, Eden gives an end-to-end typed client.
- **Con**: Bun-first; Workers is a secondary target through an adapter. It is a whole server framework when the app already has one (TanStack Start server routes). Nothing it offers here beats tRPC + react-query, which matches the existing query-cache model one-to-one.

### TanStack Start server functions instead of tRPC

- **Pro**: zero extra dependency.
- **Con**: weaker react-query integration (query keys, invalidation, optimistic helpers are hand-rolled), and the API surface is scattered across route files instead of one router mirroring the old `convex/*.ts` modules. Revisit if tRPC ever becomes friction.

### Prisma instead of Drizzle

- **Pro**: familiar, rich tooling.
- **Con**: heavier bundle against the Worker size limit, slower cold starts, D1 migrations are a second-class path. Drizzle is SQL-shaped, edge-native, and its `$type<>()` columns fit the JSON-blob items model.

### Durable Objects (SQLite-in-DO) as the primary store

- **Pro**: real interactive transactions, per-character serialization for free.
- **Con**: cross-character reads (leaderboard, admin dashboard) need a second store anyway. Kept as the escalation path for the race below, not the starting point.

## Trade-offs accepted

- **No interactive transactions.** Convex mutations were serializable; D1 only offers atomic `batch()`. Procedures must read, decide in `src/game/`, then commit all writes in one `batch()`, and prefer single-statement guards where SQL can express them (`UPDATE … SET potions = potions - 1 WHERE potions > 0`). Two _concurrent_ requests for the same character can still interleave read-modify-write (e.g. a tampered client firing parallel `recordKill`). `activeSessionToken` + the client's in-flight guard cover honest clients. Accepted while the game is solo-tested; logged in `docs/security/threat-model.md`. Escalation path: a per-character Durable Object used as a mutex in front of D1.
- **No reactivity.** Every mutation must return the new state or invalidate the right query keys. Mostly single-player, so this is cheap; cross-session freshness (admin dashboard, leaderboard) becomes interval refetch.
- **Free-plan CPU budget (10 ms per request, I/O wait excluded).** `recordKill` (drop rolls + item generation) is the hot path most likely to exceed it. Measure on staging before cutover; optimize the path before considering a paid plan.
- **Integration tests change harness.** The queued `convex-test` harness is superseded by `@cloudflare/vitest-pool-workers` running procedures against a real local D1.

## Update (2026-11-16, phase 1 shipped on `feat/cloudflare-phase-1`)

Decisions made while building the skeleton that refine the text above:

- **Server code lives in `src/server/`**, not a root `server/`, so it imports `src/game` through the `#/` alias like the rest of the app. The Worker entry is `src/server.ts`.
- **`combatState` and `characterProgression` are folded back into `characters`.** Convex split them to keep reactive payloads small. D1 has no reactivity, and its Free quota counts rows written, so one row per kill beats three. The phase 2 `combatState` / `characterProgression` sub-routers keep their names but read and write columns of `characters`.
- **`userRoles` becomes `user.role`**, a Better Auth `additionalFields` entry with `input: false`. The denormalized `characterCount` / `hardcoreCount` are dropped; the admin queries count with SQL.
- **Leaderboard indexes are dropped.** `(hardcore, level, xp)` would cost an index write on every kill; the hourly cron scans `characters` instead. `equippedWeaponId` is also dropped (the `items` character index answers it).
- **Game tables use integer primary keys** (rowid aliases, no extra index write per insert). Character and item ids become numbers on the client in phase 3.
- **Passwords are hashed with native scrypt** (`node:crypto` in workerd), not Better Auth's pure-JS scrypt. Same parameters and format.
- **Measured CPU on staging (Workers Free, 10 ms nominal):** sign-up ~106 ms, sign-in ~170–215 ms, `users.me` 4 ms with the session cookie cache (25 ms cold), SSR home ~29 ms. None was rejected, so the 10 ms limit isn't enforced per request as of today. If Cloudflare starts rejecting sign-in, the lever is the scrypt cost, not a paid plan.

## Update (2026-11-16, phase 2 shipped on `feat/cloudflare-phase-2`)

Decisions taken while porting the procedures:

- **The zone bag is a JSON column on `characters`** (`zone_bag`), not `items` rows, chosen by the owner for the write quota. A drop costs 0 extra rows (it rides on the kill's UPDATE, appended in SQL with `json_insert`), a discarded drop costs nothing, and only a kept item costs its `items` insert (row + index). That's ~1.2–1.7 rows written per kill against ~2.4 with item rows. A pick-up is `INSERT … SELECT` from the stored entry, so item data never comes from the client, and an entry already taken inserts nothing, which makes a replayed or concurrent pick / exit safe without a version counter. Trade-off accepted: an item's id is born at pick-up, not at drop (threat-model "Do not regress" table updated).
- **`characterSessionProcedure` reads the session and the row in parallel and skips the zone bag column**, so hot procedures never load a growing JSON blob. Folding the check into the UPDATE was not needed.
- **SQL guards against concurrent requests** where one statement can express them: consumables decrement with `WHERE count > 0`, `vendorBuy` requires the rubys and the cap in the WHERE, `vendorSellMany` pays only while every sold item is still in the inventory.
- **Test harness:** `@cloudflare/vitest-pool-workers` was renamed `@cloudflare/vitest-plugin` (the old package is deprecated). The `server` Vitest project (`vitest.workers.config.ts`) runs procedures through a tRPC caller inside workerd against a local D1 with the real migrations.
- **drizzle-orm 0.45 can't batch `db.run(sql)` with parameters** (its `SQLiteRaw` has no prepared statement to bind), so raw SQL inside a batch goes through a builder (`db.insert(…).select(sql)`).
- **Renames:** `usePotion` / `useEtherealIncense` / `useTeleportStone` → `consumePotion` / `consumeEtherealIncense` / `consumeTeleportStone` (a `use` prefix trips the React hooks lint rule on the client).
- **Measured on staging (Workers Free):** `recordKill` median ~7 ms CPU, 17–35 ms on kills that generate items or hit a cold isolate; `exitZone` 17 ms; `syncHp` 7 ms. Nothing was rejected.

## Update (2026-11-16, phase 3 shipped on `feat/cloudflare-phase-3`)

The frontend runs on tRPC and `convex/`, its packages and its env vars are deleted. Decisions taken while swapping:

- **Client setup follows the tRPC TanStack Start guide.** `getRouter()` builds a QueryClient, a tRPC client and the options proxy per call (one per SSR request, so no cache is shared across players), passes `{ queryClient, trpc }` as router context, wraps the app in `TRPCProvider`, and lets `setupRouterSsrQueryIntegration` dehydrate the SSR cache. During SSR the calls run in-process through `localLink` with the request's cookies; in the browser through `httpBatchLink` at `/api/trpc` (not the streaming link: the session cookie refresh is a `Set-Cookie` collected while the procedures run). No transformer: Better Auth's `Date` columns are returned as epoch numbers by the admin procedures instead.
- **One character query.** The client reads the combat state and progression from `characters.byId` (they are columns of the row since phase 1), so the `combatState` / `characterProgression` sub-routers were deleted.
- **Mutations return what the cache needs.** `recordKill` returns the columns it wrote (`character`) and the staged `drops`; `exitZone` / `pickFromBag` return the inserted inventory rows (`INSERT … RETURNING`); `vendorBuy` returns `{ rubys, counterField, count }`; `switchElement` returns the server's switch time. The client merges them with `setQueryData` (`src/lib/world-cache.ts`) and only invalidates where it can't predict (death, a partial stash move, character creation, a role change).
- **HP sync rides on the kill.** `recordKill` takes optional `clientHp` / `clientBarrier`, merged through `resolveVitalSync` unless the kill levels up (which refills the vitals). The client's periodic sync waits 10 s after the last write, so steady fighting writes one row per kill and no `syncHp`.
- **Session takeover without reactivity.** A write rejected with "Session lost" makes the router's `MutationCache` refetch `characters.byId`; the other tab's token shows up and `/world` raises the session-lost modal. A window-focus refetch of the character catches it too.
- **Auth guard from the cache.** The root `beforeLoad` no longer calls a server function per navigation / hover. `requireSession` (world, admin, character-select) reads `users.getUserRole` through `ensureQueryData`; sign-in and sign-out reload the page, which starts a fresh cache.
- **Polling instead of subscriptions:** leaderboard every 5 min and admin tabs every 30 s, only while on screen.
- **Request quota first.** Queries don't refetch on window focus by default (the cache is kept current by the mutations); only `characters.byId` on `/world` opts back in, for takeover detection. The `/world` loader prefetches the character, equipped and inventory together (one batched request, or in-process during SSR).
- **Optimistic bodies call the server's decisions** (`resolveEquip` / `resolveUnequip`, `resolvePurchase`, `resolveTravelStart` / `resolveTeleport`, `resolvePotionUse`) instead of re-implementing them, so a move the server would refuse is never painted. `CLEARED_VISIT` (`src/game/world/zone-actions.ts`) is the visit reset both sides spread. `consumeTeleportStone` returns everything it wrote.
- **Measured on staging (Workers Free), scripted HTTP play:** `recordKill` median 5 ms CPU, max 9 ms (with the vitals merge, drops and a level-up in the sample); `exitZone` 12 ms; `pickFromBag` 25 ms; `arriveAtTravel` 25 ms; `enterCity` 32 ms; reads 1–5 ms; SSR `/world` 29 ms, `/character-select` 44 ms; sign-up 105 ms. Nothing was rejected. Re-measure with real browser play before cutover.

## Update (2026-11-16, phase 4 — production cutover)

Production runs on the Worker `shadows-of-void-production` at `https://shadows-of-void-production.dvictorps.workers.dev`, with an empty D1 (`shadows-of-void-production`) migrated from `drizzle/` and a fresh `BETTER_AUTH_SECRET`. The Vercel project and the Convex deployments are retired and their data discarded, as decided above. No custom domain: the `workers.dev` URL is the production URL (`BETTER_AUTH_URL` in `wrangler.jsonc`), so a domain later means changing that var and redeploying.

- **Release flow:** feature PRs merge into `dev`; a release is `dev` → `master`, then `pnpm db:migrate:production` (when `drizzle/` changed) and `pnpm deploy:production` from `master`. Nothing deploys on push (no Vercel build, no `npx convex deploy`).
- **Smoke test:** a full click-through in a browser on staging (sign-up, character, travel, zone, kills, camp, exit with loot, vendor, stash, leaderboard, admin with an account promoted by SQL) found no functional bug. Production was smoke-tested over HTTP after the deploy (SSR pages 200, auth session endpoint, tRPC rejecting an anonymous call with 401); the owner accepted the staging click-through for production, since the build and the plan are the same.
- **Measured CPU with real browser play (staging, Workers Free, 107 requests, none rejected):** `recordKill` median 3 ms, p90 6 ms, max 9 ms over 31 kills (phase 3's scripted median was 5 ms, same max); `consumePotion` 3 ms; `exitZone` 5 ms; `equipItem` 7 ms; `characters.create` 10 ms; the hourly leaderboard cron 9 ms; SSR `/` 44 ms and `/character-select` 23–61 ms; sign-up 128 ms. Only SSR and password hashing exceed the nominal 10 ms, as in earlier phases.
- **Still to watch:** the D1 rows-written counter for the first week of real play, against the envelope in [in-progress.md](../plans/in-progress.md) → "Beta readiness — D1 quota envelope".
