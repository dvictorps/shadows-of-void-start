# Shadows of Void — Context

Canonical glossary for the game domain. Defines what each term **means** in the game, not how the code implements it. When the code disagrees with this document, fix the code.

---

## World Progression

### Act
A chapter of the game. Contains a directed acyclic graph (DAG) of **zones** that the player progresses through. **Act 1** is the only built act today; the system is designed to host more.

### Hub
A central screen that lets the player switch between unlocked acts to farm them in any order. Acts are unlocked **linearly** (you finish act N to unlock act N+1), but past acts remain re-enterable through the hub.

### Node
A point in the act's DAG. Two kinds exist today:

- **Zone node** — a combat location. The player enters, fights enemies (see Threshold Bar / Zone Boss), leaves, returns later. May be a regular zone, the act-boss node, or future variants.
- **City node** — a safe location with no mobs. Houses the act's **vendor** and gives access to the **stash**. Always one city per act, unlocked at act entry (the player starts the act with both the city node and the first zone node visible on the map).

### Zone
Synonym for a Zone node. Used in the rest of this document when the distinction from a city is contextual.

A zone has three persistent states per character:
- **Incomplete** — never finished. Threshold bar resets every time the player leaves.
- **Boss pending** — the player reached the threshold but deferred the boss fight. The "summon boss" button persists across exits until the boss is killed.
- **Complete** — the player killed the zone boss at least once. Stays this way forever. Re-entering the zone is allowed for farming; the boss can be summoned again by refilling the threshold.

### Threshold Bar
The progress bar shown over the zone view that fills as the player kills mobs. The exact kill count is hidden; only the bar is visible. The threshold is **30 kills**. When it fills, the **zone boss** spawns (or becomes summonable, see "Boss Deferral"). The fill resets to 0 every time the player leaves the zone with the boss unsummoned.

### Boss Deferral
When the threshold bar fills, a pause modal asks if the player wants to fight the boss now. If they decline, a persistent **"Invoke Boss"** button appears in the zone UI. This button survives leaving and re-entering the zone — the boss stays "pending" until killed.

### Zone Boss (Miniboss)
The strong enemy that appears at the threshold of a normal zone. Drops better loot than mobs. Respawns every time the threshold is refilled, including after the zone is complete (so completed zones remain meaningful for loot farming).

### Act Boss
A distinct, more powerful enemy that gates progression to the next act. Lives in the **final node** of the act (a dedicated boss node, not a regular zone). For Act 1, the boss node follows **Model B**:

1. Bar 1 fills (mobs) → a miniboss appears
2. Player kills the miniboss → Bar 2 starts
3. Bar 2 fills (harder mobs) → the **act boss** appears
4. Player kills the act boss → the act is complete; next act unlocks

The act boss is **farmable** — it does not despawn permanently after the first kill. The challenge comes from having to clear both bars and the miniboss every attempt; the player can't just walk in and re-kill it.

Future acts may use different boss-node mechanics (gauntlets, multi-boss, scripted sequences). The system must accommodate this without hardcoding Act 1's pattern.

---

## Viewport Modes

The `/world` route shares a single shell (equipment panel + status card + log) and swaps the central viewport between three modes depending on which node the player has entered:

- **Map** — the act's node DAG. Default state when the player isn't inside any node. Equipment panel and status card (small HP globe, consumables, character info) remain visible on the right.
- **City** — replaces the viewport with the city scene when the player enters a city node. No mobs. Surface includes buttons to open the **vendor** (modal) and the **stash** (modal). The status card and equipment panel are unchanged.
- **Combat** — replaces the viewport with the active combat scene when the player enters a zone node. Enemy in center, enemy HP/name on top. The HP globe migrates from bottom-right (passive) to bottom-left (large, focal). Consumables remain usable.

This is component-state inside `/world`, not three different routes. Entering a node sets the view mode; the "Back to map" affordance returns to **Map**.

## Stash and Vendor

### Stash
Persistent item storage. **Shared across all characters in the account, scoped by mode.**

- The **softcore stash** is shared across all softcore characters on the account.
- The **hardcore stash** is shared across all hardcore characters on the account.
- The two stashes are **isolated** from each other — a hardcore character's drops cannot reach softcore via the stash, preserving the integrity of hardcore risk.

Storage model:
- **One slot, one item.** No grid-tetris sizing — every item occupies exactly one slot, regardless of type or rarity.
- Default capacity: **60 slots** in a single tab.
- Additional **tabs are purchasable with Rubys** (see below). No fixed cap on tab count.

### Inventory
The character's personal carry capacity. Distinct from the stash — what travels with the character.

- **60 slots**, same one-item-per-slot rule as the stash.
- This is the destination for items kept after a zone (see Loot Pipeline) and the source for items deposited into the stash.

### Vendor
Per-act NPC inside the act's city. Uses **Rubys** in both directions.

- **Sells**: initially **consumables only** (life potions today, more types in future). Does not sell gear in MVP.
- **Buys**: the player can sell items (gear) to the vendor for Rubys. The vendor does **not** buy back consumables — once bought, they're committed.

Vendor stock and accepted goods are scoped to the act — Act 2's vendor doesn't share state with Act 1's vendor.

### Ruby (currency)
The game's only currency. **Monsters never drop Rubys.** The full ruby loop is:

1. Player kills monsters → drops items
2. Player sells unwanted items at a vendor → receives Rubys
3. Player spends Rubys at a vendor (gear, consumables) or on stash tabs

This forces engagement with the vendor as the only ruby source and keeps drops as the central reward — Rubys are downstream of the loot loop, not parallel to it.

---

## Loot Pipeline

Loot is **staged server-side**, not instantly added to the inventory. The flow inside a zone:

