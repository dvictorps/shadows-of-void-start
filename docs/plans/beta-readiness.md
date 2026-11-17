# Beta readiness — D1 quota envelope (snapshot, refine with real telemetry)

Reference material, not planned work. Rewritten for the Cloudflare backend (2026-11-16) from the old Convex cost envelope; measured CPU per procedure is in the [ADR 0009](../adr/0009-cloudflare-d1-trpc-backend.md) update notes. The Workers Free plan has no bill: hitting a quota fails requests until the daily reset (00:00 UTC), for every player. Verify the current limits at the Cloudflare docs; as understood today: **100k Worker requests/day**, **D1: 5M rows read/day, 100k rows written/day**, 10 ms CPU per request (not enforced per request so far, see ADR 0009).

## Per-active-hour rates (estimated)

Combat (`useCombatLoop`):

- `recordKill` — 1 per kill. ~600/hour at a ~6 s kill cycle, ~1200/hour at endgame burst. **~1 row written** (the character UPDATE; drops ride on it as JSON) plus nothing else, and since phase 3 it also carries the HP sync.
- `syncHp` — only when 10 s pass after the last write with HP changed, so steady fighting makes almost none; idle players make zero. Ceiling 360/hour, realistic far below.
- `consumePotion` / `consumeEtherealIncense` — ~10–30/hour, 1 row each.

Out of combat (`useWorldMutations`, `useInventoryMutations`): zone enter / exit / pick / discard ~20–40/hour; travel ~10–20/hour; equip / reorder ~10–50/hour; vendor / stash ~5–20/hour. A kept item costs its `items` insert plus index entries (~2 rows); a move costs 1–2 rows per item.

**Rows written per active hour: ~1.2–1.7k** (≈1.2–1.7 per kill on average, dominated by kills). **Requests per active hour: ~700–1500 mutations + a handful of queries** — the client reads from its cache and mutations write their results into it (no refetch per mutation); queries don't refetch on focus except the character on `/world` (after 30 s), and the leaderboard / admin views poll (5 min / 30 s) only while open.

## Projection against the daily quotas

| Quota                      | Per active hour | Active hours/day it supports (all players combined) |
| -------------------------- | --------------- | --------------------------------------------------- |
| D1 rows written (100k/day) | ~1.2–1.7k       | ~60–80                                              |
| Worker requests (100k/day) | ~0.8–1.6k       | ~60–120 (static assets count too; keep them cached) |
| D1 rows read (5M/day)      | small           | not the constraint                                  |

Solo testing fits with a wide margin. A 10-friend beta at ~3 h/day each (~30 active hours) fits; ~20 regular players doesn't, and the first quota to go is the write quota.

## What inflates this estimate

- **Layer 2 of the threat model** (per-hit server calls instead of per-kill): 5–10× the request and write rates. Defer until ranking ships and the cost is justified.
- **New indexes on hot columns**: every index a kill's UPDATE touches is one more row written per kill (game-schema.ts header).
- **Invalidating instead of writing results into the cache**: each invalidation is a refetch request. The hooks write results; keep it that way.
- **Spam scripts** (threats #1 / #2): one client can burn the shared quota. Layer 1 rate limits are the cap.
- **Optimistic rollback refetches**: `rollbackOnError` restores the snapshot and then refetches the keys it touched, since other writes may have landed meanwhile. Rejections are rare, so this is cheap; revisit only if the request quota gets tight.

## Other Free-plan risks

- **Concurrent read-modify-write** (threat #6): accepted while the game is solo-tested; escalation is a per-character Durable Object.
- **Password hashing CPU**: sign-up costs ~105–130 ms CPU against the Free plan's nominal 10 ms. Nothing has been rejected; if Cloudflare starts to, lower the scrypt cost in `src/server/password.ts`, don't buy a plan.

## Action items before opening a public beta

- Watch the Cloudflare dashboard (Workers requests, D1 rows written) after the first week of real play; compare with the model above.
- Ship Layer 1 rate limits (threat model): anti-cheat **and** quota ceiling against scripted spam.
- If the write quota binds before the player count justifies a paid plan, the levers are fewer rows per kill (already 1) and fewer kept items, not more caching.
