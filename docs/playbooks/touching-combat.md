# Touching combat

Before you change `src/hooks/useCombatLoop.ts` or the pure combat math in `src/game/combat/`, read this. The combat loop has subtle constraints that will bite an agent that touches it casually.

## The architecture

Combat is a state machine driven by an interval ticker (50ms) in a single React hook.

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
2. Tick the barrier recovery timer (refills at expiry).
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

You **cannot** rely on `useState` setters to be visible synchronously inside the same tick callback. We work around this with refs:

- `stateRef.current` — read instead of `state`.
- `enemyRef.current` — read + mutate; setEnemy is just for re-render.
- `playerHpRef.current` — same pattern.
- `deadRef.current` — guards against double-firing death.
- `nextSwingIndexRef.current` — dual-wield alternation across ticks.

**Rule:** if a value is read inside the tick callback AND set somewhere else in the same tick, use a ref. The `setX` call is for rendering. The ref is for logic.

When you add a new piece of mid-tick state, follow the same pattern: declare both `const [foo, setFoo] = useState(...)` and `const fooRef = useRef(foo)`, and write to both (`fooRef.current = next; setFoo(next)`).

### 2. The activation effect

`useCombatLoop` takes an `active: boolean` prop. When it flips:

- `active && !wasActive`: pull server HP, clear leech instances, reset swing index, switch to `searching`.
- `!active && wasActive && !dead`: flush HP back to server via `syncHp`.

If you change the combat hook to accept additional state that needs activation handling, add it to that `useEffect` block.

### 3. The dead guard

When the player dies:

1. `deadRef.current = true` immediately (so subsequent ticks don't re-fire death).
2. `queueMicrotask(() => onPlayerDeath())` — defers the callback so React renders the death message before the route navigates away.

If you add anything that touches `playerHp` post-death, gate it on `!deadRef.current` or the respawn flow will race with the stale 0 HP.

### 4. Combat is paused but the loot picker is open

`active` is `view === "combat" && !exitModal.isOpen`. When the player retreats, view flips to map, but the modal stays open with the bag. Combat stops ticking but the player's HP stays at whatever it was — that's intentional, so they aren't damaged while picking loot.

### 5. Tests use deterministic randoms

Pure combat tests (`src/game/combat/*.test.ts`) pass `random: () => 0.5` to force hits + no crits. If you add a new path that branches on `random()`, write the test with an explicit random fn that produces the path you want to test.

## What's safe to change

- **Pure functions** in `src/game/combat/damage.ts`, `barrier.ts`, `leech.ts` — changing these is mechanically safe as long as the existing tests pass. They have no React or Convex dependency.
- **The damage formula** — read `CONTEXT.md` → "Damage formula" first. The formula is documented; if you change it, update the doc.
- **The state machine transitions** — guarded but careful. Adding a new state (e.g. `stunned`) means adding ref tracking and respecting the activation transition.

## What's dangerous to change

- **The tick interval (50ms)** — affects perceived smoothness. Lower = smoother but more re-renders; higher = janky.
- **The ref+state pattern** — converting refs back to state will break kill detection (the goblin-not-dying bug was exactly this — see commit history for `enemyRef`).
- **The order of player vs enemy swing in a tick** — player-first is a design decision (CONTEXT.md → Tick order). Reversing it gives the player a damage disadvantage equivalent to one swing.

## When you finish

```bash
npx tsc --noEmit
npx vitest run src/game/combat/
npx vitest run src/game/stats/
npx biome check src/hooks/ src/game/combat/
```

Then `npm run dev`, kill at least 5 mobs to verify victory transitions work, take damage to barrier to verify the 6s recovery, and use a potion mid-combat to verify the optimistic update doesn't conflict with HP sync.