1. **Entering a zone** issues a `zoneSession` — a short-lived id that scopes the drops of this visit. The character document tracks the current session.
2. As the player kills monsters in a zone, the server rolls drops and stores each item in the **items table** with `location = { kind: "zoneBag", characterId, zoneSession }`. The mutation that records a kill also returns the rolled items so the UI can show them immediately. Capacity is unlimited — filtering happens on exit.
3. A notification button in the combat view (top-right, next to Retreat) shows the bag's running count and lets the player open a **preview modal** at any time to see what dropped so far.
4. When the player chooses to **leave the zone** (Retreat, return to map, enter the city via map, etc.) a modal appears listing every item in the bag. The player picks which items to **keep** (transfer to inventory) or hits **"Get all"** to take everything. Discarded items are deleted permanently.
5. If the player **dies in the zone**, the server deletes every item with the current `zoneSession`. No preview, no recovery.

Server-authoritative storage means the client can never inflate drops, replay kills, or fabricate items at commit time — critical groundwork for leaderboards and the future trade system. The "items table" lifecycle (`zoneBag → inventory → equipped → stash → traded`) is the single source of truth for ownership. Equipped items live in the same table; the character document stores **only the item id** (`equippedWeaponId: Id<"items">`) as a cached pointer. Item IDs are stable across every transition — essential for audit trails, trade history, and leaderboards.

The zone-bag-then-pick model rewards exploration (see everything before committing), penalizes greed (dying late loses the haul), and lets the player walk out with only what fits the build.

### Drop pool (per kill)
When a mob is killed, server rolls drops using:

1. **Drop probability** — per CONTEXT.md drop rate table (e.g., Normal mob = 30% chance to drop 1 item).
2. **Rarity** — per the same table.
3. **Item level (ilvl)** — equals the mob's instance level.
4. **Equipment type** — uniformly distributed across eligible types, gated by mob instance level:
   - Levels 1-4 eligible: weapon, helmet, chestplate, boots, gloves, offhand (6 types)
   - Levels 5+ eligible: those plus jewelry (ring, amulet, belt) → 9 types total
5. **Weapon subtype** — when the rolled type is "weapon", subtype is uniform across all 9 weapon variants (sword/dagger/axe/etc). No class filter; loot is loot — trade will let players move gear between characters and accounts.
6. **Mods** — generated by the existing `generateItem({ rarity, itemLevel, equipmentType, weaponType })` pipeline.

### Potion drops
Independent of the equipment drop roll, every monster kill rolls a **20% chance to drop a life potion**. Potions are not entities in the items table — they are a count on the character doc — so the drop is **auto-collected**: the server increments `char.potions` directly and notifies the client. If the character is already at the 10-potion cap, the roll is **wasted silently** (no drop event, no overflow, no replacement). This gives runs a sustain stream without committing potions to the bag/inventory pipeline.

