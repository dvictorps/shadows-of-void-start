# Adding a skill (stub — system not yet implemented)

> **Status**: orientation doc only. The active-skill system doesn't exist yet. See `docs/plans/in-progress.md` → "Future: passive tree + active skills" for the queue position.
>
> **When you pick this up**: fill in the steps as you build the system, treat the questions below as the design surface to resolve before writing code, and turn the ADR-worthy decisions into actual ADRs as they crystallize.

A skill is an active player ability (think PoE skill gem or D2 skill tree pick): a named action with its own damage formula, cost, cooldown, and integration with the stat engine. Skills are layered **on top of** the passive tree (see [`adding-a-passive.md`](./adding-a-passive.md)) — the passive tree lands first.

## Decide first

Before coding, resolve these:

1. **Where does skill data live?**
   - Precedent: `src/game/monsters/data.ts` defines mob templates; `src/game/items/data/modifiers/*.ts` defines mod pools per category. A symmetric shape for skills would be `src/game/skills/data.ts` (or one file per element / archetype if the pool grows large).
   - Open question: do skills belong to classes, or are they class-agnostic with class-flavored synergies? CONTEXT.md → Classes implies the latter ("Passive tree is added (shared system, class branches into it). Active skills per class are added on top.") — so per-class skill lists, but the underlying skill data is shared.

2. **How does a skill plug into the stat engine?**
   - The stat engine (`src/game/stats/compute.ts`) currently produces a `swings` array per character. A skill replaces or augments that array per-cast. The cleanest shape is probably a `computeSkillSwing(skill, character)` pure function returning the same `SwingProfile` shape `rollPlayerSwing` already consumes — keeps the combat hook ignorant of skill-vs-attack distinctions.
   - Open question: how do `more` multipliers (currently unused — see CLAUDE.md "Design Decisions") enter the pipeline? Skills are the natural carrier. Document the formula change in an ADR.

3. **How does the combat hook fire a skill?**
   - The combat loop (`src/hooks/useCombatLoop.ts`) currently advances `playerProgress` per tick and fires the auto-attack at `>= 1`. Skills need either (a) a separate progress/cooldown channel, or (b) a queued cast that interrupts the auto-attack rotation. See [`touching-combat.md`](./touching-combat.md) for the trap list before touching the hook.

4. **What's the player input model?**
   - The game is "automatic / stat-check combat" per CLAUDE.md. Skills could be (a) entirely auto-queued (UI shows which skill is up next), (b) hotkey-fired with cooldown gating, or (c) toggled passives. Decide before scoping UI.

5. **i18n strategy**
   - Skill names + descriptions are static UI labels (one name per skill, no gender concord) → paraglide. Skill mod tooltip lines (if skills roll modifiers) → mirror the item modifier tooltip pattern. See [`i18n-which-system.md`](./i18n-which-system.md).

## Precedents to learn from

- **`src/game/monsters/data.ts`** — closed Record keyed by id, with a derived literal-union type. Same shape works for skills.
- **`src/game/items/data/modifiers/index.ts`** — multi-file aggregation pattern. Use it if skills grow past ~30 entries.
- **`src/game/stats/compute.ts`** — pure function that returns a typed result. Skill effect resolution should follow the same shape (input character state → output swing profile).
- **`src/game/items/generator.ts`** — how a domain composes pure data + RNG into an output. Skill instantiation (when leveled / when imbued) can mirror this.

## ADR-worthy decisions to capture as you go

- Where skill data lives + why (single file vs per-element).
- How skills compose with the stat engine (separate swing path vs unified `SwingProfile`).
- The cast trigger model (auto / hotkey / toggle).
- Whether the `more` modifier type (already in the type system, unused today) becomes load-bearing for skills.

## Validation when the system lands

```bash
npx tsc --noEmit
npx vitest run src/game/skills/
npx vitest run src/game/stats/    # stat engine must still pass with skill inputs
npx vitest run src/hooks/         # if you added combat hook tests
npx biome check src/
```

Then `npm run dev`: cast the skill in combat, verify damage matches the formula, kill a mob, take damage, die, respawn — touch every state machine transition skills participate in.
