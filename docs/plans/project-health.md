# Project health snapshot (as of 2026-11-17)

**Current grade: A** (composite across architecture / code quality / docs / scalability / agent ergonomics), confirmed after the engineering queue toward A+ closed (PRs #123–#127: mutation-hook, world-component and `/world` wiring tests, the ambush roll on the injected `Rng`, the accessibility leftovers). Testing is now A across `src/game/`, procedures, hooks and components. What holds it below A+ is no longer engineering debt: the bulk-translated PT lexicon (B-, a launch requirement) and the A+ bar's own condition, a new system shipped against its stub without an emergency refactor (waiting on the next feature). Both are in `in-progress.md` → "Priority queue: the path to A+".

This is a self-assessment from senior-review passes. It exists to give downstream agents a quick read on what's solid and what's debt — pick work that moves the needle, skip work that doesn't. Closed work lives in git history, not here.

## Measured (2026-11-17, on `dev` after PR #127)

| Gate                              | Value                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                | 0 errors                                                                                                  |
| `pnpm lint:errors`                | 0 errors                                                                                                  |
| `pnpm lint` warnings              | 0: `complexity`, `react/forbid-elements`, `shadcn/*` and `shadows/no-comments` are all errors             |
| `pnpm test` (Vitest)              | 1369 tests in 85 files: the `unit` project plus 5 tRPC integration files on a local D1 (`server` project) |
| `pnpm test:lint-rules`            | 19 rule-test files, all passing                                                                           |
| Inline `oxlint-disable`           | 4, each with its external constraint in the comment beside it; 2 `SAFETY:` casts                          |
| `COMPLEXITY_DEBT`                 | Emptied and removed (item 10); `complexity` has no exceptions                                             |
| `SERVER_CALLS_IN_COMPONENTS_DEBT` | Emptied and removed (item 8); the rule has no exceptions                                                  |
| Comments in code                  | 38 lines, all allowed directives (was 4,185 lines, 8% of 52.7k code lines; code bytes −16%)               |
| CI (`.github/workflows/ci.yml`)   | Lint, `tsc`, `pnpm test` and `pnpm test:lint-rules` on every push and PR to `dev` / `master`              |

Re-measure before quoting these numbers; they move with every gate PR.

## Grades by axis

- **Architecture: A** — one Worker, D1 + Drizzle, tRPC over the react-query cache ([ADR 0009](../adr/0009-cloudflare-d1-trpc-backend.md)). Every procedure has the same shape: auth → load → decide in `src/game/` → one write or `batch()`, with SQL guards on the replayable paths (bag pick-ups, sales, spends). Render-at-display naming + literal-union enforcement ([ADR 0003](../adr/0003-render-at-display-names.md)) carries the multi-locale side. Open: no interactive transactions on D1 (threat #6, accepted), and lexicon / `mod-i18n.ts` drift (same modifier id in two tables).
- **Code quality: A** — `src/game/` is pure, deterministic and tested, and lint enforces it: `shadows/game-imports` and `shadows/game-determinism` reject React/server imports and ambient clock/random reads. `pnpm lint:errors` is at zero across oxlint's correctness / suspicious / perf / pedantic categories, anti-slop, you-might-not-need-an-effect and the type-aware rules. `shadows/no-comments` keeps the code free of narration: the WHY lives in the docs (codebase-map → Invariants and hazards).
- **Backend robustness: A-** — server-authoritative for HP caps, XP, drops, travel, prices, equip requirements and bag integrity (threat-model "Do not regress" table). `shadows/require-session-procedure` makes the single-active-session check structural on every mutation. Open: client-reported HP/kills (threats #1, #2) and concurrent read-modify-write (#6) — local impact until a leaderboard or trade exists.
- **Docs: A** — audited against the code on 2026-11-16 (38 drifts fixed in PR #122; every path in `codebase-map.md` exists, the six sentinels compile in CI); with comments banned from code, the docs are the only home of the WHY, so the doc-update discipline in CLAUDE.md is load-bearing. `CONTEXT.md` single source of truth for game rules; nine ADRs; playbooks with type-checked sentinels that CI runs; `CLAUDE.md` lists the lint rules and why each exists, and leaves the recipes to the playbooks.
- **Scalability: A** — new locale = 1 lexicon file per domain + paraglide JSON; new template = 1 entry; new procedure = the `adding-a-procedure` recipe, with lint catching the session/purity mistakes.
- **Translation quality: B-** — 130 PT lexicon entries were AI-bulk-translated; four hand-revised entries caught real awkwardness, so expect 5–10 more. Fine for indie pre-release, not for a paid Brazilian release.
- **Agent ergonomics for ONBOARDING: A+** — `CONTEXT.md` + `CLAUDE.md` + `codebase-map.md` get an agent productive in ~30 minutes.
- **Agent ergonomics for MODIFYING existing things: A** — the conventions (pure engine, session middleware, server-only modules, validated JSON, handled promises, SAFETY-commented casts, `complexity` ≤ 20, no server calls in components) are lint errors, run by pre-commit / pre-push and by CI. The `/world` route is ~650 lines of flat wiring; a `complexity` error on `WorldLayout` is the re-mixing trigger.
- **TESTING as a refactor/bugfix safety net: A** — the pure domain is blanketed; every tRPC router has integration tests on a real local D1; the combat state machine and the `/world` flows (`useCombatLoop`, `useCombatTick`, `useEncounterSchedule`, `useExitFlow`, `useSessionClaim`, `useIncenseGuard`, `useViewMode`) run on fake timers with the server injected. The mutation bundles (`useWorldMutations`, `useInventoryMutations`, `useCombatMutations`) run unmodified on a real tRPC client over an in-memory fetch (`fakeTrpc` + `src/hooks/trpc-hook-harness.tsx`), pinning the optimistic writes, the rollbacks and the invalidations. Every world component with behavior has a test, and `src/routes/-world.test.tsx` smoke-tests the route's wiring on the same fake. Mutation checks: each pinned binding was broken by hand and seen to fail. Not covered: the `character-select` and admin routes (no route harness use yet).
- **Agent ergonomics for ADDING NEW systems (skills, passive tree): B** — stub playbooks list the decisions and ADRs each queued domain needs. The grade returns to A once the first new system ships against its stub without an emergency refactor.

## What raises the grade

| Move                                                                                          | Outcome                                                    |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Native PT review of `lexicon/pt.ts`                                                           | Translation quality B- → A.                                |
| 3+ months of system additions (skills / passive) WITHOUT emergency refactor against the stubs | **A+** — architecture proven at scale, not just at theory. |

## What lowers the grade

| Risk                                                                                      | Drop                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next major refactor ships without updating relevant playbooks (drift recurs)              | A → B+. The sentinels under `docs/playbooks/_examples/` cover the playbook code blocks via `tsc --noEmit`, which CI runs, but a refactor that changes the surrounding prose still gets through: CI does not read prose. |
| New domain shipped that ignores its stub playbook (and doesn't write the ADRs it flagged) | Scalability slips A → B+. The first system to do this sets a precedent that's hard to walk back.                                                                                                                        |
| A debt list brought back (`COMPLEXITY_DEBT` or a server-call exception)                   | Modifying existing → B+. The lists were emptied and removed; bringing one back is how the past monoliths started.                                                                                                       |
| An `oxlint-disable` or a rule switched off to get a change through, instead of a fix      | Code quality A → B+. Each silenced finding re-opens the gap the rule closed. Disables need a real external constraint, written in the comment (CLAUDE.md → Lint discipline).                                            |
| Someone "optimizes" render-at-display by pre-rendering names                              | Locale switching silently breaks. Forbidden by [ADR 0003](../adr/0003-render-at-display-names.md).                                                                                                                      |
| `mod.description` (legacy field) becomes load-bearing again in any consumer               | Defeats the render-at-display invariant. Tooltips diverge by locale.                                                                                                                                                    |

## Reading this from a fresh session

1. Read this snapshot first — know where the project sits and what's at stake.
2. Check `in-progress.md` for what is open and the priority queue.
3. When a major refactor lands, **update the relevant playbook + sentinel + codebase-map + CONTEXT.md + this file in the same PR** (see the "Doc-update discipline" section in `CLAUDE.md`).
