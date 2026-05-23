# 0003 — Render-at-display naming for items and monsters

**Status**: Accepted
**Date**: 2026-05-23

## Context

Items and monsters both carry **composed display names** that depend on the active locale and on per-instance data:

- **Items** — a magic Iron Sword with rolled `Hallowed` prefix renders `Hallowed Iron Sword` (EN) or `Espada de Ferro Sagrada` (PT, with the adjective inflected to the base's feminine gender). A rare item picks a two-word proper name from the locale's rare pools (`Stonemaw Reaver` / `Garra de Aço, o Furioso`).
- **Monsters** — a magic Goblin with `monsterIncreasedDamage` renders `Damaged Goblin` (EN-ish placeholder) / `Goblin Danificado` (PT, with gender concord). A rare monster gets a UUID-seeded compound name + epithet (`Stonemaw, the Furious` / `Garra de Aço, o Furioso`).

A naive design would **cache** the rendered name on the database row at roll time. PR #39/#41 (the lexicon work) deliberately chose the opposite — names are *not* stored; the renderer derives them at every render from the data the row already carries.

## Decision

**Display names are rendered at display time**, every time, from per-instance fields the row already carries:

- For items: `templateId`, `nameBase`, `nameModifier`, `explicits[]` (prefixes/suffixes contribute to the magic compound name), `item.id` (UUID seed for rare proper names).
- For monsters: `monsterId`, `mods[]`, `rarity`, `nameSeed` (three uniform floats held per spawn for rare proper-name picks).

The renderers (`translateItemName` in `src/game/items/item-name.ts`, `translateMonsterName` / `translateEnemyName` in `src/game/world/i18n.ts`) read the active locale from paraglide's runtime, look up the matching lexicon, and compose. Same data + same locale = same string. Same data + different locale = different string, no migration needed.

## Why not store the rendered name

### Locale switch breaks instantly

The player toggles PT ↔ EN in Settings. If names were stored at roll time, every item in inventory + stash + zone bag would show in the locale they were *rolled* in until re-rolled or migrated. Either you re-render lazily on locale switch (defeats the cache — the renderer has to run anyway) or you walk every stored row and re-translate (write storm, race conditions during the walk, and the bestiary-style "I killed this rare two patches ago" cases break entirely).

Render-at-display has no cache-invalidation problem because there is no cache.

### Proper-name pools change

Every patch that adds a new rare adjective or rare noun to the lexicon pool shifts the modulo math by which `hashItemId(item.id)` picks a slot. With render-at-display, the same item gets a new name post-patch — annoying for the player, but the system is honest about it (and the pool is mature enough that this is rare).

With *stored* names, the system is consistent until you rebalance the pool — at which point you either accept that newly-rolled items use the new pool (silently divergent from old rows) or you migrate the whole table.

### The shape is small

The cost of re-rendering at display time is a few lookups + a string concat per item card. Item cards aren't re-rendered hundreds of times per second; the inventory grid is 60 cells max, and tooltips are one-at-a-time on hover. No measurable performance ceiling justifies the storage shape's cost.

## Why UUID-seeded proper names instead of a stored seed

Items have a stable `id` (UUID) for their entire lifetime — it's the trade / audit / leaderboard primitive (see CONTEXT.md → Loot Pipeline: "Item IDs are stable across every transition"). That id is **already** durable per-row. Using it as the hash input for the rare-name pick means no new column, no migration, no schema change.

`hashItemId` (in `item-name.ts`) does two FNV-1a walks over the id (forward + reverse) to produce two independent `[0, 1)` floats — one indexes the first-word pool, the other indexes the second-word pool. Two independent walks decouple the indices so pool sizes that share factors don't collapse onto the same slot.

Monsters use a slightly different shape (three uniform floats in `RareNameSeed` per spawn) because monsters don't have a stable id at spawn — each spawn is fresh, and the seed gets generated alongside the spawn. The same principle applies: re-rendering the same spawn (re-rendering across a locale switch, or across a tick re-render) reads the same seed and produces the same name.

## The Convex-validator widening

`GeneratedItem.nameBase` and `nameModifier` are typed as the closed literal unions `TemplateBaseId` and `TemplateModifierId` (or `null`) inside `src/game/items/`. They are *also* persisted to the Convex `items.data` column, validated by `convex/itemValidator.ts`.

Convex validators do not have an ergonomic helper for literal-union enforcement — `v.union(v.literal("sword"), v.literal("blade"), ...)` works for short unions but becomes untenable at ~55 bases + ~80 modifiers. The pragmatic choice is `v.optional(v.string())`, accepting that the **persistence boundary widens** to `string` while the in-process type stays narrow.

Consequence: a roll path that produces a typo in `nameBase` ("swords" instead of "sword") would pass the validator and fail at lexicon lookup (renderer returns `templateId` fallback). Mitigation:

- The generator never produces `nameBase` / `nameModifier` from user input — they come from `EquipmentTemplate.nameBase` / `nameModifier`, which *are* typed as the narrow union. The Convex validator's permissiveness only matters for hand-crafted data (admin overrides, dev seeds).
- The lexicon `Record<TemplateBaseId, ...>` interface enforces total coverage at compile time — any new id must appear in both lexicons before the templates that use it will compile.

If Convex ever ships a `v.unionLiteral([...]: readonly string[])` helper, swap in.

## Consequences

- The "render once, store" optimization is **forbidden** without amending this ADR. An agent who "improves performance" by pre-rendering names silently breaks locale switching.
- Adding a locale is one new lexicon file + the matching paraglide JSON. No data migration. No backfill.
- A new template id (or monster id) requires lexicon coverage in *both* locales — the typed Records make missing entries a compile error.
- The bestiary feature parked in `docs/plans/in-progress.md` (Future: rare-name bestiary) gets the locale-switch property for free: the bestiary row stores the spawn seed, not the rendered name, so re-opening the bestiary in a different locale shows the names in the active language.

## Related

- ADR [0002 — i18n systems](./0002-i18n-systems.md) explains *why* the lexicon system exists alongside paraglide.
- Playbook [`i18n-which-system.md`](../playbooks/i18n-which-system.md) is the decision tree for new strings.
- The `mod.description` field on `RolledMod` (and the `templateName` / `name` legacy fields on `GeneratedItem`) are pre-render artifacts retained for back-compat with rows from before the refactor. New rolls omit them. See `convex/itemValidator.ts` field-level comments.
