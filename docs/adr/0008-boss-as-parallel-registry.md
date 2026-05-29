# 0008 — Bosses as a parallel registry, not extensions of `MonsterDefinition`

**Status**: Accepted
**Date**: 2026-05-25

## Context

Act 1 ships with its first boss — Gralfor, O Persistente — and the design calls for every act-boss-class enemy to have:

1. **Handcrafted stats** declared on the boss's template (HP, attack speed, per-element damage, **resistances including vulnerabilities** like `cold: -25`). Bosses don't roll mods from `MONSTER_MODIFIERS` — those affixes are a rare-rarity feature.
2. **A configurable cinematic** that plays before engagement: sprite fade-in → entry sfx + screenshake (impact beat) → nameplate reveal → HP bar → engaged. Each boss tunes timings, the sfx file, screenshake amplitude, and its own nameplate color.
3. **A dedicated node type** (`kind: "boss"`) that runs a gauntlet — N rare fights from a per-node monster pool, then the boss — instead of the time bar that regular zones use.

The shared infrastructure (combat tick, scaling, drops) was built for the existing `MonsterDefinition` shape. The question: where do bosses live?

Three options were on the table.

### (A) New `src/game/bosses/` folder with its own registry

Each boss is a file (`gralfor.ts`) exporting a `BossConfig` that embeds the template (a `MonsterDefinition`-shaped stat sheet) plus cinematic config and nameplate styling. `BOSSES: Record<BossId, BossConfig>` lives in `data.ts`. Combat callers use `findBoss(id)` parallel to `findMonster(id)`.

### (B) Bosses live in `MONSTERS` (as ordinary `MonsterDefinition`s), cinematic config lives in a side registry

Gralfor is a `MonsterId` like any other mob. A separate `BOSS_CONFIGS: Record<MonsterId, BossExtras>` decorates the few mobs that are bosses with their cinematic + color. Combat code keeps using `findMonster(id)` everywhere; boss-specific code does a second lookup in `BOSS_CONFIGS`.

### (C) `MonsterDefinition` grows an optional `boss?: BossExtras` field

One registry, one lookup, but `MonsterDefinition` becomes polymorphic and any code that needs to differentiate "is this a boss?" pattern-matches on `def.boss != null`. Type guards spread.

## Decision

**(A) — parallel registry.** Bosses live under `src/game/bosses/`, one file per boss, with their own `BOSSES` registry and a `findBoss(id)` helper. The runtime `Enemy.rarity` carries `"unique"` (a fourth `MonsterRarity` tier added for this purpose) so downstream code (drop tables, UI paths, tooltip renderer) can branch on rarity directly without reaching back into the registry to ask "is this a boss?".

## Why not (B)

Putting Gralfor in `MONSTERS` invites two long-term problems:

1. **`monsterPool` declarations would need to ignore him.** Every regular zone declares its `monsterPool: MonsterId[]` and the spawn roller picks uniformly. If `gralfor` is in the `MonsterId` union, every reviewer has to remember not to put him in a regular pool — and the type system can't help, because `MonsterId` is one big literal union. The first agent who legitimately wants to add Gralfor to a "boss-themed mini-zone" pool can do it without noticing they've broken the act-1 boss's exclusivity.
2. **`MONSTERS` becomes a mixed-purpose registry.** It's currently "things the regular zone roller picks from." Adding entries that are *not* zone-rollable conflates two concerns. Future agents reading `MONSTERS.gralfor` need a comment to know it's special — and comments rot.

Two lookups in two places is the smaller cost. The lookups are explicit and the type system enforces who can spawn through which path.

## Why not (C)

Optional fields are contagious. The moment `MonsterDefinition.boss?` exists, every consumer that *might* care about boss-ness either:

- handles the optional and the type guard noise spreads everywhere, or
- ignores it and silently mis-handles bosses (e.g., the rare-name lexicon renderer trying to compose `"<adjective> <Gralfor's first-word>"`).

The parallel-registry version makes "boss" a first-class category — code that handles uniques is gated on `rarity === "unique"`, which the compiler verifies. The `findBoss(id)` lookup happens at the boundary, not threaded through every consumer.

## Trade-off accepted

The parallel registry pays a one-time cost: combat code that needs the boss's cinematic config (CombatScene for screenshake/sfx, MonsterTooltip for nameplate color, sfx.ts for death sfx routing) does a second lookup via `findBoss(enemy.def.id as BossId)`. That's one extra map read per boss-related render — measurably nothing.

The benefit: the boss surface is explicit at the call site (the `as BossId` cast signals "we're crossing into boss-land"), uniques never accidentally route through rare-only code paths, and adding a new boss is one file under `src/game/bosses/` + one paraglide key per locale, no `MONSTERS` edit.

## Supersedes

**Model B** for the act-boss node (CONTEXT.md → Act Boss, prior version) is removed by this decision. The deferred "Act-boss Model B refit for time-bar" entry in `docs/plans/in-progress.md` is closed: the gauntlet pattern this ADR introduces handles the design question Model B's refit was meant to answer (how to express "Bar 1 → miniboss → Bar 2 → boss" in the time-based-zone world). The answer is: don't — boss nodes use a configured fight sequence, not bars.

## Consequences for adding a new boss

The playbook (`docs/playbooks/adding-a-boss.md`) covers the full recipe. In short:

1. New file under `src/game/bosses/<bossId>.ts` exporting a `BossConfig`.
2. Register in `BOSSES` (`src/game/bosses/data.ts`).
3. Add the boss's name key to `messages/{en,pt}.json` and re-compile paraglide.
4. Add the `kind: "boss"` node to the act's data with a `bossNode` config pointing at the boss id.
5. Drop the boss's sprite into `public/assets/sprites/bosses/` and the entry/death sfx into `public/assets/sounds/sfx/bosses/`.

No combat-engine changes are required to add a second boss — the parallel registry is the extension point.

## Convention: `rarity: "unique"` is the visible signal

Code that needs to distinguish bosses from rares does so by reading `enemy.rarity === "unique"`. The `Enemy.def` shape stays uniform (BossTemplate is a `MonsterDefinition`), so the combat tick and scaling don't branch — only presentation code (tooltip, nameplate color, intro stage cascade) and reward routing (drops, recordKill) care about the distinction.

If a future feature lets *items* be unique (per the convention noted in CONTEXT.md → Boss), they reuse `ItemRarity = "...|unique"` the same way — the rarity-tier infrastructure already exists.
