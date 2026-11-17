# Eliminate residual admin-dashboard navigation latency (low priority)

**Status**: Planned, not started. User-flagged on PR #46 — current state ("muito melhor mas não como eu quero") accepted as a stopping point; remaining latency tracked here.

**Why**: even after the PR #46 polishing pass (loader-based prefetch in `character-select`, `preload="render"` on the `/admin` Link + sidebar Links), the **first** `/character-select` → `/admin` navigation in a session was perceptibly non-instant on Convex.

**Update (Cloudflare migration phase 3)**: the WebSocket subscribe handshake that was the root cause is gone. Admin queries are one-shot tRPC queries, batched into a single request, and SSR runs them in-process (`localLink`) with the result dehydrated into the page (`setupRouterSsrQueryIntegration`), so a hard reload of an `/admin/*` page arrives with its data. What can still cost is the client-side code-split chunk fetch and one HTTP round trip on the first in-app navigation. **Re-measure before doing anything**; if it's still noticeable, the remaining direction is a persistent query cache (`@tanstack/query-persist-client-core` + IndexedDB) so the first visit per session hits the cache.

## What has already been tried (don't redo)

- Loader prefetch of the admin tabs in `character-select` (now through `prefetchAdminTabs(queryClient, trpc)`), `<Link preload="render">`, `defaultPreloadDelay: 0`, and the `/admin` pending shell.
- SSR of the admin payload (in place since phase 3 via the route loaders' `ensureQueryData`).

## Why deferred

Current latency is acceptable for the admin-only audience (friends-beta) — admins refresh deliberately, not continuously, so a sub-second cold-cache delay isn't a real cost. This entry exists so the residual `/admin` latency doesn't get re-discovered as a new problem the next time someone polls the dashboard.

## Validation when picked up

- Time `/character-select` → `/admin` first-paint with the Performance panel: target <50ms from `click` to first paint of populated cards.
- Same flow on a hard reload directly to `/admin/users`: target a single network roundtrip and no visible pending shell.
- Confirm non-admins still never trigger admin queries (the gating in the loader stays correct).
