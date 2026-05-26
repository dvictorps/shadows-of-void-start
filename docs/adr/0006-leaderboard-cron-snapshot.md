# 0006 — Leaderboard via cron snapshot, not live query

**Status**: Accepted
**Date**: 2026-05-26

## Context

The game uses Convex as its backend. Convex queries are **reactive by default** — subscribed clients receive updates in real time whenever the underlying data changes. The leaderboard needs to show top-50 rankings for level and boss kills.

A naive implementation would be a Convex query that sorts characters by level/kills and takes the top 50. Every time any character gains XP, levels up, or kills a boss, every client with the leaderboard open would recompute. In a busy game this means the ranking visibly shuffles on every kill across the playerbase.

## Decision

Use a **scheduled Convex cron job** (runs every 5 minutes) that computes the rankings and writes a snapshot to a dedicated `leaderboardSnapshot` table. Clients subscribe to the snapshot table reactively — but since the table only changes every 5 minutes, updates arrive at that cadence.

## Alternatives considered

### Live reactive query
- **Pro**: zero additional infrastructure, idiomatic Convex, always fresh.
- **Con**: the ranking "flickers" on every XP tick across all players. Distracting UX — the board feels unstable. Also triggers recomputation on every character mutation, which scales poorly with player count.

### Client-side polling with stale-while-revalidate
- **Pro**: no cron job, no extra table.
- **Con**: fights Convex's reactive model. Requires custom cache-invalidation logic on the client. More code for worse guarantees.

## Consequences

- A `leaderboardSnapshot` table is added to the Convex schema.
- A cron job runs every 5 minutes and overwrites the snapshot.
- The leaderboard can be up to 5 minutes stale — this is accepted as a game-design feature, not a limitation.
- Opening the leaderboard modal is a single small read (the pre-computed snapshot), not a table scan.