### Inventory overflow and exit-modal flow
On exit from a zone (Retreat / death-respawn does NOT count, that's a wipe), the **exit modal** appears with every staged item.

- **Default state**: all items marked "keep".
- **Player toggles** individual cards to mark "discard".
- **"Get all"** button: marks every item as keep — disabled when total would exceed inventory free slots.
- **"Confirm"** with at least one item to discard: secondary warning "These items will be lost forever."
- **"Confirm"** with zero items kept: warns "All items will be discarded."
- **"Cancel"** closes the modal and returns the player to the engaged combat view — the zone bag persists, the session is unchanged.
- Inventory full check: if total kept > free slots, "Confirm" is disabled. Player must discard items either in the bag OR via the Inventory panel separately before committing.

### Loot button (combat HUD)
A small button appears in the **top-right of the combat view, immediately to the left of "Retreat"**. It uses the lucide `Sparkles` icon and shows a badge with the current bag count. Click opens a **preview modal** — read-only listing of staged items (same item-card visuals as inventory), with a "Close" action that returns to combat. Distinct from the exit modal (which forces a confirm/discard decision); the preview lets the player peek without committing.

### Item card (shared visual)
Every item rendered as a square card uses the same visual contract:

- **Square**, rounded corners (`rounded-md`).
- **Border** colored by rarity:
  - Normal: `#c8c8c8` (gray)
  - Magic: `#8888ff` (blue)
  - Rare: `#ffff77` (yellow)
  - Legendary: `#dc143c` (crimson)
  - Epic: `#1eff00` (green)
- **Glow** = `box-shadow` in the rarity color, scaling with rarity. Legendary and Epic pulse subtly.
- **Content**: equipment-type emoji centered (reusing the existing `WEAPON_EMOJI` map; an `EQUIPMENT_EMOJI` map covers helmet/chest/boots/etc).
- **Hover**: opens the standard `ItemTooltip`.
- **Empty slots** (inventory only): same outline, dim border `border-white/15`, no glow, no emoji.

### Inventory modal
Opened via the existing `InventoryButton` (backpack icon in `EquipmentPanel`). Wide modal split into two regions:

- **Left** (~20%): equipment slots arranged as a compact grid (2 cols × 5 rows of squares — no paper-doll silhouette, just rounded-square slots to fit modal height without scroll). Shows currently equipped items; **no equip/unequip system in this iteration** — view-only.
- **Right** (~80%): inventory grid (10 cols × 6 rows = 60 slots), scrolls vertically if items overflow visible rows. Items are ordered `droppedAt desc` (newest first); empty slots fill the rest.

---

## Combat Resolution

Combat is automatic and **status-machine driven**: both sides have stats, attack rates, and mitigation, and damage is applied tick-by-tick by the formulas below. The player has no per-hit input in MVP combat; skills with cooldowns are a later layer that will plug into this same machine.

### Per-tick attack
- Each side has an **attack rate** (attacks per second). Example: a 1.8 attack-speed weapon resolves 1.8 hits/sec. Dual-wielders use a combined alternating rate (see "Dual-wielding").
- The defending side mitigates with its **armor / evasion / barrier / resistances** before the hit lands. Whatever remains is subtracted from life (and barrier, where applicable).
- Life leech, regen, on-hit, on-kill effects fire per their own triggers as part of the same machine.

### Damage formula (per hit)
A hit is computed in this order:

1. **Flat damage** — roll a random integer in `[min, max]` per damage type. Sources: the swinging weapon's `physicalDamage` + flat-to-attacks mods from gear (rings, gloves, amulet — never belt). For caster weapons: per-element flat-to-spells from the weapon itself (no other source rolls flat-to-spells).
2. **Increased pool** — sum all `+X% increased` modifiers in the same category, apply once: `base × (1 + Σincreased/100)`. Categories: physical, per-element, "damage" (universal), attack damage / spell damage, attack speed, cast speed, crit chance.
3. **More multipliers** — cascade multiplicatively, no pooling: `base × moreA × moreB × ...`. Reserved for skills today; no items roll `more` modifiers yet.
4. **Crit roll** — `random() × 100 < critChance`. On hit: damage × `(1 + critMultiplier/100)`. Crit chance is capped at 100% **and** clamped to 5% minimum (no zero-crit characters). Crit multiplier has no cap.
5. **Defenses** — see below.

### Defenses

**Armor** (physical mitigation, Last Epoch-inspired):
```
physicalReduction = armor / (armor + 10 × enemyLevel)
cap = 85%
```
The denominator scales with the attacker's level, **not** with hit size. Armor stays effective against same-level enemies regardless of how big any single hit is — unlike PoE, where armor falls off against spikes. Armor reduces only physical damage; elemental and void pass through untouched.

**Evasion + Accuracy** (hit-or-miss gate, applied before damage):
```
hitChance = attackerAccuracy / (attackerAccuracy + defenderEvasion / 4)
clamp [0.05, 0.95]
```
Each incoming hit rolls against `hitChance`. A miss deals **zero** damage and triggers no on-hit effects (no leech, no life-on-hit). Symmetric — both sides roll. Default monster baseline: `accuracy = monsterLevel × 10`, `evasion = 0` (overridden by monster modifiers).

**Resistances** (cold / fire / lightning / void) cap at 75%. Each elemental hit is multiplied by `(1 - resistance/100)`.

**Barrier** (sits over life, blue ring around HP globe):
- Functions as overflow life — incoming damage hits barrier first; what remains carries to HP.
- When barrier reaches **0**, a **6-second timer** starts. The timer does **not reset** on further hits — damage during the recovery window just hits HP directly.
- When the timer expires, barrier refills to **100% instantly** (single-tick refill, not gradual).
- Barrier does not regenerate while above zero — the refill mechanic is the only recovery.

**Block** (shield-only) — when a hit lands and is not evaded, roll once against `blockChance`. A blocked hit deals 0 damage to barrier/life but **does** trigger the attacker's on-hit (blocks are still "hits" for the attacker's purposes). Thorns still reflect to the attacker on block.

### Leech
Per hit that lands and deals damage:

```
magnitude = damageDealt × leechPercent / 100
rate = magnitude × 0.20   per second
duration = magnitude / rate = 5 seconds
```

Each leeching hit spawns a **regen instance** that ticks for 5 seconds. Multiple instances stack additively. Total leech rate is capped at **20% of max life per second** — excess instances still spawn but their rates are clamped against the cap. Mana leech follows the same formula independently.

Leech does not refill barrier — it is life-only (and the parallel rule for mana).

### Tick order
The **player acts first** on each tick. Within a tick: player's hit resolves → effects trigger → enemy's hit resolves. This gives the player a slight advantage equivalent to one free swing per combat and keeps simulations deterministic.

### Stat caps
Hard ceilings applied after all modifiers stack:

- **Critical strike chance: 100%.** Excess crit chance from gear is wasted.
- **Resistances (cold, fire, lightning, void): 75%.** Stacking past 75% is wasted in normal content.
- **Attack speed and cast speed: no cap.** These scale freely. Used as primary scaling vectors in the late game.

### Monster rarities
Mobs use the same rarity ladder as items, with reduced reach:

- **Normal mob** — baseline stats, no modifiers.
- **Magic mob** — 1-2 modifiers rolled from the monster modifier pool. Slightly tougher than normal.
- **Rare** — used exclusively for **minibosses** (the threshold spawn). Higher-tier modifier rolls. Drops better loot.
- **Legendary / Epic mobs do not exist** — those tiers are reserved for items.

### Between-zone state
HP **persists across zones**. Leaving a zone at low HP means re-entering at low HP — there is no automatic full-heal between fights. Recovery options:

- **Passive HP regen** ticks out of combat in real time, governed by the same regen stats used in combat. The map is "on the clock" — standing still in the map view actually heals.
- **Consumables** can be used freely from the status card on the map.
- **Entering a city node fully restores HP and all per-fight stats to 100%.** This is the cheap, always-available reset; the trade-off is the time/distance to walk back.

When the player leaves a zone, all **damage-over-time (DoT) effects are removed**. The player doesn't bleed out on the map.

### Equipment swap during combat
Allowed. The player can re-equip gear inside a zone — useful for swapping in resist-heavy gear before a hard fight, or weapon variations. There is no equip cooldown in the MVP.

### Equipment requirements and broken state
Items carry `requirements: { level, str?, dex?, int? }` (already baked into base templates). Two distinct checks govern equip behaviour:

