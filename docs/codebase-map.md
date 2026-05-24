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
| `classes/` | Character class definitions (Warrior/Rogue/Mage) | `data.ts` (CLASS_DEFINITIONS), `types.ts`, `i18n.ts` (`getClassDisplayName`) |
| `combat/` | Damage/defense math, constants | `damage.ts`, `barrier.ts`, `leech.ts`, `constants.ts` |
| `i18n/` | Naming-lexicon primitives shared by all locales | `lexicon-shared.ts` (`GrammaticalGender`, `GenderedForm`, `pickGendered`) |
| `inventory/` | Inventory constants + helpers | `constants.ts` (INVENTORY_MAX_SLOTS, bySlotAsc) |
| `items/` | Item generator, modifier data, equip helpers, lexicon | See below — the biggest subdir |
| `loot/` | Drop tables | `drops.ts` (rollDrop, rollMonsterLevel) |
| `monsters/` | Monster definitions, modifier pool, instance-level scaler | `data.ts`, `types.ts`, `modifiers.ts` (pool + roll), `scaling.ts` (geometric 1.06^L) |
| `progression/` | XP curves, death penalty | `levels.ts` (xpToNextLevel, applyXpGain, applyDeathXpPenalty) |
| `stats/` | The stat engine | `compute.ts` (computeCharacterStats), `types.ts` (EquippedSlot, narrowEquippedSlot, ComputedCharacterStats) |
| `vendor/` | Vendor catalog data | `products.ts` (`VENDOR_PRODUCTS`, `VendorProductId`) |
| `world/` | Acts, zones, node graph, zone-name i18n, monster-name lexicon, travel + encounter-schedule helpers | `act-1.ts`, `index.ts`, `types.ts`, `i18n.ts`, `travel.ts`, `encounter-schedule.ts`, `lexicon/{en,pt,types}.ts` |

### `src/game/items/` — item subsystem detail

```
items/
├── generator.ts             # generateItem({ rarity, ilvl, type, weaponType }) — public API
├── generator.test.ts        # 93 tests covering rarity/tier/mod rules
├── equipment.ts             # planEquip, validSlotsForItem, isTwoHanded, weaponArchetype — shared client+server
├── equipment.test.ts        # planEquip rules (2H displacement, archetype, etc.)
├── starter-gear.ts          # Hand-crafted starter weapons (rusty_sword, rusty_dagger, cracked_wand)
├── item-name.ts             # translateItemName / translateTemplateName — display-time renderer (locale × rarity, UUID-seeded rare names)
├── item-name.test.ts        # 20 tests: gender concord, UUID determinism, locale switch, fallback
├── mod-i18n.ts              # PT formatters for explicit mods + implicit pattern-match (tooltip mod lines)
├── sell-price.ts            # Vendor sell-price formula (rarity × ilvl × mod-quality sum)
├── sell-price.test.ts       # Sell-price scenarios per rarity/ilvl/mod tier
├── translation-coverage.test.ts  # Snapshot test guarding every TemplateBaseId / TemplateModifierId has an en + pt entry
├── MODIFIER_GUIDELINES.md   # Notes on individual modifier semantics (crit, leech)
├── data/
│   ├── modifiers/           # One file per category — defines the modifier pool
│   │   ├── index.ts         # Aggregates everything into MODIFIERS + ModifierId type
│   │   ├── affix-ids.ts     # PrefixModifierId / SuffixModifierId literal unions (lexicon coverage)
│   │   ├── weapon-damage.ts # Local attack mods
│   │   ├── spell-damage.ts  # Flat spell damage (staff/wand only)
│   │   ├── global-damage.ts # Global %, attack/cast speed, global crit
│   │   ├── defense.ts       # Local/global defense, life/mana, regen, thorns, block
│   │   ├── resistances.ts
│   │   ├── attributes.ts
│   │   ├── utility.ts       # Movement speed, leech, stun, reduced reqs
│   │   ├── tome.ts          # Tome-exclusive gain-as-extra elemental
│   │   └── magic-find.ts
│   └── templates/           # Equipment base templates, one file per slot/weapon type
│       ├── swords.ts, daggers.ts, axes.ts, ...  (one per weapon type)
│       ├── helmets.ts, chestplates.ts, boots.ts, gloves.ts
│       ├── shields.ts, tomes.ts, quivers.ts
│       └── rings.ts, amulets.ts, belts.ts
├── lexicon/                 # Per-locale item naming data (composed by item-name.ts)
│   ├── template-ids.ts      # TemplateBaseId + TemplateModifierId literal unions
│   ├── types.ts             # ItemNameLexicon contract (bases, modifiers, prefix/suffix, rare pools)
│   ├── en.ts                # English lexicon
│   └── pt.ts                # Portuguese lexicon (gendered)
└── types/
    ├── base.ts              # EquipmentType, WeaponType, ArmorType, BaseStatKey, EQUIPMENT_GROUPS
    ├── mods.ts              # Modifier, RolledMod, StatEffect, ModifierTier
    ├── item.ts              # GeneratedItem (the thing stored in the items table)
    └── index.ts
```

