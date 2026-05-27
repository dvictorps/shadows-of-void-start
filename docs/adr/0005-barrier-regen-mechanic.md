# 0005 — Barrier regen mechanic

**Status**: Accepted
**Date**: 2026-05-24

## Context

Barrier is the caster-aligned defensive layer — a pool that sits over life, blue ring around the HP globe. Silk armor and the tome provide flat barrier; jewelry provides smaller flat barrier rolls; `+% Barrier` increases on silk pieces and jewelry scale the flat pool; INT contributes a per-point `+0.2% Barrier Increased`. Endgame mage builds can stack `+5 000` barrier on top of `~1 500` life — barrier is roughly the *majority* of the mage's effective HP pool.

The original recovery mechanic was binary: when current barrier hit zero, a 6-second timer started; when the timer expired, barrier refilled to **100% instantly** in a single tick. Damage during the recovery window passed through to life directly; the timer did not reset on subsequent hits.

This produced a "double HP every 6 seconds" loop that interacted badly with the rest of the design:

- **Combat is 1v1.** A single fight typically resolves in ≤5s. The 6-second timer effectively guaranteed the next fight started with a fresh barrier. Mage was effectively immortal to anything but a continuous DPS source over ten seconds — a profile that didn't exist in Act 1.
- **Potions trivialised the recovery window.** With life potions healing 20% of max life and a 10-potion cap, the player could just potion through the 6 seconds of vulnerability and emerge with full barrier and most of their HP intact.
- **No build pressure on life.** Because barrier reset for free, stacking barrier was strictly better than mixing barrier with life — the failure mode of "barrier breaks and I die before it comes back" never materialised inside a single combat.

The design needed barrier to feel like a meaningful resource per combat, not an infinite reset, while preserving its core identity (overflow life that absorbs spikes, scales hard with silk + INT + tome).

## Decision

Replace the binary 6s-timer-then-full-refill mechanic with a **continuous regen + hard cooldown on break** model:

1. **Regen ticks always.** While barrier is above zero, it recovers at a fixed **5% of max barrier per second**. The rate applies in every state — combat, exploração, map, travel.
2. **Damage and regen run independently.** Incoming hits absorb from current; regen adds to current on its own per-second cadence. They don't interrupt each other. Net direction of the pool is `(regen_per_sec - average_damage_per_sec)`.
3. **Barrier break starts a 10s cooldown.** When current hits zero from damage, a 10-second cooldown begins. During the cooldown, regen is **paused** and any incoming damage goes straight to life. Subsequent hits do not reset or extend the cooldown.
4. **After cooldown, regen resumes from zero.** The cooldown does not refill the pool; it merely re-enables the regen tick. Full recovery from a break is therefore `10s (cooldown) + 20s (regen from 0 to 100%) ≈ 30s` of total downtime.
5. **No regen cap.** Heavy barrier investment is rewarded with proportionally higher raw regen. A 4 000-barrier mage regens 200/s; an 8 000-barrier mage regens 400/s. The intentional asymmetry vs leech (which caps at 20% of max life per second) is documented in CONTEXT.md → Defenses → Barrier and gets balanced through monster damage if endgame mages become invincible to trash.
6. **City entry resets barrier and clears the cooldown.** Same rule as life and potions — the city is the one "free full reset" point per zone.
7. **Gear swap preserves current.** Trading into higher max barrier expands the ceiling but does not refill. Trading into lower max clamps current down. Active cooldown is preserved.

## Why these rules

