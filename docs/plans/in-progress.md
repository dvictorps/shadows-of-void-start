# In-progress work

Decisions made but not yet executed. Read this before starting a session — if your task overlaps with something here, you may be duplicating planned work or causing conflicts.

When a planned item starts, move it to a feature branch and reference back here. When it ships, delete the entry (closed work belongs in commit history, not this file).

**Doc language convention**: narrative + meta-docs in English (CLAUDE.md, CONTEXT.md, codebase-map, playbooks, ADRs, and the prose in this file all follow this). PT preserved only for game-domain proper nouns — `Acampamento`, `Incenso Etéreo`, `Calmaria`, item-name examples (`Espada de Ferro`), monster names, etc. Code identifiers stay English. Mixing the two in narrative produces the kind of code-switching that confuses future agents and downstream tooling (translation platforms, search) — don't.

---

## Next session — pick up here

**REFACTOR GATE closed (2026-11-16, PR #121).** All 20 items shipped (history in git). The owner now plays and feels the game; gameplay tuning, new mechanics and the polish track (native PT review, `TemplateBaseId` codegen, rare-name bestiary, admin-dashboard latency, camp cinematic ambience) open on the owner's request. The guard-rails the gate left are lint errors, not docs: `complexity` ≤ 20, `no-server-calls-in-components`, `react/forbid-elements` and `shadcn/*` (CLAUDE.md → Scaling rules / Lint discipline). New server rule errors follow the recipe of `src/lib/server-error-message.ts`: a `SERVER_ERRORS` constant (or a pattern), a paraglide key, a test case.

### Open, not blocking

- **D1 JSON columns are typed, not validated.** `items.data`, `zone_bag`, `boss_kill_counts` and the leaderboard entries decode through Drizzle's `text({ mode: "json" }).$type<>()`, which casts (ADR 0009). `shadows/no-unvalidated-json-parse` guards hand-written `JSON.parse`, not these. Revisit if a stored shape changes without a migration.
- **Inline `oxlint-disable`s still in the tree** (each with its external constraint in the comment): the `useCombatTick` HP flush on deactivation (to revisit); kept for good: the 2 framer-motion imperative-controls effects (`useEnemySpriteMotion.ts`, `HealthGlobe` hit shake), the `/world` session claim (`useSessionClaim.ts`) and the `Object.keys` SAFETY cast in `src/game/typed-object.ts`.
- **`world.tsx` size rule.** The measured gate is `complexity` on `WorldLayout` (18 after `refactor/world-split`). A new decision goes into `src/game` or one of the `/world` hooks (`useExitFlow`, `useSessionClaim`, `useIncenseGuard`), not inline; raw line growth is not the trigger, concerns re-mixing is.
- **Next big feature**: passive tree (CONTEXT.md → Classes ordering: MVP combat ✅ → passive tree → active skills). Design work first; no stub plan yet.

---

## Project health snapshot (as of 2026-11-16)

**Current grade: A** (composite across architecture / code quality / docs / scalability / agent ergonomics). What holds it below A+ is the React layer's test coverage (a handful of world components and the `/world` wiring).

This is a self-assessment from senior-review passes. It exists to give downstream agents a quick read on what's solid and what's debt — pick work that moves the needle, skip work that doesn't. Closed work lives in git history, not here.

### Measured (2026-11-16, on `dev`)

| Gate                              | Value                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                | 0 errors                                                                                                  |
| `pnpm lint:errors`                | 0 errors                                                                                                  |
| `pnpm lint` warnings              | 0: `complexity`, `react/forbid-elements` and `shadcn/*` are all errors                                    |
| `pnpm test` (Vitest)              | 1223 tests in 73 files: the `unit` project plus 5 tRPC integration files on a local D1 (`server` project) |
| `pnpm test:lint-rules`            | 18 rule-test files, all passing                                                                           |
| Inline `oxlint-disable`           | 4, each with the external constraint written in the comment                                               |
| `COMPLEXITY_DEBT`                 | Emptied and removed (item 10); `complexity` has no exceptions                                             |
| `SERVER_CALLS_IN_COMPONENTS_DEBT` | Emptied and removed (item 8); the rule has no exceptions                                                  |
| CI (`.github/workflows/ci.yml`)   | Lint, `tsc`, `pnpm test` and `pnpm test:lint-rules` on every push and PR to `dev` / `master`              |

Re-measure before quoting these numbers; they move with every gate PR.

### Grades by axis

- **Architecture: A** — one Worker, D1 + Drizzle, tRPC over the react-query cache ([ADR 0009](../adr/0009-cloudflare-d1-trpc-backend.md)). Every procedure has the same shape: auth → load → decide in `src/game/` → one write or `batch()`, with SQL guards on the replayable paths (bag pick-ups, sales, spends). Render-at-display naming + literal-union enforcement ([ADR 0003](../adr/0003-render-at-display-names.md)) carries the multi-locale side. Open: no interactive transactions on D1 (threat #6, accepted), and lexicon / `mod-i18n.ts` drift (same modifier id in two tables).
- **Code quality: A** — `src/game/` is pure, deterministic and tested, and lint enforces it: `shadows/game-imports` and `shadows/game-determinism` reject React/server imports and ambient clock/random reads. `pnpm lint:errors` is at zero across oxlint's correctness / suspicious / perf / pedantic categories, anti-slop, you-might-not-need-an-effect and the type-aware rules. The warnings left are design-system rules on app-shell UI plus the gate's `complexity` and server-call debt.
- **Backend robustness: A-** — server-authoritative for HP caps, XP, drops, travel, prices, equip requirements and bag integrity (threat-model "Do not regress" table). `shadows/require-session-procedure` makes the single-active-session check structural on every mutation. Open: client-reported HP/kills (threats #1, #2) and concurrent read-modify-write (#6) — local impact until a leaderboard or trade exists.
- **Docs: A** — `CONTEXT.md` single source of truth for game rules; nine ADRs; playbooks with type-checked sentinels that CI runs; `CLAUDE.md` lists the lint rules and why each exists, and leaves the recipes to the playbooks.
- **Scalability: A** — new locale = 1 lexicon file per domain + paraglide JSON; new template = 1 entry; new procedure = the `adding-a-procedure` recipe, with lint catching the session/purity mistakes.
- **Translation quality: B-** — 130 PT lexicon entries were AI-bulk-translated; four hand-revised entries caught real awkwardness, so expect 5–10 more. Fine for indie pre-release, not for a paid Brazilian release.
- **Agent ergonomics for ONBOARDING: A+** — `CONTEXT.md` + `CLAUDE.md` + `codebase-map.md` get an agent productive in ~30 minutes.
- **Agent ergonomics for MODIFYING existing things: A** — the conventions (pure engine, session middleware, server-only modules, validated JSON, handled promises, SAFETY-commented casts, `complexity` ≤ 20, no server calls in components) are lint errors, run by pre-commit / pre-push and by CI. The `/world` route is ~650 lines of flat wiring; a `complexity` warning on `WorldLayout` is the re-mixing trigger.
- **TESTING as a refactor/bugfix safety net: A in `src/game/` + procedures, A- in the hooks, B in the components** — the pure domain is blanketed; every tRPC router has integration tests on a real local D1; the combat state machine and the `/world` flows (`useCombatLoop`, `useCombatTick`, `useEncounterSchedule`, `useExitFlow`, `useSessionClaim`, `useIncenseGuard`) run on fake timers with the server injected. Component tests pin `CombatScene`, `InventoryModal`, `StashModal`, `VendorModal`, `ItemTooltip` and `StatusCard`. **No tests yet:** `routes/world.tsx`, `useWorldMutations.ts`, `ShowStatsModal`, `MapScene`, `EquipmentPanel`, `LeaderboardModal`, `CreateCharacterModal`. This is the line that keeps the composite at A.
- **Agent ergonomics for ADDING NEW systems (skills, passive tree): B** — stub playbooks list the decisions and ADRs each queued domain needs. The grade returns to A once the first new system ships against its stub without an emergency refactor.

### What raises the grade

| Move                                                                                          | Outcome                                                    |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Tests for the remaining untested world components and the `/world` wiring                     | Testing in components B → A.                               |
| Native PT review of `lexicon/pt.ts`                                                           | Translation quality B- → A.                                |
| 3+ months of system additions (skills / passive) WITHOUT emergency refactor against the stubs | **A+** — architecture proven at scale, not just at theory. |

### What lowers the grade

| Risk                                                                                      | Drop                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next major refactor ships without updating relevant playbooks (drift recurs)              | A → B+. The sentinels under `docs/playbooks/_examples/` cover the playbook code blocks via `tsc --noEmit`, which CI runs, but a refactor that changes the surrounding prose still gets through: CI does not read prose. |
| New domain shipped that ignores its stub playbook (and doesn't write the ADRs it flagged) | Scalability slips A → B+. The first system to do this sets a precedent that's hard to walk back.                                                                                                                        |
| A debt list brought back (`COMPLEXITY_DEBT` or a server-call exception)                   | Modifying existing → B+. The lists are shrink-only; growing one is how the past monoliths started.                                                                                                                      |
| An `oxlint-disable` or a rule switched off to get a change through, instead of a fix      | Code quality A → B+. Each silenced finding re-opens the gap the rule closed. Disables need a real external constraint, written in the comment (CLAUDE.md → Lint discipline).                                            |
| Someone "optimizes" render-at-display by pre-rendering names                              | Locale switching silently breaks. Forbidden by [ADR 0003](../adr/0003-render-at-display-names.md).                                                                                                                      |
| `mod.description` (legacy field) becomes load-bearing again in any consumer               | Defeats the render-at-display invariant. Tooltips diverge by locale.                                                                                                                                                    |

### Reading this from a fresh session

1. Read this snapshot first — know where the project sits and what's at stake.
2. Check "Next session" above for what is open.
3. When a major refactor lands, **update the relevant playbook + sentinel + codebase-map + CONTEXT.md + this file in the same PR** (see the "Doc-update discipline" section in `CLAUDE.md`).

---

## Beta readiness — D1 quota envelope (snapshot, refine with real telemetry)

Reference material, not planned work. Rewritten for the Cloudflare backend (2026-11-16) from the old Convex cost envelope; measured CPU per procedure is in the [ADR 0009](../adr/0009-cloudflare-d1-trpc-backend.md) update notes. The Workers Free plan has no bill: hitting a quota fails requests until the daily reset (00:00 UTC), for every player. Verify the current limits at the Cloudflare docs; as understood today: **100k Worker requests/day**, **D1: 5M rows read/day, 100k rows written/day**, 10 ms CPU per request (not enforced per request so far, see ADR 0009).

### Per-active-hour rates (estimated)

Combat (`useCombatLoop`):

- `recordKill` — 1 per kill. ~600/hour at a ~6 s kill cycle, ~1200/hour at endgame burst. **~1 row written** (the character UPDATE; drops ride on it as JSON) plus nothing else, and since phase 3 it also carries the HP sync.
- `syncHp` — only when 10 s pass after the last write with HP changed, so steady fighting makes almost none; idle players make zero. Ceiling 360/hour, realistic far below.
- `consumePotion` / `consumeEtherealIncense` — ~10–30/hour, 1 row each.

Out of combat (`useWorldMutations`, `useInventoryMutations`): zone enter / exit / pick / discard ~20–40/hour; travel ~10–20/hour; equip / reorder ~10–50/hour; vendor / stash ~5–20/hour. A kept item costs its `items` insert plus index entries (~2 rows); a move costs 1–2 rows per item.

**Rows written per active hour: ~1.2–1.7k** (≈1.2–1.7 per kill on average, dominated by kills). **Requests per active hour: ~700–1500 mutations + a handful of queries** — the client reads from its cache and mutations write their results into it (no refetch per mutation); queries don't refetch on focus except the character on `/world` (after 30 s), and the leaderboard / admin views poll (5 min / 30 s) only while open.

### Projection against the daily quotas

| Quota                      | Per active hour | Active hours/day it supports (all players combined) |
| -------------------------- | --------------- | --------------------------------------------------- |
| D1 rows written (100k/day) | ~1.2–1.7k       | ~60–80                                              |
| Worker requests (100k/day) | ~0.8–1.6k       | ~60–120 (static assets count too; keep them cached) |
| D1 rows read (5M/day)      | small           | not the constraint                                  |

Solo testing fits with a wide margin. A 10-friend beta at ~3 h/day each (~30 active hours) fits; ~20 regular players doesn't, and the first quota to go is the write quota.

### What inflates this estimate

- **Layer 2 of the threat model** (per-hit server calls instead of per-kill): 5–10× the request and write rates. Defer until ranking ships and the cost is justified.
- **New indexes on hot columns**: every index a kill's UPDATE touches is one more row written per kill (game-schema.ts header).
- **Invalidating instead of writing results into the cache**: each invalidation is a refetch request. The hooks write results; keep it that way.
- **Spam scripts** (threats #1 / #2): one client can burn the shared quota. Layer 1 rate limits are the cap.
- **Optimistic rollback refetches**: `rollbackOnError` restores the snapshot and then refetches the keys it touched, since other writes may have landed meanwhile. Rejections are rare, so this is cheap; revisit only if the request quota gets tight.

### Other Free-plan risks

- **Concurrent read-modify-write** (threat #6): accepted while the game is solo-tested; escalation is a per-character Durable Object.
- **Password hashing CPU**: sign-up costs ~105–130 ms CPU against the Free plan's nominal 10 ms. Nothing has been rejected; if Cloudflare starts to, lower the scrypt cost in `src/server/password.ts`, don't buy a plan.

### Action items before opening a public beta

- Watch the Cloudflare dashboard (Workers requests, D1 rows written) after the first week of real play; compare with the model above.
- Ship Layer 1 rate limits (threat model): anti-cheat **and** quota ceiling against scripted spam.
- If the write quota binds before the player count justifies a paid plan, the levers are fewer rows per kill (already 1) and fewer kept items, not more caching.

---

## Camp cinematic biome ambience (deferred)

**Status**: Planned, not started.
**Triggered by**: time-based zone progression PR. The camp cinematic ships
text-only + a warm radial glow as a stand-in for the full ambient layer.

### Why

The cinematic was designed to feel "comfy" — a real rest stop, not a UI
pause. The text + slow HUD fade-out + warm glow gets ~60% of the felt
experience. The remaining 40% is in (a) biome-themed background art and
(b) ambient audio (campfire crackle + per-biome environment).

### Scope

- **Background art per biome**: hand-authored pixel scene per zone biome
  (forest, swamp, crypt, castle, void) showing the character resting at a
  campfire, in the spirit of the Dark Souls II–style "Hidamari" piece the
  user referenced. Replaces the current radial-gradient glow.
- **Ambient audio**: catalog biome ambient files (`/assets/audio/biomes/forest.mp3`, etc.)
  plus a generic `campfire.mp3` loop on top. Hook into the cinematic
  timeline: campfire+ambient fade-in synced with the first text fade-in;
  ambient fade-out only after the player picks a button (so the moment
  lingers as long as they need).
- **Zone metadata**: each zone declares its biome key; cinematic looks up
  the matching art + audio.
- **Volume**: respect the existing global SFX volume (`useSfxVolume`).
- **Accessibility**: ambient is auxiliary — the cinematic still reads
  fully with audio off.

---

## Item naming lexicon — open follow-ups (low priority)

**Status**: PRs #39 (tooltip labels + slot-aware mods) and #41 (decomposed lexicon + renderer + 20 tests) landed. The three items below are real but were intentionally deferred — none blocks a beta, but each one closes a small hole that will widen as more locales / modifiers land.

### 1. Native PT-BR review of bulk-translated entries

**Risk**: 130-ish lexicon entries (55 bases + 80 modifiers) were AI-bulk-translated. The four manually reviewed (Espada Bastarda, Estrela da Manhã, Maculado pelo Vazio, Gume) caught real awkwardness, so the rest probably has 5–10 similar issues. Fine for indie / pre-release. Not fine before a paid release in Brazil.

**Fix**: Walk through `lexicon/pt.ts` with a native speaker, especially:

- All `gendered` adj forms — check the `m`/`f` inflection
- The 21-tier "owner" ladder (warden / champion / templar / archon / sovereign / etc.) reads as a power progression — does the PT chain feel like ascending power?
- Tier-21 void specials — the new `void_touched` / `void_forged` / `void_woven` / `void_inscribed` family is intentional, but each adjective should feel epic in PT.

**Why deferred**: project is solo dev pre-release. Translation quality is the kind of thing a real audience surfaces, not a code reviewer.

### 2. Codegen for `TemplateBaseId` / `TemplateModifierId`

**Risk**: `src/game/items/lexicon/template-ids.ts` declares the two literal unions by hand. The data files (`data/templates/*.ts`) reference these unions but the union itself is human-maintained — if someone adds a base/modifier to a template file using a string that isn't yet in the union, TypeScript catches it. But adding the union member doesn't force them to add a lexicon entry until they re-run tsc.

**Fix**: small codegen step. Walk `data/templates/*.ts` at build time (or via a `vitest` snapshot), collect every `nameBase` / `nameModifier` value, emit `template-ids.generated.ts`. The hand-written file just re-exports the generated union. Lexicons then can't compile if the unions grow without entries.

**Why deferred**: the hand-maintained file works for now. Codegen is the right call if/when there's a sustained pace of adding new bases.

---

## Future: rare-name bestiary (low priority)

**Status**: Idea parked. Not a priority — touches persistence, not combat feel.

**Why**: rares now get random proper names from the lexicon pools ("Garra de Aço, o Furioso" / "Stonemaw, the Furious"). Each spawn rolls a fresh `RareNameSeed` so the same monster type produces a different name every time. A bestiary would let the player accumulate the rares they've killed across runs — a memorable trophy log instead of forgotten flavor text.

### Scope sketch

- New D1 table `rare_encounters` keyed by characterId (mind the write quota: one more row per rare kill), storing: spawn seed, monster id, level, mods, killed-at timestamp, zone id. (Seed lets the renderer reproduce the same name later — the displayed string isn't stored, so locale-switch reads the right language out of the bestiary too.)
- `recordKill` mutation grows a branch: when `monsterRarity === "rare"`, also insert into `rareEncounters`.
- New world view (`/world` view mode `"bestiary"`, or a modal opened from the status card) lists past rares chronologically or by zone. Each entry renders via `translateEnemyName({ def, mods, rarity: "rare", nameSeed })`.
- Optional: count how many times the same `(monsterId, mod combo)` has been killed — repeat-kill stats add a collector dimension.

### Why deferred

Combat-feel work pays off the moment the player fights; persistence pays off later. The seed + mods are already first-class on the Enemy object, so the data plumbing is cheap when we get to it — no schema migration on monsters or names needed.

### Validation when picked up

- Add the table in `src/server/db/game-schema.ts` (`pnpm db:generate`), then have `combat.recordKill` insert the encounter on rare kills in the same batch.
- Manual: kill a rare, open the bestiary, see the same name. Switch locale — the bestiary entry renders in the new language. Kill a rare with the same monsterId, see a different name.

---

## Future: combat identity pass — spell scaling, class feel, bow balance

**Status**: Needs design discussion. No code yet.

**Why**: Act 1 rebalance (2026-05-27) raised monster HP/damage/accuracy by 50% and added elemental damage to every monster. The harder Act 1 exposed three design gaps:

### 1. Spell damage scaling locked to Mage

Spell damage currently only matters for INT-stacking caster builds (staff/wand + tome). Warrior and Rogue have no access to spell scaling, which makes hybrid builds impossible and limits build diversity. Goal: open spell damage as a secondary scaling avenue for non-mage classes without eroding the mage's identity as the primary caster.

Open questions:

- Should non-mages access spell damage through gear (e.g. a "spell damage" suffix on melee weapons), through a passive tree node, or through active skills that scale off spell power?
- How much spell scaling is "enough to feel hybrid" without making pure-melee builds feel inferior?
- Mage identity lever: mages should still be the best at pure spell DPS. Possible lever: mage-exclusive "more spell damage" passives, or a mage-only mechanic (e.g. spell echo, spell penetration) that non-mages can't access.

### 2. Warrior and Rogue class individuality

Both classes currently play as "stack physical damage, swing weapon." There's no mechanical reason to pick Warrior over Rogue beyond base stats. Each class needs a signature mechanic that changes HOW they deal damage, not just how much.

Ideas to explore:

- **Warrior**: Fortify (damage reduction that stacks per hit landed), Rage (damage ramp-up over sustained combat), or a block/counter mechanic that rewards facetanking.
- **Rogue**: Critical strike synergy (guaranteed crit after evading, or crit multiplier scaling with evasion), Poison/Bleed DoTs that reward hit-and-run, or a combo system where consecutive hits accelerate.

### 3. Bow balance — strongest weapon in the game

Bows currently have two-handed weapon stat budgets while allowing a quiver in the offhand, giving them strictly more total stats than any other weapon setup. DPS is competitive with dual-wield but without the accuracy/survivability tradeoffs.

Proposed direction: make bow DPS competitive but with a **different damage application feel** — fewer, harder-hitting shots rather than a stream of fast hits. Ideas:

- **Accuracy penalty on bows**: lower base accuracy forces bow users to invest in accuracy gear or accept more misses. Thematic — bows are harder to aim than melee.
- **Slower base attack speed**: push bows toward "sniper" feeling (big hits, slow cadence) vs. dual-wield "blender" (many small hits, fast cadence). DPS stays comparable but moment-to-moment combat feels distinct.
- **Remove quiver or nerf quiver stat budget**: if the quiver is the problem, reduce what it gives rather than nerfing the bow itself.
- **Range advantage (future)**: if/when area-based mechanics land, bows could get a "first strike" or "safe distance" bonus that justifies their power — they pay for DPS with positioning, not raw stats.

Key constraint: the user wants DPS to be competitive across weapon types. The differentiation is in **feel** (cadence, hit weight, accuracy profile), not in raw output.

---

## Future: passive tree + active skills (not started)

Per CONTEXT.md → Classes, the order is:

1. MVP combat ✅ (done)
2. Passive tree (not started — needs design)
3. Active skills per class (not started — depends on passive tree)

When a session starts working on this, expect to add a third combat path (alongside attack/spell) for skill casts, and a major refactor to the stat engine to handle skill-gem-style modifier sources.

---

## Future: anti-cheat / server-authoritative event validation

**Status**: Documented, deferred. See [docs/security/threat-model.md](../security/threat-model.md).

The current system is server-authoritative for **values** (HP cap, XP per monster, drops, prices) but trusts the **client for events** (kill happened, current HP). Two real exploits exist today:

1. `recordKill` spam — infinite XP + free loot/potions.
2. `syncHp` god mode — never die.

Both are documented with severity, mechanism, and layered fixes in the threat-model doc.

**Decision**: not implementing now. Impact is local (no leaderboard / trade / shared economy yet). Cost-benefit favors deferring.

**Triggers for starting**:

- Layer 1 (rate limits + zone preconditions, ~1-2h): public beta or any user-facing cheat concern.
- Layer 2 (session-based combat, ~4-6h): leaderboards, trade, or any feature where one player's progress affects another's.
- Layer 3 (server-tick combat, days): competitive mode with real value at stake.

When a session starts on this, read the threat-model doc first — it has the schema changes, acceptance criteria, and tradeoffs per layer.

---

## Eliminate residual admin-dashboard navigation latency (low priority)

**Status**: Planned, not started. User-flagged on PR #46 — current state ("muito melhor mas não como eu quero") accepted as a stopping point; remaining latency tracked here.

**Why**: even after the PR #46 polishing pass (loader-based prefetch in `character-select`, `preload="render"` on the `/admin` Link + sidebar Links), the **first** `/character-select` → `/admin` navigation in a session was perceptibly non-instant on Convex.

**Update (Cloudflare migration phase 3)**: the WebSocket subscribe handshake that was the root cause is gone. Admin queries are one-shot tRPC queries, batched into a single request, and SSR runs them in-process (`localLink`) with the result dehydrated into the page (`setupRouterSsrQueryIntegration`), so a hard reload of an `/admin/*` page arrives with its data. What can still cost is the client-side code-split chunk fetch and one HTTP round trip on the first in-app navigation. **Re-measure before doing anything**; if it's still noticeable, the remaining direction is a persistent query cache (`@tanstack/query-persist-client-core` + IndexedDB) so the first visit per session hits the cache.

### What has already been tried (don't redo)

- Loader prefetch of the admin tabs in `character-select` (now through `prefetchAdminTabs(queryClient, trpc)`), `<Link preload="render">`, `defaultPreloadDelay: 0`, and the `/admin` pending shell.
- SSR of the admin payload (in place since phase 3 via the route loaders' `ensureQueryData`).

### Why deferred

Current latency is acceptable for the admin-only audience (friends-beta) — admins refresh deliberately, not continuously, so a sub-second cold-cache delay isn't a real cost. This entry exists so the residual `/admin` latency doesn't get re-discovered as a new problem the next time someone polls the dashboard.

### Validation when picked up

- Time `/character-select` → `/admin` first-paint with the Performance panel: target <50ms from `click` to first paint of populated cards.
- Same flow on a hard reload directly to `/admin/users`: target a single network roundtrip and no visible pending shell.
- Confirm non-admins still never trigger admin queries (the gating in the loader stays correct).
