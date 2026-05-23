# 0004 — Static game data conventions

**Status**: Accepted
**Date**: 2026-05-23

## Context

The project has a clean split today between two storage layers:

- **`src/game/`** — pure TypeScript modules: monster definitions, item templates, modifier pools, class definitions, vendor catalog, world graph. Same code runs on client and server (Convex imports from here via relative paths).
- **`convex/`** — the database: characters, items, user roles. Player-mutable state and ownership trails.

The split is consistent across every domain that exists today, but the **rule** behind it isn't written anywhere. An agent picking up a new domain (skills, passive tree, stash, future vendor expansions) is left to infer the convention from precedents — fine for a senior reviewer, fragile under the project's reality of being built largely through prompt engineering with AI agents.

Three conventions hold uniformly across the codebase. This ADR codifies them so they survive the next domain.

## Decision

### Rule 1 — Static unless player-mutable

Game design data that is **fixed by the developer** (and changes only via code edits + a redeploy) lives in `src/game/`. Player-mutable state lives in `convex/schema.ts`.

Concretely:
- **In `src/game/`**: monster stats, item base templates, modifier pools, class definitions, vendor product catalog, world node graph + connections, drop tables, level-XP curves, formulas (damage, sell price, travel time).
- **In `convex/schema.ts`**: character documents (level, hp, rubys, attributes, location, travel state), items rolled at runtime (with their snapshot in `data`), user role rows.

The test: *can the player's actions change this row?* If yes, DB. If no, `src/game/`. An exception requires this ADR to be amended.

### Rule 2 — Convex stores the id; `src/game/` owns the definition

When a DB row needs to reference static game data, it stores the **id as a string** and resolves it at use time via a safe lookup helper:

| DB field | Helper | Lookup target |
|---|---|---|
| `characters.classId` | `findClassDefinition(id)` | `CLASS_DEFINITIONS` |
| `characters.currentLocation`, `unlockedNodes[]`, `completedZones[]` | `findNode(ACT_1, id)` | `ACT_1.nodes` |
| `items.data.templateId` | `TEMPLATE_BY_ID.get(id)` | `EQUIPMENT_TEMPLATES` |
| `items.droppedFrom` | `findMonster(id)` | `MONSTERS` |
| `vendorBuy.productId` | `findVendorProduct(id)` | `VENDOR_PRODUCTS` |
| equipped weapon (starter) | `findStarterItem(id)` | `STARTER_ITEMS` |

Each helper returns `null` (or throws on the mutation path) when the id is unknown — never crashes, never silently corrupts. The convention is:

- **String ids in DB schemas** (not enums, not literal unions) — Convex validators don't ergonomically express the literal-union shape these ids use in TypeScript. The widening to `string` at the persistence boundary is intentional; ADR [0003](./0003-render-at-display-names.md) covers the same trade-off for `nameBase` / `nameModifier`.
- **Every mutation that accepts a static-data id as an argument must validate via the matching `findX()` helper before acting on it.** A `monsterId` arg that doesn't exist in `MONSTERS` is rejected with a `ConvexError`, not silently treated as a 0-XP kill.

If you add a new domain with its own static catalog, give it a `findX(id)` helper in the same file as the definition (`src/game/<domain>/data.ts`). Every consumer routes through that helper.

### Rule 3 — Denormalization is OK when the source of truth is immutable

Two fields in the current schema are deliberately denormalized:

- **`characters.equippedWeaponId: Id<"items">`** — cached pointer for fast paper-doll reads. The items table is the source of truth (`items` with `locationKind: "equipped"`), but querying it requires a secondary lookup; the cached pointer skips that. Schema comment documents the trade-off inline.
- **`items.data: generatedItemValidator`** — the entire item payload (templateId, rolled mods, computed stats) is a snapshot taken at generation time. The template + modifier definitions in `src/game/` are immutable per item lifetime; even if a future patch rebalances a template, the rolled item keeps its original numbers. No migration is needed because there is no shared mutable state being cached.

The convention: **denormalization is allowed when (a) the source of truth is immutable for the lifetime of the cache, or (b) the cached field has an inline comment explaining why caching is safe.** A denormalized field whose source can mutate without invalidating the cache is a bug.

This rule doesn't sanction caching arbitrarily. The two existing instances were deliberate and load-bearing; new denormalization should have the same character.

## Why these rules, written out

- **Rule 1** matches the conceptual model players expect (designer-tuned values; player-driven choices) to the storage that suits it (compile-time, type-checked, free; runtime, validated, paid). Putting class definitions in the DB would let an admin tweak them from a console — sounds flexible, but the cost is every consumer query joins the DB instead of importing a const, and a typo in a Convex dashboard edit ships to all players immediately with no PR review.
- **Rule 2** keeps the persistence layer honest about what it knows (an opaque string id) while letting the in-process type layer keep narrow types (`CharacterClassId = "warrior" | "mage" | "rogue"`). The widening is one-way (DB → string, in-process → narrow), so every mutation handler that reads a string id is **forced** to validate it via the helper before using it — the type system makes the unsafe path uncomfortable.
- **Rule 3** is a release valve, not a default. Without it, every read of "current weapon" would query the items table; that's correct but slow at the inventory open path. With it, fast reads are possible but every new instance is suspect — the inline comment is the gate that catches misuse.

## Consequences

- A new domain (skills, passives, stash items, etc.) follows the same shape automatically: definitions in `src/game/<domain>/data.ts` with a `findX(id)` helper; player-mutable state in `convex/schema.ts` as a new table or fields on `characters`; cross-references via string id.
- A future "skill levels" feature (per-character allocation of skill points) puts the *catalog of skills* in `src/game/skills/` and the *per-character allocation* in `convex/schema.ts` — the rule disambiguates without further discussion.
- Refactors that move data from `src/game/` to the DB (or vice versa) require amending this ADR, because they break the established mental model that every future agent will rely on.
- The audit that produced this ADR found zero drift today. Anything that introduces drift in the future is a regression: a string id in the DB without a corresponding `findX()` helper, a player-mutable field in `src/game/`, or a denormalized cache without the inline-comment gate.

## Related

- ADR [0001 — Optimistic mutations](./0001-optimistic-mutations.md) — performance contract for player-state changes (orthogonal to this ADR but uses the same `src/game/` helpers from the client side).
- ADR [0003 — Render-at-display naming](./0003-render-at-display-names.md) — covers the literal-union widening trade-off at the Convex boundary for `nameBase` / `nameModifier`.
- The stub playbooks for queued domains ([`adding-a-skill.md`](../playbooks/adding-a-skill.md), [`adding-a-passive.md`](../playbooks/adding-a-passive.md), [`adding-a-stash-tab.md`](../playbooks/adding-a-stash-tab.md)) flag the schema design questions each new system needs to resolve under this ADR's rules.
