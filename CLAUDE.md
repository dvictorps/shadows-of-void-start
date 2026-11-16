# Shadows of Void — Project Guidelines

## Orientation for a new agent

Read these in order if you're new to the codebase:

1. **[CONTEXT.md](./CONTEXT.md)** — domain glossary. What the game's rules ARE. Single source of truth.
2. **[docs/codebase-map.md](./docs/codebase-map.md)** — where each domain lives in the repo. Use this instead of grepping blindly.
3. **[docs/playbooks/](./docs/playbooks/)** — task recipes (add modifier, add monster, touch combat, etc). If your task matches one, follow it.
4. **[docs/plans/in-progress.md](./docs/plans/in-progress.md)** — decisions made but not yet executed. Check before starting work to avoid colliding with a planned refactor.
5. **[docs/adr/](./docs/adr/)** — architecture decisions (optimistic mutations, three-system i18n split, render-at-display naming, static-data conventions).

## Doc-update discipline (read this before you ship)

**The docs are part of the codebase, not a wiki.** Treat doc updates as part of the change, not a follow-up — the docs that drift first are the ones that get stale fastest, and a stale `CONTEXT.md` / `codebase-map.md` is what makes the next agent burn 30 minutes grepping for files that moved. CI (`.github/workflows/ci.yml`) runs lint, `tsc`, the Vitest suite and the lint-rule tests on every push and PR to `dev` / `master`, but it can only catch type drift in the playbook sentinels; whether the prose still matches the code is on the discipline alone.

**Update docs in the same PR as the code change. Concretely:**

| If your PR…                                                                                       | Update…                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adds, removes, or renames a file/directory referenced in `docs/codebase-map.md`                   | The matching table row(s) in `codebase-map.md`                                                                                                                          |
| Changes a game-design rule (combat formula, drop rate, balance number, retention tier, etc)       | The relevant section of `CONTEXT.md` — that file is the single source of truth                                                                                          |
| Ships a queued item from `docs/plans/in-progress.md`                                              | Remove (or rewrite) the queued entry; closed work belongs in commit history, not this file                                                                              |
| Materially changes line counts the docs cite (a refactor that breaks a "currently N lines" claim) | The cited number(s) in `codebase-map.md` and `in-progress.md`                                                                                                           |
| Adds a new system that didn't exist before (skill, passive node, stash, leaderboard, etc)         | Write a new playbook under `docs/playbooks/` + a sentinel under `_examples/` + a `CONTEXT.md` section. If the choice is load-bearing, write a new ADR under `docs/adr/` |
| Changes the shape of a type that a playbook documents (Modifier, Template, Monster, Zone, Class)  | The sentinel under `docs/playbooks/_examples/` AND the playbook's example block. `tsc --noEmit` will fail otherwise                                                     |
| Reverses an architectural decision already in an ADR                                              | Append an "Update" or "Superseded by" note to the existing ADR; do NOT silently rewrite it                                                                              |
| Closes a threat in `docs/security/threat-model.md`                                                | Mark the threat closed inline, link the PR/commit                                                                                                                       |

**Triggers that mean "find the doc and update it":**

- A reviewer comment says "this contradicts CONTEXT.md / the playbook / the ADR" — that's the doc asking to be updated, not the code.
- You introduce a new convention (file naming, import style, modifier weight band, etc) — write it down in `CLAUDE.md` or the playbook, or it will be re-litigated by the next agent.
- You discover a divergence between docs and code while working — fix the doc in the same PR even if it's tangential. Drift compounds; small fixes prevent it.

**Validation before merging a PR that touched docs:**

- `npx tsc --noEmit` — the playbook sentinels live under `tsconfig.json`'s include glob, so type drift in `docs/playbooks/_examples/*.ts` fails here. This is the only automated gate against playbook drift.
- Manual: grep for the renamed file or moved directory across `docs/` and make sure no other doc still references the old path.

When in doubt, **prefer updating an existing doc to creating a new one**. The orientation tree (`CONTEXT.md` → `codebase-map.md` → playbooks → ADRs) is the established place to look — fragmenting it makes the next agent slower, not faster.