**Equip-time check (strict)**
At the moment of equip, the character's totals are computed **without the item being equipped** and compared against the item's requirements. The equip mutation rejects if `level < req.level` or any attribute is short. The item's own attribute contribution never helps it equip itself.

**Broken state (lax, post-equip)**
If a previously equipped item's requirements become unmet (e.g., the player unequips a ring that was supplying +STR), the item enters **broken state**. It stays in the slot but contributes **zero stats** — broken weapons swing for damage 1, broken armor adds no defense, broken jewelry stops conferring its mods.

Broken detection runs as a fixed-point iteration in the stat engine:
1. Start with all equipped items "live", compute totals (class base + level scaling + all equipped contributions).
2. For each equipped item, check requirements against current totals.
3. Mark unmet items as broken; subtract their contribution from totals.
4. Repeat until the broken set is stable (no new items become broken).

This naturally produces the PoE "self-sustaining gear" behaviour: a helmet that gives +15 STR and requires STR 15 cannot be equipped by a STR-10 character alone, but once equipped (via a temporary STR source) it counts its own +15 in the broken-state check and stays functional. Removing the temporary source while the helmet is equipped leaves it OK; unequipping the helmet means it cannot be re-equipped without external help.

**Visual signal** — broken items render with a red border (overriding the rarity color), a red `AlertTriangle` icon overlay, and a red warning line at the top of their tooltip: "Falta {N} de {Atributo}", one line per unmet requirement.

### Active player input
Combat is otherwise automatic, but the player has **one active control today**: using a **life potion**.

- Potions heal **20% of maximum HP** on use.
- The character can carry a **maximum of 10 potions** at any time.
- Potions are obtained two ways: bought from the city vendor, or **dropped by monsters** (see Loot Pipeline → Potion drops).
- The potion button lives on the bottom-right of the combat view (next to the health globe) and on the map's status card (so the player can also use one out-of-combat).

Future skills will plug in as additional active controls; the potion is the only one in the MVP.

---

## Experience and Levels

- The level cap is **100**. Linear XP curve (the cost to gain a level scales linearly with level number).
- **Act 1 carries the character to roughly level 15.** Balance will be refined as later acts come online.
- See **Death** for the XP-loss-on-death rule.

---

## Classes

In the MVP, classes differ along two axes only:

- **Starting attribute distribution** — each class has its own baseline (Warrior favors Strength, Rogue favors Dexterity, Mage favors Intelligence). Lives in `src/game/classes/data.ts`.
- **Starting equipment** — each class enters Act 1 with one class-flavored weapon:
  - **Warrior** → Sword
  - **Rogue** → Dagger
  - **Mage** → Wand

The current classes are **Warrior**, **Rogue**, **Mage**.

Deep class identity — active skills, passive tree branches — is **future work**, layered in this order:

1. MVP combat works for all classes
2. **Passive tree** is added (shared system, class branches into it)
3. **Active skills** per class are added on top of the passive tree

Until passive tree + skills exist, classes effectively play the same way; they just start in different stat positions.

---

## Item Identification and Loot Tiers per Act

- **All items drop pre-identified.** No identification scrolls, no fog of war on stats.
- **Act 1 drop pool:** Normal, Magic, Rare. Legendary has a **low chance** to drop only from the **act boss**. Epic items do not exist in Act 1.
- **Act 2 onward (planned):** introduces Epic drops and continues to ramp Legendary frequency.

### Drop rates (Act 1 baseline)

| Source | Drop chance | If drops |
|---|---|---|
| Normal mob | 30% | 70% Normal · 25% Magic · 5% Rare |
| Magic mob | 60% | 40% Normal · 50% Magic · 10% Rare |
| Miniboss (Rare) | 100% | **2 items** · 1 **guaranteed Rare** · 1 additional rolled at 30% Normal · 55% Magic · 15% Rare |
| Act boss | 100% | **2-3 items** · 1 **guaranteed Rare** · remaining slots: 75% Rare · 25% Magic (no Normals from boss) |

**Magic Find** (item rarity %) shifts every drop's distribution toward higher rarity, including the **guaranteed Rare slots** from minibosses and the act boss. Every drop — including the guaranteed slots — can be promoted upward by enough MF:

- Normal → Magic → Rare → **Legendary**

Legendaries are reachable in Act 1 from any source, but the baseline chance is **very low**. The act boss has the highest baseline Legendary chance (a few %); regular mobs need significant MF stacking to see one. Epic drops are not available in Act 1.

### Vendor price formula

```
price = base_rarity × (1 + ilvl / 10) × (1 + mod_quality_total / 10)
```

- `base_rarity` — fixed per rarity:
  - Normal: 5
  - Magic: 20
  - Rare: 80
  - Legendary: 400
  - Epic: 2000 (Act 2+)
- `mod_quality_total` — sum of `(11 - tier_index)` across all explicit mods on the item. T1 (best) contributes 10, T10 (worst) contributes 1. Items with no explicit mods (Normal items) contribute 0 here.

Example: Rare item, `ilvl 80`, three mods rolled at tiers T3 / T4 / T2:
```
80 × (1 + 80/10) × (1 + (8 + 7 + 9) / 10)
= 80 × 9 × 3.4
≈ 2448 rubys
```

---

## Monster Modifier Pool

Magic and Rare monsters roll modifiers from a small, generic pool (separate from the item modifier pool — different domain). Counts:

- **Magic mob: 1 modifier**
- **Rare / Miniboss: 3 modifiers**
- **Normal mob: 0 modifiers**

The pool is intentionally short and broad — granular per-monster tuning happens through base stats, not the modifier pool.

Starter pool (Act 1):