- **Regen is always-on, not delay-gated (unlike PoE).** PoE's energy shield uses a "no damage for N seconds → recovery starts" model. That model creates a *stop-start* feeling well-suited to PoE's hundreds-of-mobs-per-map cadence (you get reliable recovery between packs). Shadows of Void's 1v1 cadence makes "between packs" indistinguishable from "during combat" — a delay-gated model would feel arbitrary because there is no clear "out of combat" moment inside a zone. Always-on regen with a *hard* cooldown only on break is simpler to reason about and maps cleanly to "barrier is a recharging shield, breaking it is the punishing event."
- **Damage doesn't interrupt regen** because doing otherwise creates a "barrier stuck at low equilibrium" feel that resembles dying-by-papercut more than spike absorption. With non-interrupting regen, sustained DPS that roughly equals regen produces a slow drain instead of a stalled stalemate, while burst damage that exceeds regen still breaks the barrier and triggers the cooldown — both feel readable.
- **30 seconds of total downtime after a break** is calibrated against the 1v1 zone cadence: a typical engagement is 5–10s, gaps between encounters are 3–9s of exploração, and an ambush pack lasts ~5 spawns × ~5s. A broken barrier means the next 1–2 fights are without it — meaningful but not run-ending. Acampamentos and city visits are the rest points that fully reset; in-zone the player has to mitigate spikes with life and potions instead of waiting on a free refill.
- **No regen cap, parallel to "no `+% Max Life` mod" decision.** Both intentionally accept that mage's defensive ceiling is higher than warrior's life ceiling in absolute terms. The lever is monster damage scaling, not stat-cap engineering. This avoids special-case math in the engine and keeps regen behaviour predictable (`max × 0.05` is the rule, full stop).

## Consequences

- **API rename.** `BARRIER_RECOVERY_SECONDS` in `src/game/combat/constants.ts` becomes `BARRIER_COOLDOWN_SECONDS = 10`. A new `BARRIER_REGEN_FRACTION_PER_SECOND = 0.05` joins it. `BarrierState.recoveryRemaining` becomes `BarrierState.cooldownRemaining`. `tickBarrierRecovery()` becomes `tickBarrier()` and includes the regen branch.
- **`useCombatTick` reads regen + cooldown each tick.** Both run at the engine's 50ms cadence and consume the elapsed delta directly — no per-second batching.
- **Out-of-combat regen does not have a separate code path.** Map / travel / exploração regen comes "for free" from the same `tickBarrier()` call wherever the relevant clock advances. No special "out of combat" branch is needed.
- **Monster barrier (queued in `docs/plans/in-progress.md`) reuses the same mechanic.** When that feature lands, monsters get the same regen + cooldown shape — no second implementation. The placeholder in `monsterAdditionalBarrier` that folds barrier into HP can switch to a real barrier pool with `damageBarrier()` + `tickBarrier()` reused unchanged.
- **`CONTEXT.md` → Combat Resolution → Barrier is the single source of truth** for the user-facing semantics. The historical instant-refill model is recorded there as a footnote (and in this ADR's Context section) so future passes don't accidentally roll the change back.
- **Stat panel UI reads cooldown state, not "recovery remaining".** The label changes from "Recuperando…" / "X.Xs" to "Em recarga" / "X.Xs" (or equivalent), and the in-tooltip language follows.
- **No migration required for character documents.** Barrier state lives on the in-process `BarrierState` object inside the combat loop, not in the Convex schema — the rename is local to `src/game/`.

## Update (2026-05-26)

Regen rate nerfed from 5%/s to **0.5%/s** (`BARRIER_REGEN_FRACTION_PER_SECOND = 0.005`). Full recovery from empty goes from 20s to 200s (210s total with cooldown). Motivation: barrier sustain was too strong at 5%/s, making INT-stacking mages overly durable against sustained damage.

## Update (2026-05-27)

Regen rate buffed from 0.5%/s to **1%/s** (`BARRIER_REGEN_FRACTION_PER_SECOND = 0.01`). Full recovery from empty: 100s regen + 10s cooldown = 110s total. Motivation: 0.5%/s was too punishing — barrier felt like a dead stat in sustained combat. 1%/s preserves the "finite resource per fight" identity while making barrier investment feel rewarding again. Part of a broader Act 1 rebalance that also increased all monster HP/damage by 50%, added elemental damage to all monsters, and raised monster base accuracy (×15 instead of ×10).

## Related

- `CONTEXT.md` → Combat Resolution → Defenses → Barrier (the canonical glossary entry, kept in sync with this ADR).
- `docs/plans/in-progress.md` → Native monster barrier (the queued task that will reuse this mechanic on the enemy side).
- ADR [0004 — Static data conventions](./0004-static-data-conventions.md) — barrier constants live in `src/game/combat/constants.ts` per Rule 1 (designer-tuned, not player-mutable).
