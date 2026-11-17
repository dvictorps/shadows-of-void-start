# Touching combat

Before you change `src/hooks/useCombatLoop.ts`, `src/hooks/useCombatTick.ts` or the pure combat math in `src/game/combat/`, read this. The combat loop has subtle constraints that will bite an agent that touches it casually.

## The architecture

Combat is a state machine split across two React hooks: `useCombatLoop` owns the encounter state (`searching` → `engaged` → `victory`, plus the intro and camp states) and `useCombatTick` owns the 50ms interval ticker, the swing math and the refs it reads and writes mid-tick.

```
            ┌──────────┐  spawn delay  ┌──────────┐ enemy.hp = 0  ┌─────────┐
state:      │ searching│ ───────────── ▶│ engaged  │ ─────────────▶│ victory │
            └──────────┘ (1500ms)      └──────────┘                └─────────┘
                  ▲                          │                          │
                  └──────────────────────────┴──────────────────────────┘
                                victory delay (800ms)
```

Each tick at `engaged`:

1. Update leech instances (delivers regen).
2. Tick the barrier: there is no passive regen. `tickBarrier` only counts down `refillRemaining` (the 10s refill after a break) and snaps the barrier back to max when it reaches zero. The player's barrier ticks in `useBarrier`, the enemy's inside the combat tick. See [ADR 0005](../adr/0005-barrier-regen-mechanic.md).
3. Advance `playerProgress` by `dt × stats.tickRate`.
4. Advance `enemyProgress` by `dt × enemyAttackSpeed`.
5. If `playerProgress >= 1`, subtract 1 and fire a player swing.
6. If `enemySwing`, fire an enemy attack (after the player's swing — player acts first).

When the player swings:

- Pick the active swing from `stats.swings` (dual-wield alternates via `nextSwingIndexRef`).
- Call `rollPlayerSwing` (pure function in `src/game/combat/damage.ts`) — returns `{ amount, isCrit, isMiss, breakdown }`.
- If the result is a hit: subtract from enemy HP, push a damage event, optionally spawn a leech instance, fire life-on-hit.
- If the enemy is dead: transition to `victory`, fire `recordKill` mutation (server records XP + rolls drops), return.

## The big traps

### 1. React batching vs sync state

You **cannot** rely on `useState` setters to be visible synchronously inside the same tick callback. We work around this with refs, most of them in `useCombatTick.ts`:

- `stateRef.current` (`useCombatLoop`) — read instead of `state`.
- `enemyRef.current` — read + mutate; setEnemy is just for re-render.
- `playerHpRef.current` — same pattern.
- `deadRef.current` — guards against double-firing death.
- `nextSwingIndexRef.current` — dual-wield alternation across ticks.

**Rule:** if a value is read inside the tick callback AND set somewhere else in the same tick, use a ref. The `setX` call is for rendering. The ref is for logic.

When you add a new piece of mid-tick state, follow the same pattern: declare both `const [foo, setFoo] = useState(...)` and `const fooRef = useRef(foo)`, and write to both (`fooRef.current = next; setFoo(next)`).

### 2. Zone entry vs pause

State is reset on zone entry, not on activation:

- `startVisit()` (`useCombatLoop`, which calls `useCombatTick`'s own `startVisit`) runs when the player enters a zone. It pulls the server HP, clears leech instances, resets the swing index and the dead guard, and switches to `searching`.
- `active: boolean` only pauses and resumes the tickers. On `!active && wasActive && !dead`, an effect in `useCombatTick` flushes unsynced HP and barrier to the server through `syncVitals`.

If you add state that must reset per visit, reset it in `startVisit`. If it must reach the server when combat pauses, flush it alongside the `syncVitals` call.

### 3. The dead guard

When the player dies:

1. `deadRef.current = true` immediately (so subsequent ticks don't re-fire death).
2. `queueMicrotask(() => onPlayerDeath())` — defers the callback so React renders the death message before the route navigates away.

If you add anything that touches `playerHp` post-death, gate it on `!deadRef.current` or the respawn flow will race with the stale 0 HP.

### 4. Combat is paused but the loot picker is open

`active` is `view === "combat" && !exitModal.isOpen`. When the player retreats, view flips to map, but the modal stays open with the bag. Combat stops ticking but the player's HP stays at whatever it was — that's intentional, so they aren't damaged while picking loot.

### 5. Tests use deterministic randoms

Pure combat tests (`src/game/combat/*.test.ts`) pass `rng: rngFromUnit(() => 0.5)` to force hits + no crits (the same `rng` feeds the hit, block, damage and crit rolls, in that order). If you add a new path that branches on `rng.unit()`, script the rolls with `rngFromUnit` to reach the path you want, or pass `seededRng(seed)` when the test only needs the rolls to be reproducible.

## What's safe to change

- **Pure functions** in `src/game/combat/damage.ts`, `barrier.ts`, `leech.ts` — changing these is mechanically safe as long as the existing tests pass. They have no React or IO dependency.
- **The damage formula** — read `CONTEXT.md` → "Damage formula" first. The formula is documented; if you change it, update the doc.
- **The state machine transitions** — guarded but careful. Adding a new state (e.g. `stunned`) means adding ref tracking and resetting it in `startVisit`.

## What's dangerous to change

- **The tick interval (50ms)** — affects perceived smoothness. Lower = smoother but more re-renders; higher = janky.
- **The ref+state pattern** — converting refs back to state will break kill detection (the goblin-not-dying bug was exactly this — see commit history for `enemyRef`).
- **The order of player vs enemy swing in a tick** — player-first is a design decision (CONTEXT.md → Tick order). Reversing it gives the player a damage disadvantage equivalent to one swing.

## When you finish

```bash
npx tsc --noEmit
npx vitest run src/game/combat/
npx vitest run src/game/stats/
pnpm lint:errors
```

Then `pnpm dev`, kill at least 5 mobs to verify victory transitions work, break the barrier to verify it stays empty for the 10s refill and then snaps back to full, and use a potion mid-combat to verify the optimistic update doesn't conflict with HP sync.