### `src/game/items/lexicon/` — naming data

Item display names compose at render time from `(nameBase, nameModifier)` tuples on each template. Two locales today (en, pt) sharing a single contract in `types.ts`. Adding a new locale = one new file under this directory.

| File | Role |
|---|---|
| `template-ids.ts` | Literal-union sources of truth: `TemplateBaseId` (~55 bases) and `TemplateModifierId` (~80 modifiers). Templates and lexicons reference these unions — missing entries fail at compile. |
| `types.ts` | `ItemNameLexicon` interface. `bases` keyed by `TemplateBaseId`, `modifiers` keyed by `TemplateModifierId`, `prefixForms`/`suffixPhrases` keyed by `PrefixModifierId`/`SuffixModifierId`. |
| `en.ts` | English entries. Bases as `{ name: string }`. Modifiers as flat strings. |
| `pt.ts` | Portuguese entries. Bases as `{ name, gender: "m" \| "f" }`. Modifiers as `string` (invariant phrase) or `{ m, f }` (gendered adjective). |

See `docs/playbooks/i18n-which-system.md` for the broader decision tree (paraglide vs lexicon vs `mod-i18n.ts`).

### `src/game/stats/compute.ts` — the stat engine

The spine of every gameplay calculation. Read this if you're touching anything that reads character stats. Pure function, fixed-point cascade for broken-state detection, applies a single switch per modifier id.

---

## `convex/` — server (Convex backend)