- **Increased Life** — wider HP bar.
- **Increased Damage** — bigger hits.
- **Increased Attack Speed** — more hits per second.
- **Increased Cold Resistance** — mitigates cold damage.
- **Increased Fire Resistance** — mitigates fire damage.
- **Increased Lightning Resistance** — mitigates lightning damage.
- **Increased Void Resistance** — mitigates void damage.
- **Additional Barrier** — flat barrier pool above HP.
- **More Armor** — increased physical mitigation.

The pool will grow with later acts (on-hit effects, summons, auras), but Act 1 stays minimal.

---

## Death

When a character's life reaches zero:

- **Softcore (default)**: the character loses **5% of current XP** (in Act 1; the penalty may scale up in later acts), the entire zone-bag is discarded, and the player respawns at the act's city node. The character itself persists. XP loss is **floored at the level's baseline** — death never demotes the character to a lower level. (`max(0, current_xp - 0.05 × current_xp)`.)
- **Hardcore (opt-in at character creation)**: the character is permanently deleted on death. Stash items remain (the stash is account-wide), but the character record and all its equipped gear are lost.

Hardcore is a **per-character flag** chosen at creation and cannot be toggled afterward. A hardcore character's death is unrecoverable.

### Enemy classes
- **Normal mobs** — baseline stats from game data. Equivalent to an item of `normal` rarity: no extra modifiers.
- **Minibosses / Zone bosses** — carry **modifiers** drawn from a pool, just like rare/legendary items. Modifiers may increase attack speed, damage, defense, or grant on-hit effects. This is how difficulty scales without rewriting enemies.
- **Act bosses** — handcrafted; their modifiers and behavior are specified per boss, not rolled.

### Mob configuration
Mobs live in **game data**, not the database. Each zone declares a **pool of eligible mobs**; combat sessions roll spawns from that pool. Mob templates include base stats (HP, attack speed, damage, defenses) and any flavor-specific behavior; modifiers are layered on top for minibosses.

### Monster damage types
Monsters express damage with the **same shape as the player's swing**: `physicalDamage: {min, max}` (defaults to `{min: 0, max: 0}`) plus `elementalDamage: ElementContribution[]` (defaults to `[]`). The per-hit roll mirrors `rollPlayerSwing`: roll a flat amount per type, then mitigate physical via armor and each element via its resistance. A monster can be **single-type** (Goblin = `{physicalDamage: {min: 8, max: 12}, elementalDamage: []}`), **single-element** (Fire Imp = `{physicalDamage: {min: 0, max: 0}, elementalDamage: [{element: "Fire", min: 8, max: 12}]}`), or **hybrid** (Hellhound = both `physicalDamage` and one or more `elementalDamage` entries). The combat engine handles all three without branching — the damage types just sum.

### Zone level and monster instance level
Each combat **zone node** declares its `level: number`. When a mob spawns, the server rolls its **instance level** as `zoneLevel + random(-1, 0, +1)` — the same monster template scales slightly so the zone still feels varied. The instance level is what determines drop **item level** (ilvl) and gates equipment types that can drop (see Loot Pipeline → Drop pool).

---

## Navigation and Logout

### From character-select → world
Picking a character routes to `/world`. The world view starts in **Map** mode for the character's current act.

### From world → character-select
A back button in the top-left corner of the world view opens a **confirmation modal** ("Leave the world?"). Confirming returns the player to `/character-select`. There is no other way out of `/world` — chromeless routes don't render the Header.

### Sign-out
Only reachable from `/character-select`. A dedicated sign-out control lives there so the player must consciously leave the character context before signing out.

### Hub
A separate `/hub` route exists for switching between unlocked acts. It is **locked** until the player completes Act 1. Until then, character-select routes directly to `/world?act=1`. After completing Act 1, character-select routes to `/hub`, which lets the player pick which act to enter.

---

## Equipment Slots

The character has nine slots. Each slot has an **identity** — the kinds of modifiers it is allowed to receive.

### Ring (`ring`)
Hybrid slot. The most flexible piece in the kit.

Can roll:
- Flat damage (physical, elemental)
- Resistances
- Life and mana (flat + regen)
- Accuracy
- Defenses (flat armor / evasion / barrier)
- Crit chance and crit multiplier
- Damage % (global, all flavors)
- Attributes

A ring can be fully defensive, fully offensive, or a mix — it's the catch-all.

### Amulet (`amulet`)
Premium hybrid slot, identity built around **attribute bases** and high-impact mods. Behaves like a ring (any category) but pulls toward offensive/utility power. Always rolls a base attribute implicit.

Can roll everything a ring can roll.

### Belt (`belt`)
Hybrid slot, but with a **distinctive Shadows of Void identity**:

> Belt rolls damage **%** but never damage **flat**.

This is the slot's signature. Belt is the place to get "+X% increased Fire Damage" but never "+10 Cold Damage to Attacks".

Otherwise: life, mana, regen, resistances, attributes, and life/mana on kill are fair game. No accuracy, no crit multi, no leech, no on-hit.

### Gloves (`gloves`)
Hybrid offensive/defensive slot. Welcomes:
- Local defense (resolves to armor/evasion/barrier per base)
- Flat damage (global, attack mods)
- Attack speed and cast speed (global)
- Crit chance and crit multi
- Accuracy
- Leech / on-hit
- Life, mana, resistances

Gloves are the second "free slot" alongside rings — both offense and defense fit.

### Helmet (`helmet`), Chestplate (`chestplate`), Boots (`boots`)
Defensive identity. Primarily roll:
- Local defense (resolves to armor/evasion/barrier per base)
- Life, mana, regen
- Resistances
- Attributes
- Global defense % (constrained by base — see armor types below)

**Boots** additionally roll utility: movement speed.

