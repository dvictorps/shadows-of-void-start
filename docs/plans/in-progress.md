# In-progress work

Decisions made but not yet executed. Read this before starting a session — if your task overlaps with something here, you may be duplicating planned work or causing conflicts.

When a planned item starts, move it to a feature branch and reference back here. When it ships, delete the entry (closed work belongs in commit history, not this file).

**Doc language convention**: narrative + meta-docs in English (CLAUDE.md, CONTEXT.md, codebase-map, playbooks, ADRs, and the prose in this file all follow this). PT preserved only for game-domain proper nouns — `Acampamento`, `Incenso Etéreo`, `Calmaria`, item-name examples (`Espada de Ferro`), monster names, etc. Code identifiers stay English. Mixing the two in narrative produces the kind of code-switching that confuses future agents and downstream tooling (translation platforms, search) — don't.

---

## Next session — pick up here

Both monolith refactors are done — world.tsx (PR #45) and useCombatLoop (PR #47, split into `useCombatLoop` + `useCombatTick` + `useEncounterSchedule`). Camp/phase derivation (PR #48), thorns-reflect fix (PR #49), spam-click in-flight tracking (PR #50), the phase-arg dead-weight cleanup (PR #51), the `useInFlight` extraction (PR #52), and the single-active-session lock (`feat/single-active-session`) all shipped. The leaderboard hard-blocker is now cleared.

Pick the next item by readiness: **monster crit** (queued below — finally activates the build-pressure that the PoE-style armor formula assumes) is the highest-leverage gameplay debt; **native monster barrier** is mechanical; **CLASS_NAME helper extraction** is a 30-minute polish PR that retires four duplicate maps.

### world.tsx size — closed decision

PR #52 landed world.tsx at 740 lines (down from 774, the original monolith was 900). Further extraction (e.g. `useExitFlow`, `useTravelHandlers`) was considered and rejected — the file no longer mixes concerns (composition / handlers / derivations / JSX are contiguous sections), so further splitting would hide flow that today reads linearly. The trigger for revisiting is concerns getting *re-mixed* (business logic inside JSX, mutation hooks called outside the composition block, fetch in a handler) — NOT raw line growth. The styleguide rule in `.gemini/styleguide.md` was updated to reflect this distinction. Orchestrator routes at this app's scale have a natural floor around 700-750 lines.

---

## Project health snapshot (as of 2026-05-24)

**Current grade: A** (composite across architecture / code quality / docs / scalability / agent ergonomics).

This is a self-assessment from senior-review passes after PRs #39 (tooltip i18n + slot-aware mods), #41 (decomposed item-name lexicon + 20 renderer tests), #42 (playbook + codebase-map refresh), the agent-ergonomics-hardening pass (type-check sentinels for playbook drift via `tsc --noEmit` over `docs/playbooks/_examples/`, stub playbooks for queued Future domains, ADRs 0002 + 0003), and PR #45 (world.tsx split into `useWorldMutations` + `useViewMode` hooks and a `WorldModals` sibling, plus the shared `createInventorySlotAllocator` lift). The grade exists to give downstream agents a quick read on what's solid and what's debt — pick work that moves the needle, skip work that doesn't.

### Why A (criteria that earned the current grade)

- **Architecture: A-** — render-at-display-time naming + literal-union enforcement is the correct choice for a multi-locale ARPG (codified now in [ADR 0003](../adr/0003-render-at-display-names.md)). Lexicon pattern is battle-tested across two domains (monsters + items). Convex/TanStack split is coherent. Remaining hole: drift risk between lexicon and `mod-i18n.ts` (same modifier id in two independent tables) — flagged in the lexicon follow-ups below.
- **Code quality: A** — `src/game/` is pure + tested. 288 vitest cases. Comments are WHY-focused. One remaining stain: residual `as TemplateBaseId` casts at the Convex boundary (Convex validators can't express literal unions — captured in [ADR 0003](../adr/0003-render-at-display-names.md)). The world.tsx orchestrator dropped from 900 → 740 lines via PR #45 + PR #52.
- **Docs: A** — `CONTEXT.md` is best-in-class for a solo-dev project (976 lines of single-source-of-truth game rules). Three ADRs codify the load-bearing architectural decisions (optimistic mutations, three-system i18n, render-at-display naming). Playbooks accurate and link to type-checked sentinel examples; new system stubs let an agent picking up skills / passives / stash know which questions need answering before coding.
- **Scalability: A** — adding a new locale = 1 new lexicon file per domain + matching paraglide JSON. Adding a new template = 1 entry + 0 lexicon changes if base/modifier already exist. Decomposition cut lexicon size by 88% (562 → 135). Literal-union enforcement makes "forgot a translation" a compile error.
- **Translation quality: B-** — 130 PT lexicon entries were AI-bulk-translated. Four hand-revised (Espada Bastarda, Estrela da Manhã, Maculado pelo Vazio, Gume) caught real awkwardness, so the rest probably has 5–10 similar issues. Fine for indie pre-release, not for a paid Brazilian release.
- **Agent ergonomics for ONBOARDING: A+** — `CONTEXT.md` + `CLAUDE.md` + `codebase-map.md` get an agent productive in ~30 minutes.
- **Agent ergonomics for MODIFYING existing things: A+** — strong TS catches mistakes. Both monolith refactors have shipped: world.tsx from 900 → 740 lines (PR #45 + PR #52), `useCombatLoop.ts` from 916 → 411 lines split into `useCombatLoop` + `useCombatTick` + `useEncounterSchedule` (PR #47). No remaining single-file navigation tax above ~750 lines, and the styleguide now distinguishes "concerns re-mixing" (real debt) from "line growth" (not debt).
- **Agent ergonomics for ADDING NEW systems (skills, passive tree, stash): B** — stub playbooks now exist for each queued Future domain, listing the decisions to resolve + the ADRs the agent will need to write. The systems themselves aren't built, but the orientation infrastructure is. The grade returns to A once the first new system ships against its stub without an emergency refactor.

### What raises the grade

| Move | Outcome |
|---|---|
| Native PT review of `lexicon/pt.ts` | Translation quality B- → A. Composite **A → A+**. |
| 3+ months of system additions (skills / passive / stash) WITHOUT emergency refactor against the stubs | **A+** — architecture proven at scale, not just at theory. Until then A+ is hypothetical. |

### What lowers the grade

| Risk | Drop |
|---|---|
| Next major refactor ships without updating relevant playbooks (drift recurs) | A → B+. The type-check sentinels under `docs/playbooks/_examples/` cover the playbook code blocks via `tsc --noEmit` — but a refactor that *also* changes the surrounding prose without updating it is still possible, and there is no CI workflow that enforces `tsc` on push (no `.github/workflows/` yet — local discipline is the only guard). |
| New domain shipped that ignores its stub playbook (and doesn't write the ADRs it flagged) | Scalability slips A → B+. The first system to do this sets a precedent that's hard to walk back. |
| `world.tsx` grows further (or another orchestrator route hits the same shape) | Modifying existing → B+. Agent navigation tax compounds. |
| Someone "optimizes" render-at-display by pre-rendering names | Locale switching silently breaks. Now explicitly forbidden by [ADR 0003](../adr/0003-render-at-display-names.md). |
| `mod.description` (legacy field) becomes load-bearing again in any consumer | Defeats the render-at-display invariant. Tooltips diverge by locale. |

### Reading this from a fresh session

If you're picking up where we left off:

1. Read this snapshot first — know where the project sits and what's at stake.
2. world.tsx split (PR #45), useCombatLoop split (PR #47), camp/phase derivation (PR #48, closed Threat #3), thorns-reflect fix (PR #49), spam-click in-flight tracking (PR #50), phase-arg cleanup (PR #51), `useInFlight` extraction (PR #52), and the single-active-session lock (`feat/single-active-session`, closed Threat #5) are all **done**. The leaderboard hard-blocker is cleared — competitive features are unblocked architecturally.
3. When a major refactor lands, **update the relevant playbook + sentinel + codebase-map + CONTEXT.md + this file in the same PR** (this is the single most important habit for keeping the grade trajectory positive — see the "Doc-update discipline" section in `CLAUDE.md`).

---

## Beta readiness — Convex cost envelope (snapshot, refine with real telemetry)

Reference material, not planned work. Snapshot taken 2026-05-23 in response to the deployment / scaling question. Update this section when real call-rate observations diverge from the model below.

### Per-active-hour call rate (estimated)

Combat-tick mutations driven by `useCombatLoop` against `convex/combat.ts`:

- `recordKill` — 1 per monster kill. At ~6s/kill cycle (spawn gap + ~3s fight typical) that's ~600/hour. Endgame burst rates (heavy dual-wield + ambush packs) approach ~1200/hour.
- `syncHp` — gated on `hp !== lastSyncedHpRef` + 10s ticker → ceiling 360/hour, but most idle players hit far less because HP only changes during active combat.
- `usePotion` / `useEtherealIncense` — ~10-30/hour.

Out-of-combat mutations driven by `useWorldMutations`:

- `enterZone` / `exitZone` / `pickFromBag` / `discardFromBag` — ~20-40/hour. Zone changes are deliberate, not spammed.
- `startTravel` / `arriveAtTravel` — pair on each node transition. ~10-20/hour.
- `equipItem` / `unequipItem` / `reorderInventory` — ~10-50/hour during active loot sessions.
- `vendorBuy` / `vendorSellMany` — bursty around vendor visits. ~5-20/hour averaged.

**Total mutations per active hour: ~700-1500.**

### Reactive query updates also bill

Convex meters function calls, which includes query re-runs triggered by mutations on watched tables. Every `recordKill` invalidates `api.characters.list` (level/xp/potions/incense) and `api.items.zoneBag` (the new drop). Every `equipItem` invalidates `api.items.inventory` + `api.items.equipped`. Multiplier from reactive reads is roughly **2-3× the mutation count**.

**Estimated chargeable function calls per active hour: ~2000-4000.**

### Projection against tiers

Verify exact numbers at [convex.dev/pricing](https://www.convex.dev/pricing) — Convex adjusts plans periodically. Approximations as understood today:

| Tier | Included calls / month | Active hours / month it supports | Reads as |
|---|---|---|---|
| Free (Starter) | ~1M | ~250-500 | Friends beta (10 friends × ~10h each = 100h) fits with headroom |
| Pro ($25 base) | ~25M | ~6000-12000 | ~100 daily-active players × ~2h/day fits inside the included quota |
| Above Pro | Usage-based overage | — | Depends on per-call overage rate |

### What inflates this estimate

- **Layer 2 of the threat-model fix** (per-hit mutation instead of per-kill): 5-10× the call rate. Defer until ranking ships and the cost is justified.
- **Frequent leaderboard subscriptions**: a "live top 100" view re-runs the leaderboard query for every subscriber whenever any one of the top 100 levels up.
- **Multi-tab abuse** was the worst offender here, multiplying a single user's call rate by tab count. Closed in `feat/single-active-session` (see Threat #5 in `docs/security/threat-model.md`) — every state-mutating mutation now rejects stale tabs.

### What does NOT matter for Convex cost

Bandwidth. Convex bandwidth allowances are generous and SPA payloads are tiny (character doc + inventory + zone bag is well under 100KB even at endgame). Bandwidth is the **frontend host's** concern (Vercel / Cloudflare Pages), not Convex's.

### Action items before opening a public beta

- Watch the Convex dashboard's function-call counter after the first week of real play. Compare actual rate to the ~2000-4000/hour model above; refine the projection.
- Ship Layer 1 rate limits (threat-model). They serve double duty: anti-cheat **and** cost ceiling against scripted spam.
- ~~Ship the single-active-session lock.~~ ✅ Done in `feat/single-active-session`.

---

## Attribute baseline rebalance pass (low priority — wait for player feedback)

**Status**: Live, watching. Shipped in the over-level + attributes patch.

**Why**: Initial conversions chosen by gut:
- Str → +1% Melee Damage / point
- Dex → +2 Accuracy / point
- Int → +2% Barrier per 10 points (= 0.2 / point)

At ~80 of the primary attribute that lands at +80% melee / +160 acc / +16% barrier. Str clearly dominates Int — fine if Mage gameplay still feels good (Int is meant as a defensive nudge, not the offensive bedrock; spells lean on `spell` + per-element increased), but if Mage feels flat at level ~15+ revisit:

- Cheapest knob: bump `INT_BARRIER_PCT_PER_POINT` (in `src/game/stats/compute.ts`) from `0.2` → `0.5`.
- Or: add a second Int conversion (e.g., +1% spell damage / point).

Open until a Mage run reaches Act 1 endgame.

---

## Act-boss node Model B refit for time-bar (deferred)

**Status**: Planned, not started.
**Triggered by**: time-based zone progression PR. The act-boss node still uses the older "Bar 1 fills → miniboss → Bar 2 fills → act boss" Model B (see CONTEXT.md → Act Boss). With regular zones moving to time-based bars, the act-boss node needs design alignment.

### Open questions to resolve before coding

- Does each Model B bar become a separate time-bar with its own schedule? Or stay as a kill counter (the act-boss node remains the only place with kill-counter pacing)?
- Do camps appear in the act-boss node? Probably no — boss node = commitment.
- Does the player get a checkpoint after killing the act-boss-miniboss (between Bar 1 and Bar 2)? With time-based, a brief pause + heal would feel natural — but it dilutes "Bar 2 starts immediately".
- Does Incenso Etéreo work in the act-boss node? Probably no (mirroring the existing "no incenso during boss" rule applied to the whole boss node).

### Why deferred

Time-based zone progression is already large; mixing Model B redesign in would double the scope and complicate testing. Act-boss can ship on the old model until this lands.

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

### 3. Hash function → `src/lib/rng.ts`

**Risk**: `hashItemId` in `item-name.ts` is FNV-1a; `CombatScene.tsx` has a separate `*31`-walk hash. Both are deterministic string→[0, 1) hashes. Two implementations, same purpose, will drift.

**Fix**: extract to `src/lib/rng.ts` as `hashStringToUnit(s, salt?)` (or two-output variant). Both callers consume from there. Was flagged in the first simplify pass and deferred — the second caller (CombatScene) uses a weaker hash that probably should upgrade to match.

**Why deferred**: not load-bearing, both implementations currently work. Worth doing when next touching `CombatScene`'s hash.

### 4. Convex validator can't enforce literal unions

**Constraint, not a bug**. `nameBase` / `nameModifier` are stored as `v.optional(v.string())` because Convex validators don't have ergonomic literal-union support. The in-process `GeneratedItem` type widens to `string` at the persistence boundary — the lexicon files themselves keep the union enforcement. If Convex ever ships a `v.unionLiteral([...])` helper, swap in.

---

## Native monster barrier

**Status**: Planned, not started. Triggered by the "Additional Barrier" monster mod from the zone-progression PR.

**Why**: today the `monsterAdditionalBarrier` mod folds into HP (`hp × 1.3`) as a placeholder because monsters have no barrier mechanism. The player has barrier (pool above HP, 6s recovery timer, full refill — see CONTEXT.md → Defenses → Barrier). Monsters should have the same shape so the mod's flavour matches its identity ("barrier above HP", not "more HP").

### Scope

- Extend `ScaledMonsterStats` with a `barrier: number` field (currently absent).
- Add `barrier` and `barrierRecoveryRemaining` to the live enemy state on `Enemy` (mirror the player's `BarrierState`).
- Reuse `damageBarrier()` / `tickBarrierRecovery()` from `src/game/combat/barrier.ts` on the enemy side of the combat tick.
- Update `monsterAdditionalBarrier` mod to grant a real barrier pool (e.g., `barrier += hp × 0.3`) instead of inflating HP.
- UI: render a thin blue strip above the enemy HP bar when barrier > 0 (mirror the player's HealthGlobe barrier ring).

### Validation

- `npx tsc --noEmit`, `npx vitest run`
- Manual: roll a magic mob with Additional Barrier. Confirm barrier pool absorbs first, refills 6s after empty, doesn't refill while above zero.

---

## PoE-style armor ecosystem — monster crit + CONTEXT.md doc fix (queued)

**Status**: Planned, not started. Two coupled items surfaced during a design pass on combat math.

**Background**: armor used to compute as Last Epoch-style (`armor / (armor + 10 × enemyLevel)` — denominator scales with attacker level). That formula gave ~90% physical reduction from a single chestplate in act 1, making the character effectively immortal vs phys. The actual code in `src/game/combat/damage.ts:55-67` now uses PoE-style (`armor / (armor + 10 × physical)` — denominator scales with hit size), capped at 85%. The comment in the code explains the trade-off: "tank against trash, falls off against spikes."

The pivot is correct for the genre — in auto-combat the player can't skill-check a spike, so the defense system has to force diversification (armor + barrier + resistances + evasion) instead of one stat solving everything. **But the spike side of the ecosystem isn't built yet**: `rollEnemyAttack` in `damage.ts:220-251` hardcodes `isCrit: false`. Enemies miss/hit/block but never crit. So PoE-style armor today reads as "always strong" because nothing tests its weakness — the build-diversification pressure the formula assumes doesn't materialize until a big-hit source exists.

### Item 1 — CONTEXT.md armor section is stale

`CONTEXT.md:248-253` still describes the Last Epoch-style formula and explicitly says "The denominator scales with the attacker's level, **not** with hit size. Armor stays effective against same-level enemies regardless of how big any single hit is — unlike PoE…". That contradicts the code. Next agent reading the doc will trust it and may try to "fix" the code back. Update the section to reflect the PoE-style choice + record the historical pivot reason (act-1 immortality) so future passes don't re-litigate it.

### Item 2 — Monster crit (the missing big-hit source)

Add crit roll to `rollEnemyAttack` (the player's crit roll in `rollPlayerSwing` is the reference shape — same `random() × 100 < critChance`, same multiplier). Scope decisions to make first:

- **Where does monster crit chance come from?** Options: (a) flat baseline per monster level (e.g., 5%, mirroring player floor), (b) only rare/miniboss roll crit, (c) a monster modifier in the rare/magic pool. Probably (a) + (c): every monster has a small baseline, plus a `monsterCritChance` modifier that magic/rares can roll for spike pressure.
- **Crit multiplier?** Default 1.5× (player's effective crit-mult floor). Magic/rare mod can stack on top.
- **Telegraph?** Auto-combat doesn't let the player react, but the damage event should be flagged `isCrit: true` so the UI can render the hit differently (number color, screen shake, sound) — same shape the player's crit feedback already uses.
- **Balance pass after**: once monster crit lands, re-curve armor / barrier / resistance values together. The current numbers were tuned implicitly assuming no crits.

### Validation

- `npx tsc --noEmit`, `npx vitest run` — extend `damage.test.ts` with enemy-crit cases.
- Manual: spawn a magic mob with the crit modifier, take a few hits, confirm crits visibly different in the HUD + observably bigger damage.

### Why this matters strategically

PoE-style armor + no big-hit source = armor is dominant for free. Once monster crit ships, armor becomes a real trade-off ("I'm tanky vs sustained dps but a crit can spike me — do I stack resist? barrier? evasion?"). That's the build-pressure the design assumes but doesn't currently have.

---

## Future: rare-name bestiary (low priority)

**Status**: Idea parked. Not a priority — touches persistence, not combat feel.

**Why**: rares now get random proper names from the lexicon pools ("Garra de Aço, o Furioso" / "Stonemaw, the Furious"). Each spawn rolls a fresh `RareNameSeed` so the same monster type produces a different name every time. A bestiary would let the player accumulate the rares they've killed across runs — a memorable trophy log instead of forgotten flavor text.

### Scope sketch

- New Convex table `rareEncounters` keyed by characterId, storing: spawn seed, monster id, level, mods, killed-at timestamp, zone id. (Seed lets the renderer reproduce the same name later — the displayed string isn't stored, so locale-switch reads the right language out of the bestiary too.)
- `recordKill` mutation grows a branch: when `monsterRarity === "rare"`, also insert into `rareEncounters`.
- New world view (`/world` view mode `"bestiary"`, or a modal opened from the status card) lists past rares chronologically or by zone. Each entry renders via `translateEnemyName({ def, mods, rarity: "rare", nameSeed })`.
- Optional: count how many times the same `(monsterId, mod combo)` has been killed — repeat-kill stats add a collector dimension.

### Why deferred

Combat-feel work pays off the moment the player fights; persistence pays off later. The seed + mods are already first-class on the Enemy object, so the data plumbing is cheap when we get to it — no schema migration on monsters or names needed.

### Validation when picked up

- Add the table in `convex/schema.ts`, then in `convex/combat.ts:recordKill` upsert the encounter on rare kills.
- Manual: kill a rare, open the bestiary, see the same name. Switch locale — the bestiary entry renders in the new language. Kill a rare with the same monsterId, see a different name.

---

## Future: passive tree + active skills (not started)

Per CONTEXT.md → Classes, the order is:

1. MVP combat ✅ (done)
2. Passive tree (not started — needs design)
3. Active skills per class (not started — depends on passive tree)

When a session starts working on this, expect to add a third combat path (alongside attack/spell) for skill casts, and a major refactor to the stat engine to handle skill-gem-style modifier sources.

---

## Future: stash + vendor (not started)

Per CONTEXT.md → Stash and Vendor, the design is locked but no code exists:

- Stash: account-scoped, mode-isolated (softcore / hardcore), 60 slots + purchasable tabs.
- Vendor: per-act, sells consumables (potions today), buys gear for Rubys.
- Ruby: currency. Monsters never drop Rubys directly.

This is **scoped after** the passive tree because economy + progression need to balance against built characters.

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

## Extract `CLASS_NAME` paraglide map to a shared helper (queued)

**Status**: Planned, not started. Flagged by the simplify pass on the admin dashboard PR (#46) and deferred from that PR to avoid scope creep. Both agents that reviewed the admin diff (reuse + quality) called out this duplication as a real concern.

**Why**: the same `Record<CharacterClassId, () => string>` paraglide-message map is inlined in **four** call sites today:

- `src/routes/character-select.tsx:18-22`
- `src/components/CreateCharacterModal.tsx:19-23`
- `src/components/world/StatusCard.tsx:13-17`
- `src/routes/admin/users.tsx:21-25` (added in PR #46)

The comment at `src/game/classes/data.ts:5-6` already calls out that consumers maintain these maps — the codebase has been waiting for someone to extract the helper. Four copies is the tipping point: any future change to a class name (rename, new class, locale-specific tweak) has to touch four files and risks drift.

### Scope

- Add a new helper in `src/game/classes/i18n.ts` (matches the world/items locale-i18n shape) exporting:
  ```ts
  export function getClassDisplayName(classId: string): string {
    const def = findClassDefinition(classId);
    if (!def) return classId;
    // CLASS_NAME map lives here, keyed by CharacterClassId, paraglide getters as values.
    return CLASS_NAME[def.id]();
  }
  ```
- Replace the inline `CLASS_NAME` + ad-hoc resolution in all four call sites with `getClassDisplayName(c.classId)`.
- Remove the now-stale comment in `src/game/classes/data.ts` (the one that flags this duplication).

### Watch out for

- `src/routes/admin/users.tsx` (PR #46) wraps the call in a tiny `classDisplayName` helper that handles the unknown-class fallback. The shared helper should keep that fallback so the admin drill-down doesn't crash on a legacy character with a removed class id.
- The three non-admin call sites currently use `m.unknown_class()` as the fallback, not the raw id. Check whether the shared helper should also fall back via paraglide (consistency) or return the raw id (admin behavior). Reasonable answer: paraglide fallback, since the admin row would also benefit from a translated "Unknown class" label.

### Validation

- `npx tsc --noEmit`, `npx vitest run`, `npx biome check`.
- Manual: open character-select, the create-character modal (after picking each class), the world status card, and `/admin/users` (expand a row). Class names render in the active locale for every site.

### Why deferred from PR #46

PR #46 added one of the four duplicates as part of building the admin dashboard. Extracting in the same PR would have pulled `CreateCharacterModal.tsx` and `StatusCard.tsx` into the diff — files unrelated to admin work — bloating the review surface and conflicting with the in-flight `useCombatLoop` split work in adjacent areas. The extraction is small enough that a focused follow-up PR is the cleaner path.

---

## Eliminate residual admin-dashboard navigation latency (low priority)

**Status**: Planned, not started. User-flagged on PR #46 — current state ("muito melhor mas não como eu quero") accepted as a stopping point; remaining latency tracked here.

**Why**: even after the PR #46 polishing pass (loader-based prefetch in `character-select`, `preload="render"` on the `/admin` Link + sidebar Links, indexed `listUsers`/`listAdmins`, TanStack Query cache shared via `convexQuery`), the **first** `/character-select` → `/admin` navigation in a session is still perceptibly non-instant. Subsequent tab switches inside `/admin` are usually fine because the data sits in cache.

The root cause is structural, not a missed knob:

- Every Convex query is a **WebSocket subscription**, not a one-shot fetch. The first read of a given `queryKey` needs the subscribe-and-first-response handshake (~50–100ms). TanStack Query can amortise this with prefetch, but it can't make the handshake itself synchronous.
- Code-split chunks for `/admin`, `/admin/users`, `/admin/admins`, `/admin/items` are downloaded on demand. `preload="render"` covers the common path but a fast click before the link mounts (which depends on the role query resolving) still races the chunk fetch.

### What has already been tried (don't redo)

- `loader: async ({ context }) => { await ensureQueryData(getUserRole); if (admin) prefetchQuery(...) × 3 }` in `character-select`. Fires before render — verified via task list on PR #46.
- `<Link to="/admin" preload="render">` on the character-select admin button + every sidebar Link in `AdminShell`. Loads chunks + runs loaders at link-mount time.
- `defaultPreloadDelay: 0` in `src/router.tsx`. Hover-intent fires instantly when it fires.
- `pendingComponent: AdminLayoutPending` + `pendingMs: 0` on the `/admin` route so the shell flips in synchronously even when the loader has work to do.

The remaining gap is the **first** subscribe roundtrip itself — there's no client-side trick that beats it.

### Directions worth exploring

Pick whichever fits the next pass; do NOT do all three.

1. **SSR-inline the first admin payload** (matches the Convex `preloadQuery` pattern from `convex/nextjs`). TanStack Start's loaders run server-side on initial page loads — if `/character-select`'s loader fetches the admin queries via HTTP on the server when the user is admin, the values can be inlined into the HTML and hydrated into the TanStack Query cache before any client-side WebSocket connects. The subsequent live subscription takes over with zero perceived latency. This is the canonical Convex answer for "no first-paint roundtrip". Cost: SSR-only queries don't get reactivity until the websocket subscribes, but for admin metrics that's fine.
2. **Persistent client cache** via `@tanstack/query-persist-client-core` + IndexedDB. After the user has hit admin once, the cached payload survives reload and even a fresh tab, so the "first visit per session" handshake collapses into "first visit ever" for that browser. Cheaper to implement than SSR; doesn't help the very first time. Note: we deliberately dropped the bespoke `useCachedQuery` localStorage layer when migrating to TanStack Query — this is the proper persistence path, not a regression to the old pattern.
3. **Split admin queries off the realtime substrate**. The admin dashboard genuinely doesn't need WebSocket reactivity — admins refresh deliberately, not continuously. A Convex HTTP action (or even a thin Convex `query` consumed via `ConvexHttpClient` with `serverHttpClient`) gives one-shot fetch semantics with the same auth pipeline. Lose live updates; gain HTTP-style request/response and a faster cold path. The architectural step the user asked about ("usar um banco relacional comum") doesn't need a new database — just a different transport on the same Convex backend.

### Why deferred

Current latency is acceptable for the admin-only audience (friends-beta) — admins refresh deliberately, not continuously, so a sub-second cold-cache delay isn't a real cost. This entry exists so the residual `/admin` latency doesn't get re-discovered as a new problem the next time someone polls the dashboard.

### Validation when picked up

- Time `/character-select` → `/admin` first-paint with the Performance panel: target <50ms from `click` to first paint of populated cards.
- Same flow on a hard reload directly to `/admin/users`: target a single network roundtrip and no visible pending shell.
- Confirm non-admins still never trigger admin queries (the gating in the loader stays correct).