| File | Concern |
|---|---|
| `schema.ts` | Database tables: `characters`, `items`, `userRoles`. Indexes by `authUserId`, `characterId+locationKind`, `zoneSession`, `stash`. `characters` carries `activeSessionToken` / `activeSessionAt` — see `_shared/character.ts → loadOwnedCharacterWithSession` |
| `characters.ts` | Character CRUD only — `list`, `create`, `remove`, `byId`, `claimCharacterSession` (stamps the active-session UUID; called by `/character-select` Play and by `/world`'s reconciliation effect). Normalizes legacy docs with defaults on read |
| `combat.ts` | Combat + travel mutations: `recordKill`, `usePotion`, `useEtherealIncense`, `syncHp`, `respawnDead`, `enterZone`, `enterCity`, `startTravel`, `arriveAtTravel`, `useTeleportStone`. Every state-mutating mutation accepts a `sessionToken` arg threaded through `loadOwnedCharacterWithSession`. Largest convex file (~570 lines) |
| `items.ts` | Item lifecycle mutations: `exitZone`, `pickFromBag` / `discardFromBag` / `discardFromInventory`, `equipItem` / `unequipItem`, `reorderInventory`, and the `zoneBag` / `inventory` / `equipped` queries. Mutations carry `sessionToken`; the read-only queries deliberately do not — a stale tab can still observe its character coherently |
| `vendor.ts` | Vendor mutations: `vendorBuy` (potions for Rubys), `vendorSellMany` (gear for Rubys). Both carry `sessionToken` |
| `admin.ts` | Admin-only queries (`pulse`, `listUsers`, `listAdmins`, `listRecentItems`) powering `/admin`. Each handler starts with `assertAdmin(ctx)` — route guards are UX, not security |
| `itemValidator.ts` | Convex validator for the `GeneratedItem` shape in `items.data` |
| `_shared/character.ts` | Cross-mutation helpers: `loadOwnedCharacter`, `loadOwnedCharacterWithSession` (single-active-session guard — see [threat-model.md → Threat #5](./security/threat-model.md)), `loadEquippedSet`, etc. The ownership check used by every state-mutating mutation |
| `auth.ts`, `auth.config.ts`, `users.ts` | better-auth integration + user role queries (`assertAdmin`, role grant/revoke) |
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
| `CampCinematic.tsx` | Inline camp cinematic — text fade-in, ambient SFX, two-button modal (Retornar / Seguir). See CONTEXT.md → Acampamento |
| `HitFx.tsx` | Weapon-archetype-aware hit effects (slash / impact / magic) layered over the enemy on each player swing |
| `EquipmentPanel.tsx` | Right-side paper doll (always-visible) |
| `StatusCard.tsx` | Right-side stat readout + Show button + potion + HP globe |
| `HealthGlobe.tsx` | Animated HP/barrier orb |
| `TextLog.tsx` | Status line (priority chain: death → +XP → low HP → zone name) |
| `MonsterTooltip.tsx` | Hover tooltip over the enemy sprite — translated name + mod descriptions |
| `RubyCounter.tsx` | Display-only ruby balance pinned bottom-right of the equipment panel |
| `TravelProgressBar.tsx` | Bottom-of-view bar during travel — survives refresh via `travelArrivesAt` |
| `InventoryModal.tsx` | The big one — drag-drop equip, click dropdown, 60-slot grid |
| `ItemContextMenu.tsx` | Popover menu for click-to-equip |
| `BagPreviewModal.tsx` | Read-only loot bag during combat |
| `ExitZoneModal.tsx` | Post-retreat loot picker (5 buttons, selection grid) |
| `VendorModal.tsx` | Per-act vendor — buy consumables / sell inventory gear for Rubys |
| `ShowStatsModal.tsx` | Full character sheet (4 sections, PoE-style) |
| `SettingsModal.tsx` | Language dropdown + SFX volume slider |
| `SessionLostModal.tsx` | Non-dismissible takeover modal — fires when another tab/device rotates the active-session token. Refresh button reloads the page to re-claim |
| `WorldModals.tsx` | Sibling that owns the modal mount-points (BagPreview / ExitZone / Inventory / Vendor / Settings) — keeps `world.tsx` lean |
| `InventoryButton.tsx` | Backpack icon button on EquipmentPanel |

---

## `src/routes/` — TanStack file-based routes

| Route | Concern |
|---|---|
| `__root.tsx` | Layout shell + Toaster + ConfirmationProvider |
| `index.tsx` | Splash screen ("Shadows of Void" title) |
| `sign-in.tsx` | better-auth UI |
| `character-select.tsx` | Roster + create modal + play button + delete confirm |
| `world.tsx` | **Orchestrator** — wires `useCombatLoop` + `useWorldMutations` + `useViewMode` + `WorldModals` together and resolves the priority TextLog. 740 lines (split shipped in PR #45 + #52; was 900 before decomposition) |
| `admin.tsx`, `admin/items.tsx` | Admin dashboard (only admins see) |
| `api/auth/$.ts` | better-auth fallback route |

---

## `src/hooks/` — React hooks

| Hook | Purpose |
|---|---|
| `useCombatLoop.ts` | State-machine orchestrator (search → engaged → victory). Owns the spawn loop + zone-bag side effects. 411 lines (split shipped in PR #47 into the three hooks below) |
| `useCombatTick.ts` | Engaged-state combat tick (50ms): leech heal → barrier recovery → player swing → enemy swing → thorns. Owns player vitals (HP, barrier, leech, dead) + the 10s `syncHp` + the potion mutation. 420 lines |
| `useEncounterSchedule.ts` | Per-activation encounter pacing — calmaria time bar, camp threshold rolls, ambush packs, gap rolls, next-spawn rarity decision. 218 lines |
| `useWorldMutations.ts` | Optimistic mutation bundle for the `/world` route (enterZone, exitZone, pickFromBag, equipItem, etc). See [ADR 0001](./adr/0001-optimistic-mutations.md) |
| `useViewMode.ts` | View-mode state machine (`"map" | "city" | "combat"`) + the pendingArrival token + the auto-arrival / refresh-resilience effects |
| `useInFlight.ts` | Spam-click protection: `run(fn)` is a no-op while an earlier call is in flight. Used by every modal action button and world mutation site |
| `useSessionToken.tsx` | Per-tab single-active-session token + `withSession(args)` helper. `SessionTokenProvider` mounted in `__root.tsx`; mutations thread the token to close Threat #5. Refresh = fresh UUID = re-claim |
| `useSfxVolume.ts` | `useSyncExternalStore` binding for the global SFX volume (consumed by HUD + settings + HitFx) |
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
| "Why three i18n systems instead of one?" | `docs/adr/0002-i18n-systems.md` |
| "Why aren't item / monster names cached?" | `docs/adr/0003-render-at-display-names.md` |
| "Why is class/monster/template data in `src/game/` and not in the DB?" | `docs/adr/0004-static-data-conventions.md` |
| "Where are the rules for what rolls on a belt?" | `CONTEXT.md` → Equipment Slots → Belt |
| "What's an EquippedSlot?" | `src/game/stats/types.ts:EQUIPPED_SLOTS` + `narrowEquippedSlot` |
| "Which Convex file owns this mutation?" | See the `convex/` table above — `characters.ts` (CRUD), `combat.ts` (combat + travel), `items.ts` (lifecycle + queries), `vendor.ts` (buy/sell) |
| "What does the stat engine actually do?" | `src/game/stats/compute.ts` + tests in `compute.test.ts` |
| "How does dual-wield work?" | `CONTEXT.md` → Dual-wielding |
| "Why doesn't this Convex error look like English?" | `src/lib/convex-errors.ts:translateServerError` |
| "How are item tooltip mod lines translated?" | `src/game/items/mod-i18n.ts` |
| "How are item names rendered (per locale)?" | `src/game/items/item-name.ts` + `lexicon/{en,pt}.ts` |
| "Which i18n system should I use for new strings?" | `docs/playbooks/i18n-which-system.md` |
| "How do I add a new vendor consumable?" | `docs/playbooks/adding-a-vendor-product.md` |
| "How do I start the skill / passive tree / stash system?" | `docs/playbooks/adding-a-skill.md` (or `-passive`, `-stash-tab`) — stubs that list the open questions |
| "Why does this playbook example match the current types?" | `docs/playbooks/_examples/` — sentinel files type-checked by `tsc --noEmit` |