**Caster armor exception:** helmet and chestplate **with a silk base** can roll `+% Spell Damage`. This is the only offensive mod that armor receives. It mirrors PoE energy-shield gear and preserves the caster fantasy without giving martial armor offensive rolls. Boots are excluded — they are defense + utility (movement speed) and never offensive.

### Off-hand (`offhand`)
A flexible slot that accepts shields **or** a second weapon (dual-wielding). The slot's contents drive distinct combat behaviour:

**Shield in off-hand** — defensive identity, light hybrid potential. Rolls:
- Local defense (same resolution as armor)
- Block chance
- Thorns
- Defensive utility

The shield does not swing — it adds its stats to the character's totals and that's it.

**Weapon in off-hand (dual-wielding)** — see "Dual-wielding" below.

### Dual-wielding
A second one-handed weapon may go in the off-hand slot. When both hands hold a weapon, the character is **dual-wielding** and the off-hand contributes its own swings on top of the main hand's.

**Slot eligibility**:
- One-handed attack weapons (`sword`, `dagger`, `axe`, `mace`) can occupy main hand **or** off-hand.
- One-handed caster (`wand`) can occupy main hand **or** off-hand.
- Two-handed weapons (`greatsword`, `twoHandedAxe`, `bow`, `staff`) occupy main hand **and block the off-hand slot** — equipping a 2H weapon while an off-hand item is equipped auto-unequips the off-hand back to inventory.
- Shields are off-hand only.

**Same-archetype rule**: dual-wielding requires both weapons to share archetype. Attack 1H + attack 1H is allowed (sword + dagger, axe + sword, etc.). Caster 1H + caster 1H is allowed (wand + wand — the only caster combination). **Mixed archetype is rejected** (no sword + wand). This keeps the combat tick model coherent — one path (attack or spell) active at a time.

**Combat behaviour**:
- Combined tick rate = `mainHand.attackSpeed + offHand.attackSpeed` (or `castSpeed` for caster pairs).
- Ticks **alternate**: tick 1 = main hand swings, tick 2 = off-hand, tick 3 = main hand again. The swinging weapon's local stats (base damage, local mods, weapon-specific crit chance) source that tick's damage.
- Global modifiers (`+X% Increased Physical`, `+X Strength`, global crit chance/multi, resistances, attributes) apply on **every** swing, regardless of which weapon is active.
- Cast speed base is `1.0` for caster weapons (no per-template base); cast speed mods scale that baseline.

There is no implicit dual-wield damage or attack-speed bonus — the value of dual-wielding is the doubled tick rate. The trade-off vs shield is straightforward: shield offers block + thorns + defensive stats, dual-wielding offers raw rate.

---

## Weapon Types

Weapons split into two **archetypes** by purpose, not by stat block. The archetype determines which modifier categories the weapon participates in.

### Attack weapons
`sword`, `greatsword`, `dagger`, `bow`, `axe`, `mace`, `twoHandedAxe`.

These compute header stats (min/max damage, attack speed, crit chance) and accept **local attack mods** — physical flat, physical %, elemental flat-to-attacks, attack speed %, crit chance %.

Grouped under `allAttackWeapons` for `applicableTo` purposes.

### Caster weapons
`staff`, `wand`.

These have no martial header stats beyond a base crit chance. They never roll local attack mods (no physical flat, no attack-flat elemental, no attack speed, no melee-only).

What they **do** roll exclusively:
- **Flat spell damage** — `+X Cold Damage to Spells`, `+X Fire Damage to Spells`, etc. This is the caster equivalent of attack flat damage and rolls **only** on staff and wand.
- **Cast speed** (global) — also rolls on jewelry and gloves; the asymmetry with attack speed (which never rolls on attack weapons) is intentional, because caster weapons have no local cast-speed analogue.

Both archetypes share: global elemental damage %, global crit multi, global crit chance, attributes, resistances. Caster weapons additionally share spell damage %.

### Asymmetry: attack speed vs cast speed
- **Attack speed %** rolls on jewelry and gloves — never on attack weapons. (Attack weapons get attack speed via their base/template, not as a rolled mod.)
- **Cast speed %** rolls on staff/wand, jewelry, and gloves. Caster weapons need this slot to be available since they have no base attack speed analogue.

This is intentional design, not an oversight.

---

## Armor Bases

Armor pieces (helmet, chestplate, boots, gloves) come in three bases. The base determines which **defense stat** the piece converts its local defense roll into.

| Base | Defense stat | Caster-aligned |
|---|---|---|
| `plate` | Armor | No |
| `leather` | Evasion | No |
| `silk` | Barrier | Yes |

### Global defense % rolls are gated by base
The global defense increase mods only roll on the matching base. This is an invariant:

- `+% Armor` rolls only on **plate** pieces (jewelry exempt — always allowed)
- `+% Evasion` rolls only on **leather** pieces (jewelry exempt)
- `+% Barrier` rolls only on **silk** pieces (jewelry exempt)

A plate helmet will never roll `+% Evasion`. A leather chestplate will never roll `+% Armor`. The reasoning: a mod that boosts armor by % is meaningless on a piece that doesn't produce armor.

### Caster armor exception
Silk **helmet** and **chestplate** additionally roll `+% Spell Damage`. This is the **only** offensive mod that any armor receives, and it is gated to silk. Plate and leather pieces never roll spell damage. Silk boots are excluded — boots are defensive + utility (movement speed), never offensive.

This single exception keeps the rule simple: armor is defensive, **except silk helmet and chestplate also express caster identity**.

---

## Modifier Categories

A short reference for what each category contains, for grilling against the slot rules above.

