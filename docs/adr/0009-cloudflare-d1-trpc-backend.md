# 0009 — Leave Convex: Cloudflare Workers + D1 + Drizzle + tRPC

**Status**: Accepted (execution in progress — see [in-progress.md](../plans/in-progress.md) → "Convex → Cloudflare migration")
**Date**: 2026-11-15

## Context

The backend is Convex: ~3.3k lines under `convex/`, 84 functions (53 queries, 31 mutations, 4 internal mutations, 1 internal action), 7 tables, one hourly cron, Better Auth via the `@convex-dev/better-auth` component. The frontend is TanStack Start (SSR via Nitro) and talks to Convex through `@convex-dev/react-query`.

Convex's cost model is the problem. The gameplay loop is a stream of small, frequent writes (`recordKill`, `syncHp`, inventory moves), and every write also re-runs every reactive query subscribed to the touched documents — each of those re-runs is a billed function call plus bandwidth. A previous plan (`docs/plans/2026-05-28-convex-bandwidth-v3.md`) already spent effort denormalizing to tame this. The game is mostly single-player state; it pays for reactivity it barely uses.

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
