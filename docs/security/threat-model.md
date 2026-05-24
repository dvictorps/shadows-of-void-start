# Threat model — server-authoritative gaps

Snapshot of the game's anti-cheat posture as of `feat/vendor-economy` (May 2026). Documents what's already locked down, what's exploitable, and the layered plan to close the gaps when the game gets closer to production.

**Current posture**: deferred protection. The exploits in this doc are real but local-impact (cheaters accelerate their own progress; no leaderboard, trade, or shared economy exists yet). When any of those land, the high-priority items here become blocking work.

---

## What's already protected (do not regress)

These are server-authoritative for both the VALUE and the CALCULATION. The client cannot fabricate.

| Surface | Where | Protection |
|---|---|---|
| Cross-character access | every mutation | `authComponent.getAuthUser(ctx)` + `loadOwnedCharacter(authUserId, characterId)` verify the caller owns the character |
| Cross-character items | item ops | `item.characterId === args.characterId` + `locationKind` check |
| HP cap | `syncHp`, `enterCity`, `respawnDead`, `usePotion`, `recordKill` (level-up) | All clamp to `stats.maxLife` computed via the stat engine (post the silent-defense fix); client never decides max |
| XP per kill | `recordKill` | Reads `monster.xpReward` from game data; client only sends `monsterId` |
| Drop generation | `recordKill` → `rollDrop` | Server-side roll; client never decides rarity or template |
| Travel time | `startTravel` → `computeTravelTime(distance, stats.movementSpeed)` | Distance lives in node data; movement speed comes from the engine; client only sends destination |
| Travel arrival timing | `arriveAtTravel` | Server validates `Date.now() >= travelArrivesAt - 1000ms` (1s grace for clock skew). Cannot arrive >1s early |
| Sell price | `vendorSell` / `vendorSellMany` → `computeSellPrice(item.data)` | Server-side computation from item snapshot; client never decides price |
| Equip requirements | `equipItem` | Strict req check against stats computed *without* the new item — broken-state cascade prevents self-sustaining equips |
| Vendor purchases | `vendorBuy` | Server reads price from catalog data; deducts rubys; respects potion cap |
| Item ownership trail | items table lifecycle | Stable item id across `zoneBag → inventory → equipped → stash`; deletes are explicit |

If a future change is about to weaken any of these, treat it like a regression and flag it.

---

## Threat surface — what is exploitable today

The architecture is **server-authoritative for values** but **client-authoritative for events**. Every exploit below stems from that gap.

### 1. `recordKill` spam → infinite XP + loot (HIGH severity)

`recordKill({ characterId, monsterId })` validates that the monster id exists in game data but does **not** validate:

- That the character is actually in an active zone session.
- That the character is currently fighting that monster.
- That the monster's HP reached 0.

An attacker (or a player with a debugger) can:

```js
setInterval(() => convex.mutation("combat:recordKill", { characterId, monsterId: "goblin" }), 1)
```

→ accumulates `monster.xpReward` per call, plus runs the drop roll + potion-drop roll each time. Levels to cap in minutes. Stockpiles potions and gear.

**Why it works**: `recordKill` was built assuming the client only calls it when a kill genuinely happens. No server-side state corroborates the event.

### 2. `syncHp` god mode (HIGH severity)

`syncHp({ characterId, hpCurrent })` clamps to `[0, maxLife]` but accepts any value in that range — including a value *higher* than the character's actual HP. The server has no concept of "expected HP" because combat ticks live client-side.

```js
setInterval(() => convex.mutation("combat:syncHp", { characterId, hpCurrent: 99999 }), 100)
```

→ permanent full HP, never dies, never loses XP from death.

**Why it works**: `syncHp` was designed as "send your local HP for persistence" with no validation that the local HP is a plausible result of the combat that happened since the last sync.

### 3. `phase` arg trust → bag retention cap bypass (MEDIUM severity) — **CLOSED in PR #48 + #51**

**Resolution**: server-authoritative camp/phase derivation shipped in PR #48; the `phase` argument was removed entirely from `exitZone` / `pickFromBag` / `discardFromBag` in PR #51 (`derivePhaseFromCharacter` reads the server's own combat/exploration/camp state). The historical record below is kept for reference — the rest of this section describes the pre-fix behaviour.

---