| Category | Examples | Typical slots |
|---|---|---|
| Local attack | physical flat/%, attack speed, crit chance | Attack weapons only |
| Local defense | flat defense, % defense | Armor, shields |
| Spell damage flat | `+X Fire Damage to Spells` | Caster weapons only |
| Global damage % | `+% Fire Damage`, `+% Spell Damage` | Weapons, jewelry, gloves (some); helmet/chestplate for spell damage on silk only |
| Global damage flat | `+X Physical Damage to Attacks` | Ring, amulet, gloves (never belt) |
| Accuracy | flat accuracy | Attack weapons, ring, amulet, gloves, helmet |
| Crit multi (flat-additive %) | `+X% Critical Strike Multiplier` | Weapons, ring, amulet, gloves |
| Life / mana | flat, regen | Armor, jewelry; mana also on caster weapons |
| Resistances | cold/fire/lightning/void | Armor, jewelry |
| Attributes | str/dex/int | Armor, jewelry |
| Utility | movement speed, stun duration, reduced attribute requirements | Boots, gloves, belt, armor (varies per mod) |
| Magic find | item rarity (prefix + suffix) | Every slot except weapons (armor, jewelry, offhand) |

---

## Modifier ID Naming Convention

A modifier's `id` ends in a suffix that signals its math. Knowing the suffix means you can predict how it stacks.

| Suffix | Math | What it adds to | Stacking example |
|---|---|---|---|
| `Flat` | Additive | A raw running total (number OR percentage) | Two `criticalStrikeMultiplierFlat` rolls of +15% and +25% → +40% added to crit multi total |
| `Increase` | Additive into an "increased %" pool, then one multiplier on the base | Multiplier applied to the base | Two `physicalDamageIncrease` rolls of 25% and 30% → base × (1 + 0.55) |
| `More` | Multiplicative, applied in cascade (no pooling) | Distinct multiplicative factor | base × 1.2 × 1.15 (reserved for skills, not yet used in modifiers) |

`Flat` is **honest about the math**, not about the unit. A "Flat" mod can be a flat number (`+10 Cold Damage`) or a flat percentage (`+15% Critical Strike Multiplier`) — what matters is that it stacks by addition, never via the `increased` pool.

Don't rename a mod's suffix without changing its `modifierType` field — the suffix and the field must agree.

---

## Modifier Knobs

When tuning a modifier, three knobs do different jobs. Mixing them up leads to data that's hard to reason about (e.g., using slot lists as a balance lever instead of weight).

| Knob | Question it answers | Use it for |
|---|---|---|
| `applicableTo` | **Where** can this mod appear? | Slot identity. A belt should never roll flat damage because flat damage isn't part of belt's identity. |
| `weight` | **How often** does this mod appear in the eligible pool? | Fillerness. A high weight (1500–2000) means the mod crowds out premium mods on rare rolls. A low weight (400–600) means the mod is precious. |
| Tier ranges (`tiers`) | **How strong** is this mod when it rolls? | Power ceiling. Flatten the top tier to keep a mod from competing with premium mods in the endgame. |

The mistake to avoid: narrowing `applicableTo` to make a mod feel rarer. That actually makes it *more* desirable when it does land, because the player has fewer options for that slot. If you want a mod to be filler, raise its weight — don't restrict its slots.

### Reference weights

| Range | Role | Examples |
|---|---|---|
| 2000 | Vendor trash (no tags, no synergy pull) | (formerly Light Radius, removed) |
| 1500–1800 | Common filler | Thorns, Stun Duration, on-kill mods, reduced attribute requirements |
| 1000–1200 | Standard | Most damage rolls, on-hit mods |
| 500–600 | Strong | Attack speed, crit chance, life flat |
| 400 | Premium | Life Leech |

---

## On-hit vs On-kill: combat vs sustain

These two clusters look similar but answer to different slots, by design:

- **On-hit** (`lifeGainOnHitFlat`, `manaGainOnHitFlat`) rolls on **combat** slots: `weapon, ring, amulet, gloves`. Gloves count as combat (the limb that swings).
- **On-kill** (`lifeOnKillFlat`, `manaOnKillFlat`) rolls on **sustain** slots: `weapon, ring, amulet, belt`. Belt counts as sustain (the reserve pouch).

The slot lists for life and mana within each cluster are identical — only the cluster (on-hit vs on-kill) changes the slot set. Don't introduce asymmetries between life and mana versions.

---

## Invariants Worth Naming

Conditions that must always hold. If you find code that violates these, file it as a bug.

1. **Caster weapons (staff, wand) never roll local attack mods.** Flat physical, physical %, attack speed, elemental-to-attacks: none of these.
2. **Belt never rolls flat damage of any kind.** Flat physical, flat elemental to attacks, flat spell damage: none. Damage % (including crit chance % and crit multi %) is fine.
3. **Global defense % matches the base.** Armor% on plate, Evasion% on leather, Barrier% on silk. Mismatched rolls don't happen.
4. **Spell damage % on body armor requires silk base.** Plate and leather armor never roll spell damage %.
5. **Spell damage flat rolls only on caster weapons.** Not on jewelry, not on armor — only staff and wand.
6. **Attack speed % never rolls on attack weapons.** They have base attack speed; the mod rolls on jewelry and gloves.
7. **Magic find (item rarity) never rolls on weapons.** Rolls on all armor pieces, all jewelry, and the offhand. Thematically, MF is a "lucky gear" stat; a weapon's job is to hit.

---

## UI Invariants

- **Main screens never scroll.** Splash (`/`), character select, and world view must fit the viewport. Use `h-screen overflow-hidden` on the page root and constrain inner content (e.g., `max-h-[88vh]` for cards, `flex-1` for stretchy regions). Internal modals and side panels are allowed to scroll.
- **Single theme: dark/black.** No theme switcher. `<html>` has `class="dark"` permanently. Background is pure `#000000`.
- **Font: Jersey 25** (pixel display font) globally via `--font-sans`. Imported once in `styles.css`.
- **Buttons: black bg + white border + white text.** Hover lightens via `bg-white/10`. Purple is reserved for the title glow effect, not interactive elements.

