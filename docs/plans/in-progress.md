# In-progress work

Decisions made but not yet executed. Read this before starting a session — if your task overlaps with something here, you may be duplicating planned work or causing conflicts.

When a planned item starts, move it to a feature branch and reference back here. When it ships, delete the entry (closed work belongs in commit history, not this file).

---

## Split `convex/characters.ts` into domain modules

**Status**: Planned, not started.
**Branch**: not yet created. Will be `refactor/split-characters-mutations` from master.
**Owner**: next agent picking this up.

### Why

`convex/characters.ts` is ~770 lines today, holding three unrelated domains:

1. Character CRUD + base state (list, byId, create, remove, normalize helpers)
2. Item lifecycle (equip, unequip, reorder, pickFromBag, discardFromBag, exitZone, zone bag queries, equipped/inventory queries)
3. Combat / progression (recordKill, syncHp, usePotion, respawnDead, enterZone, enterCity)

As skills, stash, vendor, and trade land, the file will hit 1500+ lines with overlapping concerns. The shared helpers (`loadOwnedCharacter`, `fetchInventoryAllocator`, `deleteZoneBag`, `narrowEquippedSlot`) make a split easy.

### Planned split

| New file | Houses |
|---|---|
| `convex/characters.ts` (kept) | `list`, `byId`, `create`, `remove`, `normalize` (private helper) — pure CRUD + roster |
| `convex/items.ts` | `equipItem`, `unequipItem`, `reorderInventory`, `pickFromBag`, `discardFromBag`, `exitZone`, plus the queries `zoneBag`, `inventory`, `equipped`. Items table is the natural home for the bag mutations even though they touch `currentZoneSession` as a side effect |
| `convex/combat.ts` | `enterZone`, `enterCity`, `recordKill`, `syncHp`, `usePotion`, `respawnDead`. The "what's happening in combat / what zone am I in" mutations |
| `convex/_shared/character.ts` (new) | `loadOwnedCharacter`, `fetchInventoryAllocator`, `deleteZoneBag`, `newZoneSession`, `EQUIPPED_SLOT_LITERALS`/`equippedSlotValidator`. Private helpers re-exported here so all three modules import without circular references |

### Client impact

Every `api.characters.X` call site updates. There are ~30 across:

- `src/routes/world.tsx` (most concentrated)
- `src/components/world/InventoryModal.tsx`
- `src/components/CreateCharacterModal.tsx`
- `src/routes/character-select.tsx`

Pattern: `api.characters.equipItem` → `api.items.equipItem`, `api.characters.recordKill` → `api.combat.recordKill`, etc. Mechanical change — TS errors will surface every site.

### What NOT to touch in this refactor

- **Mutation logic** — no behavior changes. Pure code move + import rewrites.
- **Schema** — `convex/schema.ts` stays untouched. The split is presentation only.
- **Tests** — no test file imports convex modules directly (they import from `src/game/items/equipment.ts` etc, which is shared). Should be no test changes.
- **i18n keys** — error strings thrown by mutations stay verbatim so `translateServerError` keeps matching.

### Validation

```bash
npx tsc --noEmit
npx convex dev --once    # one-shot deploy check
npx vitest run
npx biome check src/ convex/
```

Then a smoke test: create character, kill a mob, retreat, equip something. If any of those fail, the issue is almost certainly a missed call site.

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