`exitZone`, `pickFromBag`, and `discardFromBag` accept a `phase` argument that drives the bag-retention cap (camp = 100%, exploração / combate = 30%). The server enforces the cap math correctly for non-camp phases (PR #40), but the `phase` arg itself is **client-supplied** and unvalidated against server state.

```js
// Player is actually in combat — bag should cap at 30%
convex.mutation("items:exitZone", { characterId, keepIds, phase: "camp" })
// → server accepts phase: "camp", skips the 30% cap, lets the player keep 100%
```

The exploit is bounded to "keep more of the current zone's loot than the rules permit" — local impact, no cross-player effect — but it directly defeats a deliberate game-balance mechanism.

**Why it works**: combat phase is currently maintained only on the client (the combat loop tracks whether the player is in exploração / combate / camp). The server has no record of "this player is in camp right now," so it has nothing to compare the arg against. Same architectural cause as exploits #1 and #2.

**Status**: queued as its own deferred work item in `docs/plans/in-progress.md` → "Server-authoritative camp/phase derivation" — that entry has the full schema + mutation plan. The fix is independent of Layers 1-3 below (it doesn't need rate limits or session combat; it just needs the server to track `inCamp` itself and derive phase from it instead of accepting an arg).

### 4. No mutation-level rate limiting (MEDIUM severity)

There are no per-character per-mutation rate limits at the application level. Convex has infrastructure protections but each call still:

- Bills against the project's Convex quota.
- Adds DB write contention if the same character is hammered.
- Enables the two exploits above to run at full speed.

A determined attacker can multiply Convex cost meaningfully with sustained spam against a single character.

### 5. Concurrent multi-tab / multi-device sessions (HIGH severity once ranking ships)

The auth model identifies the **user**, not the **client**. `loadOwnedCharacter(authUserId, characterId)` answers "does this user own this character" — yes, in every tab. There is no "is this the active client" check anywhere on the character doc. Two tabs of the same browser (or a tab plus a phone browser logged into the same account) can both open the same character and run independent `useCombatLoop` instances against it.

Per-tab consequences when N tabs overlap:

- `recordKill` is credited N times per real kill cycle (each tab spawns its own enemy locally and reports a kill when its local fight ends) → **XP rate is N×**, drop rolls are N×, potion drops are N×, incense drops are N×.
- `enterZone` is last-writer-wins on `currentZoneSession`. Second tab's call rotates the session id, so the first tab's drops keep writing to a session id that's no longer tied to the character. The bag is effectively orphaned in the `items` table (still owned by the character via `authUserId`, but invisible to `zoneBag` query which keys on `currentZoneSession`).
- `syncHp` races — last-writer-wins every 10s. HP becomes incoherent: a healthy tab can resurrect a "dead" tab's character mid-tick.
- `usePotion` / `useEtherealIncense` — server clamps the count at 0 correctly, but optimistic local counts diverge per tab. The user sees ghosts.

Severity changes with the leaderboard. **Today (pre-ranking)**: bounded to weird bugs for a single character, no cross-player effect — same posture as the other threats above. **The day ranking ships**: any leaderboard entry built on multi-tab gameplay is fraudulent *by construction* — even **without intent**. A casual player who leaves the game open on phone + desktop is double-billing. Ranks become unsignal.

Cost amplifier: multi-tab abuse also multiplies the user's Convex function-call cost. A determined exploiter with 5 tabs makes their own character account for 5× quota. Layer 1 rate limits help, but per-tab limits don't fire against the same character — the spam is *distributed* across legitimate-looking sessions.

**Why it works**: nothing on the character doc identifies the session that's currently driving it. Fix shape lives in `docs/plans/in-progress.md` → "Single active session per character" (active-session token, threaded through every state-mutating mutation).

### 6. Lesser issues that are NOT urgent

These are real but the impact is bounded:

- `enterZone` / `enterCity` spam: creates churn but no value gained.
- `startTravel` spam: blocked by "already traveling" guard.
- `vendorBuy` spam: limited by ruby balance; cap is server-enforced.
- `vendorSell` spam: limited by inventory; idempotent failure on already-deleted items.

These shouldn't block production either, but they're the easy candidates for rate limiting since the legitimate frequency is low.

---

## Defense plan (layered, future implementation)

Three layers. Each closes a meaningful portion of the gap; each can be skipped if the project's threat model doesn't justify the cost.

### Layer 1: Rate limits + minimal preconditions (~1-2h)

Cheapest. Doesn't fix the trust issue, just slows abuse to human speed.

**Schema change**: add to `characters`:

```ts
lastActionAt: v.optional(
  v.object({
    recordKill: v.optional(v.number()),
    syncHp: v.optional(v.number()),
    vendorBuy: v.optional(v.number()),
  })
)
```

**Mutation changes**:

- `recordKill`: reject if `Date.now() - last.recordKill < 500ms`. Reject if `char.currentZoneSession === undefined` (you can't kill without being in a zone). Update `last.recordKill` to now.
- `syncHp`: reject if `Date.now() - last.syncHp < 1000ms`. Client already syncs at 10s intervals, so this is purely an anti-spam floor.
- `vendorBuy`: reject if `Date.now() - last.vendorBuy < 300ms`. Optimistic update keeps UX snappy; this stops scripted purchasing.

**Acceptance criteria**:

- Spamming `recordKill` faster than 500ms returns ConvexError "Too fast" instead of crediting XP.
- Calling `recordKill` outside a zone session returns ConvexError "Not in a zone".
- Spamming `syncHp` faster than 1s returns ConvexError "Too fast".
- Legitimate gameplay (combat tick at 50ms, server records ~1-2 kills/sec at endgame, syncHp at 10s) is unaffected.
- A vitest case per mutation that asserts the timing window.

**What this doesn't do**: a patient cheater can still grind XP at 2 kills/sec via `recordKill` spam (which is still faster than playing), and can still spoof HP at 1 hz. The bar is raised, not closed.

### Layer 2: Session-based combat for `recordKill` (~4-6h)

Server tracks the active enemy. `recordKill` validates against it.

**Schema change**: extend `characters`:

```ts
activeEnemy: v.optional(
  v.object({
    monsterId: v.string(),
    instanceLevel: v.number(),
    currentHp: v.number(),
    spawnedAt: v.number(),
  })
)
```

**Mutation changes**:

- New `spawnEnemy({ characterId })`: server picks from the zone's monster pool, rolls level, sets `activeEnemy`. Replaces the client-side `pickRandom(monsterPool)` in `useCombatLoop`.
- New `applyPlayerHit({ characterId, damage, isCrit, breakdown })`: server reduces `activeEnemy.currentHp`. Returns the new state.
  - Validates `damage` is plausible (≤ player's max possible single-hit damage from the stat engine).
- `recordKill({ characterId })`: no `monsterId` arg. Reads `char.activeEnemy`. Rejects unless `currentHp === 0`. Clears `activeEnemy` on success.

**Client changes**: combat loop pushes damage events to the server instead of just resolving locally. Damage popups still render locally for snappiness; server response confirms.

**Acceptance criteria**:

- `recordKill` without an active enemy → ConvexError "No active enemy".
- `recordKill` with `activeEnemy.currentHp > 0` → ConvexError "Enemy not dead".
- `applyPlayerHit` with damage > plausible max → ConvexError "Implausible damage".
- The full combat loop (spawn → hit → kill → loot → next spawn) still feels responsive (<200ms perceived latency at p99).
- Existing 218 vitest cases still pass; ~5 new server tests for the session state machine.

**Tradeoffs**:

- More round-trips per combat (one per hit instead of one per kill). At ~1-2 hits/sec, that's manageable. Above 5 hits/sec (heavy dual-wield endgame), might need batching.
- Sync complexity: client and server both track enemy HP. Need to handle desync gracefully (server is source of truth, client renders predicted state).

### Layer 3: Server-tick combat (DAYS, only if needed)

Server runs the combat loop entirely. Client only renders.

This is the "thin client" architecture that PoE / D4 / etc. use. It makes cheating practically impossible (any client manipulation just changes what the player sees locally; the server's state is unaffected). But it's expensive:

- Cost in dev time: days (potentially weeks) for a clean implementation.
- Cost in latency: every action is a round-trip. Snappiness depends on the server response budget.
- Cost in Convex usage: combat-tick mutations scale with active player count × tick rate. Could be prohibitive without rate-limiting and aggregation.

**Don't do this until**: a leaderboard or competitive mode exists and the value of cheating is high enough to justify the investment.

---

## Triggers — when to start each layer

| Layer | Trigger |
|---|---|
| Layer 1 | Public beta / open testing OR any user-facing concern about cheating |
| Layer 2 | Leaderboards land, OR trade between players ships, OR any feature where one player's progress affects another's |
| Layer 3 | Competitive mode (e.g., HC race), OR significant trade economy where cheats translate to real-world value, OR repeated Layer 2 bypasses observed |

The architecture is currently fine for "MVP closed development". Don't preemptively spend Layer 2/3 budget — wait for the trigger and ship the layer that matches the threat.

### Discrete fixes that don't fit the layered scheme

These close a specific exploit without depending on the broader rate-limit / session-combat infrastructure. Each is independent; ship in any order.

| Fix | Closes | Status |
|---|---|---|
| Server-authoritative camp/phase derivation | Threat #3 (`phase` arg trust) | ✅ **Shipped** in PR #48 + PR #51 — `derivePhaseFromCharacter` reads server state; `phase` arg removed from all mutations. |
| Single active session per character (see `docs/plans/in-progress.md`) | Threat #5 (multi-tab) | Queued. **Trigger: first competitive feature ships (leaderboard / rank / shared ladder).** Pre-leaderboard the bug is annoying; post-leaderboard it is fraud-by-construction. |

---

## Out of scope for this doc

- DDoS / infrastructure-level attacks: handled by Convex's platform.
- Account takeover / auth bypass: handled by better-auth; covered by their security model.
- Client-side exploits that don't reach the server: HUD manipulation, time-of-day spoof, etc. The server validates state; cosmetic cheats don't matter.
- Bot detection (humans vs scripts playing legitimately): orthogonal to this doc; rate limits in Layer 1 are accidentally a partial bot deterrent but not the goal.