---

## Stat Engine

A pure function in `src/game/stats/compute.ts` is the canonical source for "what stats does this character have right now?". Used by combat (server + client) and by the Show Stats panel.

Input: `{ classDef, level, equippedItems[] }`.
Output: `ComputedCharacterStats` — attributes (str/dex/int), life/mana max + regen, barrier max, armor/evasion/accuracy, resistances (cold/fire/lightning/void, all capped 75%), crit chance (capped 100%, floored 5%), crit multi, attack speed (attack path) / cast speed (spell path; base 1.0), flat damage per element per path, increased pools per category, more multipliers cascade, leech %, movement speed, magic find, life/mana on hit, life/mana on kill, block chance, thorns. Plus the `broken` set — item ids that failed the broken-state check.

Derivations the engine does itself: armor mitigation %, evasion-vs-typical-enemy hit-avoid %, total DPS estimate (path-aware). The engine does **not** roll dice — it only computes the static numbers. Per-hit rolls live in the combat loop.

The function is pure, deterministic, and dependency-free (no React, no Convex). Same inputs → same outputs. Recomputed wherever needed; not cached on the character document. The reactive Convex queries that feed it keep the UI in sync automatically.

## Equipment UX

Two parallel ways to equip an inventory item, both validated by the same `planEquip()` helper and committed by the same `equipItem` mutation. The UX has to handle a fundamental tension: most items have one obvious target slot, but rings and dual-wieldable 1H weapons have two valid targets.

### Drag-and-drop (primary)
The player drags an item out of the inventory grid and drops it onto a specific paper-doll slot. The target is explicit — the player aims at the slot they want. While dragging:
- Every *structurally* compatible slot (per `validSlotsForItem`) gets a soft yellow glow.
- The slot under the cursor brightens to a solid yellow ring.
- Incompatible slots under the cursor go red.
- Dropping on a yellow slot fires the mutation; dropping anywhere else cancels.

Drag-and-drop also works in reverse: dragging an equipped item back to the inventory grid unequips it.

### Click → dropdown menu (alternative)
Clicking an inventory item opens a small context menu next to it. Each valid slot appears as a separate action:
- Ring → "Equipar no Anel 1", "Equipar no Anel 2".
- 1H attack weapon / wand → "Equipar como Mão Principal", "Equipar como Mão Secundária".
- Anything with a single valid slot → "Equipar".

Equipped items get a single-action menu — "Desequipar".

The dropdown exists to disambiguate the case where drag-and-drop ambiguous targets would force the player to aim. It's never *required*, but it's the natural path when the player knows exactly which ring slot they want without aiming.

### Same-archetype rule for dual-wield
The off-hand slot accepts a weapon only if it matches the main-hand archetype. Attack 1H + attack 1H is allowed; wand + wand is allowed; sword + wand is rejected with a localized toast. This is enforced by `planEquip()` and surfaced to the player in three ways:
- Drag-and-drop: incompatible slot pulses red.
- Click dropdown: the off-hand entry doesn't appear at all when the archetype would conflict.
- Server: the mutation rejects with `mixed-archetype`, translated to "Não pode misturar arquétipos no dual-wield".

### Reactive feedback contract
All four equip-flow mutations (`equipItem`, `unequipItem`, `pickFromBag`, `discardFromBag`) carry `withOptimisticUpdate` — the UI must reflect the change *before* the server round-trips. The loot picker auto-closes the moment the bag goes to zero, regardless of whether that happened via "pegar tudo", "descartar tudo", or partial picks that incidentally emptied it. See ADR-0001 (Optimistic Mutations) for the architectural rationale.

## Show Stats panel

A modal opened from the "Show" button in the status card. Layout: `max-w-3xl`, four sections:

- **Atributos** — STR, DEX, INT totals.
- **Defesas** — Vida (current/max), Barreira (current/max + recovery state), Armadura (raw + derived mitigation % vs zone), Evasão (raw + derived avoid % vs zone), Resistências (four elements), Regen Vida, Bloqueio (when a shield is equipped).
- **Ofensiva** — header switches between `ATAQUE` and `CONJURAÇÃO` based on main-hand archetype. Shows DPS, attack/cast speed, flat damage range per element, crit chance, crit multi, accuracy, plus a sub-block of increased totals per category.
- **Utilidade** — movement speed, life/mana on hit, leech %, life/mana on kill, magic find.

Inactive path is hidden (sword equipped → no spell stats shown). Totals per category only — no per-source breakdown in this iteration.

---

## Out of Scope (for now)

- **Unique items** — hand-crafted rarity above Epic, planned. See `docs/plans/roadmap.md`.
- **Epic items in Act 1** — Epic drops are reserved for Act 2+.
- **Active skills with cooldowns** — planned, but only after all classes are implemented and the passive tree exists. The MVP combat loop has exactly one active control: the life potion.
- **Passive tree** — planned, between MVP combat and active skills.
- **Hub city** — the hub gets its own city (with vendor/stash/NPCs) only in late-game planning. For now the hub is pure navigation between acts.
- **% max life / % max mana mods** — intentionally removed, reserved for future power creep.
- **Light radius** — removed. The game is an auto-battler resolved by stats; there is no perception/sight mechanic for light radius to modify.
- **Stun duration** — kept in the pool as filler, but the stun mechanic itself is **not yet designed**. Treat existing tier values as placeholders. Once stun is specified (does the auto-battler simulate stun? as a damage window? as a global debuff?), revisit the mod.