---

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS + TanStack Router
- **Backend:** one Cloudflare Worker: D1 + Drizzle, Better Auth, tRPC ([ADR 0009](./docs/adr/0009-cloudflare-d1-trpc-backend.md)). Server code lives in `src/server/`; the client calls it through `@trpc/tanstack-react-query` (`src/integrations/trpc/client.ts`). No reactivity: every mutation writes its result into the query cache (`src/lib/world-cache.ts`) or invalidates the right keys
- **Build:** Vite + oxlint (lint) + oxfmt (format) + Vitest (testing). Lint config is `oxlint.config.ts`; the `anti-slop` and `you-might-not-need-an-effect` JS plugins are vendored under `tools/oxlint/`
- **Path alias:** `#/*` → `./src/*` (client and server code alike)
- **Lint discipline:** `pnpm lint:errors` must stay at zero, and the lefthook pre-push gate enforces it. Inline `oxlint-disable` is only for a real external constraint, and the comment must say why the documented pattern does not apply. Otherwise fix the code.
- **Architecture as lint:** the project's own plugin, `tools/oxlint/shadows/`, turns the architecture into errors. Path scoping and allowlists live in `oxlint.config.ts`, and each rule's message says what to do instead. Rule tests run with `pnpm test:lint-rules`.
  - `shadows/game-imports` (`src/game/**`): imports come from an allowlist: the engine, `#/lib/rng`, `#/lib/server-errors` and `#/paraglide`. No React, server, Drizzle, tRPC or auth. Extend the list only with a module that is itself pure.
  - `shadows/game-determinism` (`src/game/**`): no `Date.now()`, `new Date()`, `performance.now()`, `Math.random()` or `crypto.randomUUID()`. Time enters as a `now` parameter. Randomness goes through `#/lib/rng`, the only ambient source. Its helpers take an optional `Rng` (`defaultRng` otherwise), and item generation and drops take one too (`generateItem`, `rollDrop`, `resolveKill`, …), so a test passes `seededRng(seed)` for reproducible rolls.
  - `shadows/require-session-procedure` (`src/server/trpc/routers/**`): every `.mutation()` is built from `characterSessionProcedure` (threat #5). Exceptions: `adminProcedure`, and the named `allow` list in the config (`characters.create`, `characters.remove`, `characters.claimCharacterSession`). A new exception needs a comment there saying why.
  - `shadows/server-only-imports` (all of `src/` except `src/server`, `src/server.ts`, `src/routes/api` and `src/integrations/trpc/client.ts`): `#/server/**`, `drizzle-orm` and `@trpc/server` may only be imported with `import type`.
  - `shadows/no-unvalidated-json-parse` (everywhere): `JSON.parse` output goes straight into a zod `.parse()` / `.safeParse()`, or into a `: unknown` binding that is narrowed afterwards.
  - `shadows/no-server-calls-in-components` (`src/components/**`): no value import of `#/integrations/trpc/*`, `@trpc/tanstack-react-query`, `@tanstack/react-query` or a `#/hooks/use*Mutations` bundle. The route or a hook makes the calls and passes data as props and calls as a `server` prop (see Scaling rules).
- **Type-aware lint is on** (`options.typeAware` + `oxlint-tsgolint`). It enables the promise rules (`no-floating-promises`, `no-misused-promises`, `await-thenable`, `return-await`) plus `no-unsafe-*`, `no-deprecated`, `switch-exhaustiveness-check`, `only-throw-error` and `require-array-sort-compare`. The style-only type-aware rules are off, with the reason in the config. A fire-and-forget promise is marked `void` only when nothing can reject unhandled (the callee catches its own errors, or it's an animation's completion promise), with a comment. `no-misused-promises` skips JSX event attributes, so an async `onClick` / `onSubmit` handler must catch and toast its own errors.
- **Package manager / formatting:** pnpm (`pnpm-lock.yaml`). Line endings are LF everywhere (`.gitattributes`). The lefthook pre-commit hook runs `oxlint --fix` and `oxfmt` on staged files, so don't hand-format.

## Scaling rules (no new monoliths)

Learned from the three refactors (`world.tsx`, `CombatScene`, `InventoryModal`). Each grew past 700 lines the same way: decisions inline in handlers and JSX, server calls inside the component (so it went untested, so nobody dared split it), subcomponents piling up in one file. A "don't grow this" comment at the top of the file did not stop any of them; lint did. Recipe: [docs/playbooks/adding-a-world-component.md](./docs/playbooks/adding-a-world-component.md).

- **`complexity` ≤ 20 is an error, everywhere.** It is the measured gate. File size is not: a large static-data table, a cohesive tested engine module, or a ~700-line route of flat wiring is fine. Mixed concerns are not.
- **Handlers dispatch; they don't decide.** A choice with more than two branches over game data goes to a pure function with a test: in `src/game` for a game rule, in a `.ts` beside the component for an interaction rule (`inventory-modal/drag.ts`, `combat-scene/reveal.ts`).
- **Components don't call the server** (`shadows/no-server-calls-in-components`). Calls come in as a `server` prop typed by an interface the component declares (`Promise<object>` returns, like `InventoryServer` / `ExitFlowServer`), so the component test injects `vi.fn()` fakes.
- **A component folder once there's a second subcomponent**: `Foo.tsx` composes, `foo/*` holds the pieces and the pure rules.
- **New component, new test**, in the same PR, on the shared harness (`src/components/dom-test-utils.ts`, `src/components/world/item-test-fixtures.ts`).
- **No debt lists.** `complexity` and `no-server-calls-in-components` are errors on every file, with no exceptions: `COMPLEXITY_DEBT` and `SERVER_CALLS_IN_COMPONENTS_DEBT` emptied and are gone. Don't bring a list back; fix the code.

## Game Context

ARPG with automatic/stat-check combat. No projectile speed, no area of effect. Players gear up and the stat engine resolves encounters. Loot is the core loop — items must feel rewarding and balanced.

---

## Item Generator System

Item generation lives in `src/game/items/` (file map: [codebase-map.md](./docs/codebase-map.md#srcgameitems--item-subsystem-detail)). Recipes, with the `statEffect` table, equipment groups, tiers and rarity limits: [adding-a-modifier.md](./docs/playbooks/adding-a-modifier.md) and [adding-an-equipment-template.md](./docs/playbooks/adding-an-equipment-template.md).

### Design Decisions (Do Not Change Without Discussion)

- `increased` crit chance is **multiplicative** (`base × (1 + inc/100)`), not flat additive
- `% max life` and `% max mana` mods were intentionally removed — reserved for future power creep
- Global attack speed does NOT roll on weapons — only jewelry, gloves and quivers
- `localDefenseFlat`/`localDefenseIncrease` use a generic "Defense" display that resolves to Armor/Evasion/Barrier based on the armor's base type at roll time
- The `"more"` modifier type exists in the type system but is unused — reserved for skills
