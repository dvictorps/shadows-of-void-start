# Codebase Map

A fast tour for an agent dropped into this repo. Points to where each domain lives so you can grep with intent instead of with hope.

For game design rules (what stats mean, what's allowed where, why), read [CONTEXT.md](../CONTEXT.md). For project guidelines (tech stack, item generator architecture), read [CLAUDE.md](../CLAUDE.md). For task recipes ("how do I add a modifier?"), read [docs/playbooks/](./playbooks/).

---

## Top-level layout

```
/
├── CLAUDE.md               # Project guidelines + item-system architecture
├── CONTEXT.md              # Domain glossary (single source of truth for rules)
├── docs/
│   ├── codebase-map.md     # ← you are here
│   ├── playbooks/          # Task recipes (add modifier, add monster, etc)
│   ├── plans/              # Roadmap + in-progress work
│   ├── security/           # Threat model + deferred anti-cheat plan
│   └── adr/                # Architecture decisions
├── convex/                 # Server (mutations, queries, schema)
├── messages/               # Paraglide i18n source (pt.json, en.json)
├── project.inlang/         # Paraglide config
├── src/
│   ├── game/               # Pure game data + rules (no React, no Convex)
│   ├── components/         # React components
│   ├── routes/             # TanStack file-based routes
│   ├── hooks/              # React hooks
│   ├── lib/                # Small utilities
│   ├── paraglide/          # Generated i18n bindings (don't hand-edit)
│   └── styles.css          # Global CSS + keyframes
└── biome.json, vite.config.ts, package.json
```

---

## `src/game/` — pure domain layer

No React. No Convex. Same code runs on client and server (convex imports from here directly with relative paths). Pure functions, structured data, deterministic.

| Directory | What lives there | Key files |
|---|---|---|
| `classes/` | Character class definitions (Warrior/Rogue/Mage) | `data.ts` (CLASS_DEFINITIONS), `types.ts` |
| `combat/` | Damage/defense math, constants | `damage.ts`, `barrier.ts`, `leech.ts`, `constants.ts` |
| `inventory/` | Inventory constants + helpers | `constants.ts` (INVENTORY_MAX_SLOTS, bySlotAsc) |
| `items/` | Item generator, modifier data, equip helpers | See below — the biggest subdir |
| `loot/` | Drop tables | `drops.ts` (rollDrop, rollMonsterLevel) |
| `monsters/` | Monster definitions | `data.ts`, `types.ts` |
| `progression/` | XP curves, death penalty | `levels.ts` (xpToNextLevel, applyXpGain, applyDeathXpPenalty) |
| `stats/` | The stat engine | `compute.ts` (computeCharacterStats), `types.ts` (EquippedSlot, narrowEquippedSlot, ComputedCharacterStats) |
| `world/` | Acts, zones, node graph, zone-name i18n | `act-1.ts`, `index.ts`, `types.ts`, `i18n.ts` |

### `src/game/items/` — item subsystem detail

```
items/
├── generator.ts             # generateItem({ rarity, ilvl, type, weaponType }) — public API
├── generator.test.ts        # 70+ tests covering rarity/tier/mod rules
├── equipment.ts             # planEquip, validSlotsForItem, isTwoHanded, weaponArchetype — shared client+server
├── equipment.test.ts        # planEquip rules (2H displacement, archetype, etc.)
├── starter-gear.ts          # Hand-crafted starter weapons (rusty_sword, rusty_dagger, cracked_wand)
├── mod-i18n.ts              # PT formatters for explicit mods + implicit pattern-match
├── MODIFIER_GUIDELINES.md   # Notes on individual modifier semantics (crit, leech)
├── data/
│   ├── modifiers/           # One file per category — defines the modifier pool
│   │   ├── index.ts         # Aggregates everything into MODIFIERS + ModifierId type
│   │   ├── weapon-damage.ts # Local attack mods
│   │   ├── spell-damage.ts  # Flat spell damage (staff/wand only)
│   │   ├── global-damage.ts # Global %, attack/cast speed, global crit
│   │   ├── defense.ts       # Local/global defense, life/mana, regen, thorns, block
│   │   ├── resistances.ts
│   │   ├── attributes.ts
│   │   ├── utility.ts       # Movement speed, leech, stun, reduced reqs
│   │   └── magic-find.ts
│   └── templates/           # Equipment base templates, one file per slot/weapon type
│       ├── swords.ts, daggers.ts, axes.ts, ...  (one per weapon type)
│       ├── helmets.ts, chestplates.ts, boots.ts, gloves.ts
│       ├── shields.ts
│       └── rings.ts, amulets.ts, belts.ts
└── types/
    ├── base.ts              # EquipmentType, WeaponType, ArmorType, BaseStatKey, EQUIPMENT_GROUPS
    ├── mods.ts              # Modifier, RolledMod, StatEffect, ModifierTier
    ├── item.ts              # GeneratedItem (the thing stored in the items table)
    └── index.ts
```

### `src/game/stats/compute.ts` — the stat engine

The spine of every gameplay calculation. Read this if you're touching anything that reads character stats. Pure function, fixed-point cascade for broken-state detection, applies a single switch per modifier id.

---

## `convex/` — server (Convex backend)

| File | Concern |
|---|---|
| `schema.ts` | Database tables: `characters`, `items`, `userRoles`. Indexes by `authUserId`, `characterId+locationKind`, `zoneSession`, `stash` |
| `characters.ts` | **Kitchen sink — pending split.** Currently houses character CRUD, equip/unequip, zoneBag mutations, recordKill, syncHp, respawnDead. See [`docs/plans/in-progress.md`](./plans/in-progress.md) for the split plan |
| `itemValidator.ts` | Convex validator for the `GeneratedItem` shape in `items.data` |
| `auth.ts`, `auth.config.ts`, `users.ts` | better-auth integration + user role queries |
| `http.ts` | Auth callback routes |

Convex imports from `src/game/*` use **relative paths** (`../src/game/...`), not the `#/` alias — that's a Convex bundler quirk. Don't mix.

---

## `src/components/` — UI

| File / dir | Role |
|---|---|
| `Modal.tsx` | Generic modal shell (dismissible flag, ESC handling) |
| `Toaster.tsx` | Sonner wrapper — styled with Jersey 25 + uppercase tracking |
| `Footer.tsx`, `Header.tsx` | Page chrome (only on splash) |
| `CreateCharacterModal.tsx` | Used by character-select |
| `ConfirmationModal.tsx` | Generic confirm dialog (used via `useConfirmationModal`) |
| `game/ItemCard.tsx` | Shared item visual — rarity glow, broken state badge, tooltip portal |
| `game/ItemTooltip.tsx` | The big tooltip — name, header stats, defenses, implicits, explicits |
| `world/` | Everything inside the `/world` route |
| `ui/` | Radix-ui-based primitives (Button, Input, Label, Select, etc) |

### `src/components/world/` — world view internals

| File | Role |
|---|---|
| `MapScene.tsx` | Act DAG rendering, hoverable nodes |
| `CombatScene.tsx` | Enemy display, HP bars, **floating damage popups** (framer-motion) |
| `CityScene.tsx` | City hub placeholder |
| `EquipmentPanel.tsx` | Right-side paper doll (always-visible) |
| `StatusCard.tsx` | Right-side stat readout + Show button + potion + HP globe |
| `HealthGlobe.tsx` | Animated HP/barrier orb |
| `TextLog.tsx` | Status line (priority chain: death → +XP → low HP → zone name) |
| `InventoryModal.tsx` | The big one — drag-drop equip, click dropdown, 60-slot grid |
| `ItemContextMenu.tsx` | Popover menu for click-to-equip |
| `BagPreviewModal.tsx` | Read-only loot bag during combat |
| `ExitZoneModal.tsx` | Post-retreat loot picker (5 buttons, selection grid) |
| `ShowStatsModal.tsx` | Full character sheet (4 sections, PoE-style) |
| `SettingsModal.tsx` | Language dropdown |
| `InventoryButton.tsx` | Backpack icon button on EquipmentPanel |

---

## `src/routes/` — TanStack file-based routes

| Route | Concern |
|---|---|
| `__root.tsx` | Layout shell + Toaster + ConfirmationProvider |
| `index.tsx` | Splash screen ("Shadows of Void" title) |
| `sign-in.tsx` | better-auth UI |
| `character-select.tsx` | Roster + create modal + play button + delete confirm |
| `world.tsx` | **Orchestrator** — combat hook, all modals, optimistic mutations, priority TextLog. Mid-size file (~470 lines) |
| `admin.tsx`, `admin/items.tsx` | Admin dashboard (only admins see) |
| `api/auth/$.ts` | better-auth fallback route |

---

## `src/hooks/` — React hooks

| Hook | Purpose |
|---|---|
| `useCombatLoop.ts` | Tick orchestrator (50ms intervals, refs for sync state, search/engaged/victory state machine) |
| `useCachedQuery.ts` | localStorage-backed wrapper around `useQuery` (cache version-tagged) |
| `useConfirmationModal.tsx` | Promise-returning confirm() — works because of the ConfirmationProvider in `__root.tsx` |
| `useModal.ts` | Open/close state for a single modal |
| `useDamageEvents.ts` | Floating damage queue (timed cleanup, used by CombatScene) |
| `useDelay.ts` | One-shot setTimeout wrapped |
| `useTicker.ts` | Repeating setInterval wrapped |

---

## `src/lib/` — small utilities

| File | Purpose |
|---|---|
| `convex-errors.ts` | `convexErrorMessage(err, fallback)` — translates known server errors to PT via `translateServerError` |
| `rng.ts` | `randInt`, `pickRandom`, `pickWeighted` — used by generator + monster rolls |
| `utils.ts` | `cn()` for classname merging |
| `flash-toast.ts` | One-shot toast helper |
| `auth-client.ts`, `auth-server.ts` | better-auth integration |

---

## `messages/` and `src/paraglide/`

- **`messages/pt.json`** + **`messages/en.json`** are the source — edit these, paraglide regenerates `src/paraglide/messages.js` on the next dev run.
- Import with `import { m } from "#/paraglide/messages"`. Call as `m.key_name({ param })`.
- Strategy: localStorage → preferredLanguage → baseLocale (pt). No URL prefix.
- `src/paraglide/` is generated — don't hand-edit. `biome.json` excludes the directory from lint/format so it never appears in diffs.

---

## Where to look when you ask…

| Question | Start here |
|---|---|
| "How does crit work?" | `CONTEXT.md` → Combat Resolution → Damage formula. Code: `src/game/combat/damage.ts:rollPlayerSwing` |
| "How do I add a new modifier?" | `docs/playbooks/adding-a-modifier.md` |
| "Why does the inventory feel snappy?" | `docs/adr/0001-optimistic-mutations.md` |
| "Where are the rules for what rolls on a belt?" | `CONTEXT.md` → Equipment Slots → Belt |
| "What's an EquippedSlot?" | `src/game/stats/types.ts:EQUIPPED_SLOTS` + `narrowEquippedSlot` |
| "Why is `convex/characters.ts` so big?" | `docs/plans/in-progress.md` — split is queued |
| "What does the stat engine actually do?" | `src/game/stats/compute.ts` + tests in `compute.test.ts` |
| "How does dual-wield work?" | `CONTEXT.md` → Dual-wielding |
| "Why doesn't this Convex error look like English?" | `src/lib/convex-errors.ts:translateServerError` |
| "How are items shown in the tooltip translated?" | `src/game/items/mod-i18n.ts` |
