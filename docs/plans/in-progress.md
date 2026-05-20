# In-progress work

Decisions made but not yet executed. Read this before starting a session — if your task overlaps with something here, you may be duplicating planned work or causing conflicts.

When a planned item starts, move it to a feature branch and reference back here. When it ships, delete the entry (closed work belongs in commit history, not this file).

---

## Add Tome and Quiver as new off-hand types (MAX PRIORITY)

**Status**: Planned, not started. **Top of the queue** — next PR after `feat/new-assets`.
**Branch**: not yet created. Suggested `feat/tome-and-quiver`.
**Owner**: next agent picking this up.

### Why

The `feat/new-assets` branch added two sprites (`tomoMagico`, `aljava`) that don't have corresponding template types yet. They sit unused in `public/assets/sprites/escudos-offhands/` until this PR lands. The intent is to add real gameplay for them, not just visual coverage.

### Scope

Two new off-hand categories alongside the existing **shield** and **off-hand-weapon (dual-wield)**:

**Tome** — caster off-hand.
- Silk-base off-hand.
- **No block chance** (the only off-hand category that doesn't roll block).
- Mod pool: barrier (local defense), `+% Spell Damage`, cast speed %, flat spell damage to spells? (TBD — grill), mana, resistances, attributes (int-leaning).
- Equippable by anyone (no main-hand restriction). Stacks on top of staff/wand swings as a stat slot, doesn't itself cast.

**Quiver** — bow-bound off-hand.
- New `equipmentType: "quiver"` (or stays under `offhand` with a discriminator — grill).
- **Equip restriction**: main hand must hold a `bow`. Drag-and-drop / dropdown surface the restriction the same way the same-archetype rule already does.
- **Inverts the existing 2H-blocks-offhand rule for bows** — see Conflict 1 below.
- Mod pool: flat phys/elemental damage to attacks, attack speed %, crit chance %, accuracy, attributes (dex-leaning). TBD.

### Conflicts with current CONTEXT.md to resolve

1. **Off-hand identity expands.** Today's `## Equipment Slots → Off-hand` (and `## Weapon Types`) treat off-hand as shield-or-weapon. Need to extend the section to enumerate four contents: shield · off-hand weapon (dual-wield) · tome · quiver.

2. **Bow ceases to be a pure 2H blocker.** The current invariant says "Two-handed weapons (greatsword, twoHandedAxe, bow, staff) occupy main hand and block the off-hand slot." Bow becomes an exception: 2H, blocks off-hand **for shields/weapons/tomes**, but accepts a **quiver**. Mirror PoE1.

3. **`planEquip` / `validSlotsForItem` / `equipItem`** in `src/game/items/equipment.ts` (and tests) need a new branch for quiver: reject unless `mainHand?.weaponType === "bow"`; reject equipping a non-quiver off-hand while a bow is in main hand; auto-unequip the quiver if the player swaps the bow for any other main-hand.

4. **Same-archetype dual-wield rule unaffected.** Tome and quiver aren't weapons — they don't enter the archetype check.

### Required design decisions before coding

- Exact mod pool for tome and quiver (which modifiers in `data/modifiers/` apply, with what weights).
- Tier ladder (mirror the 21-tier `_t1..t21` cadence used by existing offhand bases).
- Whether quiver is its own `EquipmentType` or a flag on `offhand` (impacts drop pool and `applicableTo` arrays).
- Tooltip: how to render "Requires Bow in main hand" cleanly.
- Drop pool: today the loot roller picks uniformly across 9 equipment types (CONTEXT.md → Loot Pipeline → Drop pool). Adding tome/quiver changes the denominator — confirm distribution.

### Sprites already in place

- `/assets/sprites/escudos-offhands/tomoMagico.png`
- `/assets/sprites/escudos-offhands/aljava.png`

Both ready to be assigned to the new templates via the `icon` field added in `feat/new-assets`.

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
