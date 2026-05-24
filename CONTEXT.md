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

- **Zone node** — a combat location. The player enters, fights enemies (see Time Bar / Zone Miniboss), leaves, returns later. May be a regular zone, the act-boss node, or future variants.
- **City node** — a safe location with no mobs. Houses the act's **vendor** and gives access to the **stash**. Always one city per act, unlocked at act entry (the player starts the act with both the city node and the first zone node visible on the map).

### Zone
Synonym for a Zone node. Used in the rest of this document when the distinction from a city is contextual.

A zone has persistent states per character:
- **Incomplete** — never finished. Time bar resets every time the player leaves.
- **Complete** — the player killed the zone miniboss at least once. Stays this way forever. Re-entering the zone is allowed for farming; the miniboss can be summoned again by completing the encounter schedule.

A future **Boss pending** state is planned (see "Boss Deferral" below) but not implemented yet — today the bar filling spawns the miniboss immediately, no pause modal.

### Time Bar
The progress bar shown over the zone view that represents the player's transit through the zone. The bar advances only during **exploração** (gaps between encounters); it pauses during **combate** and during **acampamento**. When the bar fills (the zone's encounter schedule completes), the **next spawn is the zone miniboss** (or, in a future iteration, becomes summonable — see "Boss Deferral").

The fill resets to 0 every time the player leaves the zone with the miniboss unsummoned, and resets to 0 immediately after a miniboss kill so the farming loop can refill on the next entry.

The bar UI displays the player's progress through the schedule (cumulative exploration time over total scheduled exploration time). The exact remaining time is hidden; only the bar is visible.

### Combat Phases
Three distinct phases a player can be in inside a zone. They determine the bag retention rules on exit (see Loot Pipeline → Bag retention tiers):

- **Combate** — an enemy is active and the combat tick is running. Player swings, enemy swings, damage is applied.
- **Exploração** — no enemy on screen, the time bar is advancing. Conceptually, the player is "walking through the zone".
- **Acampamento** — bar paused, cinematic + modal active. The player is at a safe rest point (either baked into the zone schedule, or summoned via Incenso Etéreo).

### Encounter Schedule
Each zone declares how many encounters its bar contains and how those encounters are paced. The schedule is generated per entry — every visit rolls a new variation:

- **Encounter count** scales with the zone's position in the act: ~15 in entry zones (forest_starter), ramping up to ~30 in zones adjacent to the boss node.
- **Gap between normal spawns** is random within zone-declared bounds (e.g., 3–9 seconds of exploration).
- **Ambush events** are deliberate packs of mobs inserted at random positions in the schedule (1–2 per zone). Each pack is 3–5 mobs back-to-back with very short gaps (~0.8s), heavy magic-rarity rate. Packs interrupt the normal cadence; the UI signals an ambush moment.
- **Camp positions** are anchored proportionally to schedule length with a small jitter (±1 slot):
  - `< 20` encounters → 1 camp anchored at ~50%
  - `≥ 20` encounters → 2 camps anchored at ~33% and ~66%
- After all scheduled encounters are consumed, the next spawn is the zone miniboss.

The schedule lives as data per zone (`src/game/world/act-1.ts`). The combat engine reads and dispatches events; spawn mechanics use an abstract `spawn event` shape (e.g., `{ size: 1, kind, ... }`) so future multi-enemy combat (NvN) can plug `size: N` ambush events without changing the engine surface.

### Acampamento
A guaranteed rest point inside the zone. When the schedule reaches a camp slot, in place of the next spawn, the engine triggers a **camp cinematic**: the combat HUD fades out, ambient text fades in (zone-themed: e.g., "Sons da natureza calma...", "Um vento corre...", "O ar fica mais leve."), and finally a modal opens with two options:

- **Retornar à cidade com 100% do loot** — exits the zone via the standard `ExitZoneModal` with the full bag selectable. Player picks freely; nothing is capped or random.
- **Seguir em frente** — closes the modal; the bar resumes from where it was, the next scheduled encounter spawns. Zone progress is preserved.

Mechanical side effects during the camp:
- Bar is paused.
- Passive HP regen and barrier recovery tick naturally during the cinematic and modal time (no special "rest" UI — it's a side effect of being out of combat).
- The bag is preserved as-is until the player commits to either option.

Camps are the **only** path to retreating with 100% of the bag outside of a boss kill. This is the central economy lever of zone progression: planning around camp positions matters.

A future audio layer will play biome-specific ambient sounds during the cinematic (the project already has hit-sound infra to build on). Until that layer ships, the cinematic is text + fade only.

### Boss Deferral (planned, not implemented)
When the time bar fills, a pause modal will ask if the player wants to fight the boss now. If they decline, a persistent **"Invoke Boss"** button will appear in the zone UI. This button will survive leaving and re-entering the zone — the boss stays "pending" until killed. Until this lands, the bar-fill spawn happens automatically on the next mob roll.

### Zone Miniboss
A **rare-rarity** monster that spawns when the time bar fills in a normal zone. Picked uniformly from the zone's `monsterPool` and promoted to rare with 3 random modifiers (see Monster Modifier Pool). Drops better loot than mobs — see drop table. Respawns every time the bar is filled again, including after the zone is complete (so completed zones remain meaningful for loot farming).

After a miniboss kill the combat scene shows an inline "Zone Complete" panel where the enemy was: **continue farming** (combat resumes, the bar resets to 0 and the schedule is rerolled) or **retreat** (standard exit-zone flow with the loot picker).

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
- **Combat** — replaces the viewport with the active combat scene when the player enters a zone node. Enemy in center, enemy HP/name on top. The HP globe migrates from bottom-right (passive) to bottom-left (prominent). Consumables remain usable.

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

**Discarding from inventory.** The player can permanently delete an inventory item from the inventory modal's per-item menu. Rules mirror selling (see Vendor → Selling rules):

- **Only inventory items can be discarded.** Equipped gear must be unequipped first.
- **Discard is irrevocable.** The item is deleted from the items table; no Rubys are credited (the trade-off vs. selling at the vendor).
- **Discard requires confirmation.** A confirmation modal naming the specific item must be acknowledged before the delete commits.

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
4. **Equipment type** — uniformly distributed across all 9 types: weapon, helmet, chestplate, boots, gloves, offhand, ring, amulet, belt. No level gating — jewelry drops from level 1 alongside everything else.
5. **Weapon subtype** — when the rolled type is "weapon", subtype is uniform across all 9 weapon variants (sword/dagger/axe/etc). No class filter; loot is loot — trade will let players move gear between characters and accounts.
6. **Mods** — generated by the existing `generateItem({ rarity, itemLevel, equipmentType, weaponType })` pipeline.

### Potion drops
Independent of the equipment drop roll, every monster kill rolls a **20% chance to drop a life potion**. Potions are not entities in the items table — they are a count on the character doc — so the drop is **auto-collected**: the server increments `char.potions` directly and notifies the client. If the character is already at the 10-potion cap, the roll is **wasted silently** (no drop event, no overflow, no replacement). This gives runs a sustain stream without committing potions to the bag/inventory pipeline.

### Bag retention tiers
On exit, the share of the bag the player can keep depends on which **combat phase** the exit was triggered in. Camps are the only path to 100% outside a boss kill:

| Trigger | Phase | Bag retention |
|---|---|---|
| Boss kill | n/a | 100% (free pick) |
| Camp (baked or via Incenso Etéreo) → Retornar | Acampamento | 100% (free pick) |
| Retreat manual | Exploração | 30% (player picks which 30%) |
| Retreat manual | Combate | 30% (player picks which 30%) |
| Teleport Stone | mirrors phase above | 100% / 30% per phase |
| Death | n/a | 0% (full wipe) |

The **30% cap** (`floor(bag.length × 0.30)`, minimum 1 when bag has ≥1 item) is the punishment for unplanned exits: the player retains agency over *which* items survive, but loses the rest. The camp tier is the rewarded path — it's also the only spot where "Seguir em frente" preserves zone progress (any other exit ends the run).

### Inventory overflow and exit-modal flow
On exit from a zone (Retreat / Teleport Stone / Camp Retornar — death-respawn does NOT count, that's a wipe), the **exit modal** appears with every staged item.

- **Default state**: all items marked "keep".
- **Player toggles** individual cards to mark "discard".
- **"Get all"** button: marks every item as keep — disabled when total would exceed inventory free slots OR exceed the phase's bag cap (30% in exploração / combate).
- **Phase cap enforcement**: in exploração or combate, the count of items marked "keep" is capped at `floor(bag.length × 0.30)` (minimum 1). Attempting to exceed it disables the toggle on additional items until something is unmarked.
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
- **Content**: sprite from the item's template `icon` field, rendered pixel-perfect (`image-rendering: pixelated`, `object-contain`, ~`p-1.5` padding so the rarity frame breathes). Falls back to an equipment-type / weapon-type emoji (`WEAPON_EMOJI_OVERRIDE`, `EQUIPMENT_EMOJI`) when a template has no `icon` — used today for weapon types without art (dagger, mace) and as a permanent safety net.
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
- Each side has an **attack rate** (attacks per second). Example: a 1.8 attack-speed weapon resolves 1.8 hits/sec. Dual-wielders use the **average** of both weapons' base speeds, alternating which weapon swings each tick (see "Dual-wielding").
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

**Armor** (physical mitigation, PoE-style):
```
physicalReduction = armor / (armor + 10 × physicalHit)
cap = 85%
```
The denominator scales with the **size of the incoming hit**, not with the attacker's level. The same armor pool mitigates many small hits hard but barely dents one big hit — armor reads as a "tank against trash" stat, not a flat damage multiplier. Armor reduces only physical damage; elemental and void pass through untouched.

Historical note: an earlier prototype used a Last-Epoch-style denominator (`armor + 10 × enemyLevel`), which made a single chestplate produce ~90% physical reduction in Act 1 and rendered the character effectively immortal against trash. The PoE-style pivot exists to force build diversification (armor + barrier + resistances + evasion) instead of one stat solving everything. The build pressure this assumes only fully materializes once a big-hit source exists on the monster side — monster crit is queued in `docs/plans/in-progress.md` and gates the next balance pass.

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

**Block** — granted by **shields** (base + rolled mods) and by **attack dual-wielding** (flat +10% implicit). When a hit lands and is not evaded, roll once against `blockChance`. A blocked hit deals 0 damage to barrier/life but **does** trigger the attacker's on-hit (blocks are still "hits" for the attacker's purposes). Thorns still reflect to the attacker on block, regardless of whether the block came from a shield or from dual-wielding.

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
- **Rare** — used exclusively for **minibosses** (the bar-fill spawn). Higher-tier modifier rolls. Drops better loot.
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
Combat is otherwise automatic, but the player has **three active controls today**: using a **life potion**, using a **teleport stone**, and using an **incenso etéreo**.

- **Life Potion**: heals **20% of maximum HP**. Cap 10 carried. Obtained from the city vendor (10 rubys) or as a 20% monster drop (see Loot Pipeline → Potion drops). Potion button lives on the bottom-right of the combat view (next to the health globe) and on the map's status card.

- **Teleport Stone**: consumed to travel to any previously-visited node (entries in `unlockedNodes`). Single consolidated travel item — replaces the prior "stone-to-city + wind-crystal-to-other-nodes" split. Behavior:
  - **City destination**: short travel time (3s) and grants the standard heal + potion refill on arrival.
  - **Other nodes**: full travel time (~12s) and no heal — pure transport.
  - Respects `isNodeAccessible` — locked nodes (upstream zone not completed) are rejected even if previously visited.
  - **Bag retention follows the player's current phase** (see Loot Pipeline → Bag retention tiers): camp = 100%, exploração = 30%, combate = 30%. Stone is convenience: it skips the "retreat → map → consumable button" flow, lands the player at the chosen destination directly, and applies the heal/refill if that destination is the city.
  - Lore: a "memory keeper" — it can only take the player to places whose echo it already carries.
  - Uncapped. Vendor-only, 40 rubys.

- **Incenso Etéreo**: consumable that triggers the camp cinematic at the player's chosen moment. Used during **exploração**, the next spawn doesn't occur and the modal opens with the same two options as a baked camp (Retornar com 100% / Seguir em frente). May be **activated during combate** and is then **queued** — it doesn't interrupt the current fight; immediately after the current enemy is resolved, the cinematic plays. Activation may also occur mid-ambush; the current mob completes, the remaining mobs in the ambush pack do NOT spawn, the cinematic takes over. **Does NOT activate during a boss fight** (boss = full commitment).
  - Uncapped. **Drop only — never sold by vendors.** ~2-3% chance from any monster kill (independent roll, like potions). Lives on the character document as a counter (`char.etherealIncense: number`) until used.
  - Cinematic uses the same structure as baked camps with different flavor text (e.g., "A fumaça arcana se dissipa pelos ares.", "O ar pesado e os sons perturbantes se reduzem à música do ambiente.").
  - HUD button is the 4th active control in combat; greyed out during boss fight and while a camp cinematic is already active.

The travel consumable is tracked on the character document as `teleportStones`. The wind crystal counter was retired in this consolidation; if any legacy data has it, treat as zero.

Future skills will plug in as additional active controls; these three are the only ones in the MVP.

---

## Experience and Levels

- The level cap is **100**.
- **Geometric XP curve**: `xpToNextLevel(L) = 100 × 1.08^(L-1)`. L1→L2 costs 100 XP; L50→L51 costs ~4 342; L99→L100 costs ~203 681. Anchored at 100 to preserve the early-game pace. The 1.08 growth rate is **steeper than the monster XP scaling rate of 1.06** (see "Monster stat scaling"), so kills-per-level rises as the character climbs. Concretely, a Warrior killing only Goblins (baseXp 5) needs roughly **20 kills at L1, ~50 at L50, ~127 at L100**.
- The geometric cost curve is intentional: a linear curve combined with geometric monster XP rewards would make endgame leveling trivial (kills-per-level *falling* toward the cap), which is the inverse of the desired "leveling feels like real progress" pacing. The growth gap (1.08 / 1.06 = ~1.019 per level, ~6× over 99 levels) is calibrated to feel like an ARPG-lite — challenging without becoming a PoE-style hundreds-of-hours grind, which we lack the per-zone mob density to support.
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

### Vendor catalog (MVP)

| Product | Price | Cap |
|---|---|---|
| Life Potion | 10 Rubys | 10 |
| Teleport Stone | 40 Rubys | — |

Potions are capped because they're the active heal control — supply matters for combat balance. Teleport Stone is uncapped (player can stockpile arbitrarily many); its gameplay weight comes from the ruby cost, not from rationing. **Incenso Etéreo is not sold** — it drops from monsters only (see Active player input → Incenso Etéreo).

The catalog data lives in `src/game/vendor/products.ts`; adding a product means registering an id + price + emoji + (optionally) cap there. `convex/vendor.ts` → `vendorBuy` reads the metadata and walks one code path for all products.

### Selling rules

- **Only inventory items can be sold.** Equipped gear must be unequipped first. This forces an intentional action before the player loses an item they were actually using.
- **The vendor does not buy back consumables.** Potions (and future stones) are a one-way commitment once bought.
- **Sale is irrevocable.** The item is deleted from the items table and the character is credited Rubys atomically.

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
- **Increased Evasion** — harder for the player to land hits.
- **Increased Accuracy** — fewer player evasion procs.
- **Increased Cold Resistance** — mitigates cold damage.
- **Increased Fire Resistance** — mitigates fire damage.
- **Increased Lightning Resistance** — mitigates lightning damage.
- **Increased Void Resistance** — mitigates void damage.
- **Additional Barrier** — flat barrier pool above HP. Until monster barrier is implemented natively (see `docs/plans/in-progress.md`), the mod is folded into HP as a placeholder.
- **More Armor** — increased physical mitigation.

The pool will grow with later acts (on-hit effects, summons, auras), but Act 1 stays minimal.

Mods are picked **distinct** within a single monster (no duplicates). Magnitudes are **fixed** per mod (no per-roll variation) in the current iteration — variance comes from which mods land, not from how strong they roll.

### Affix split and naming

Each mod is tagged **prefix** or **suffix**:

- **Prefixes (adjectival)**: Increased Life, Increased Damage, Increased Evasion, Additional Barrier, More Armor.
- **Suffixes (noun)**: Increased Attack Speed, Increased Accuracy, the four elemental resistances.

A spawn rolls **at most 2 prefixes and 2 suffixes**, so a 3-mod rare always mixes both affixes. With **two or more elemental resistances** on the same spawn, they collapse into a single compound adjective ("Elemental Resistant" / "Resistente a Elementos") instead of stacking individual suffixes.

The display name is composed in two different ways depending on the active language — that's why each language owns its own lexicon, not the monster data:

- **English (`src/game/world/lexicon/en.ts`)** — PoE-style: `<prefix> <prefix> <Base> of <noun> and <noun>`. Adjectives stack before the base; the compound rolls into the prefix stack ("Armored Elemental Resistant Goblin").
- **Portuguese (`src/game/world/lexicon/pt.ts`)** — adjectives trail the base and agree with the monster's grammatical gender. Suffix nouns carry their own gender so the renderer can pick the right article ("do Frio", masculine; "da Velocidade", feminine). Two suffix phrases join with " e ". The compound ("Resistente a Elementos") trails the regular adjectives. Examples: "Goblin Furioso da Velocidade e do Frio", "Serpente Blindada Resistente a Elementos".

Adding a new gendered language is purely a lexicon entry — monster data stays language-neutral. Adding a non-gendered language follows the EN shape (no `monsterGender` field, no gendered forms).

### Rare proper names

**Rares don't use the mod-based naming at all** — they get a randomly-composed proper name from two word pools plus a single epithet that hints at their top mod. The full list of rolled mods still appears in the tooltip body; the name itself is identity, not a stat readout. This mirrors how Path of Exile handles its rare monsters.

Each spawn samples three uniform-[0, 1] seeds at spawn time (`Enemy.nameSeed = { primary, secondary, epithet }`). The renderer maps those onto the active locale's pools, so re-renders and locale switches keep the name stable for the spawn's lifetime; only a fresh spawn rolls a new name.

- **English** — first word concatenated with second word, then `, the <Epithet>`: "Stonemaw, the Furious", "Frostfang, the Elusive".
- **Portuguese** — first noun + a `de`/`do`/`da` phrase, then `, o <Epithet>` (always masculine — monsters are genderless entities; words have gender, but the epithet titles the creature, not the word): "Garra de Aço, o Furioso", "Coração das Sombras, o Inquebrável".

The epithet is derived from the mods:

- Default: the rare's first **prefix** mod selects the epithet pool (Damage → "the Furious / the Vicious / the Cruel / the Savage", etc.). Variants in the pool add variety without breaking the mod-signal.
- Compound rule (2+ resists): the epithet pool swaps to "the Unbroken / o Inquebrável"-style titles instead of literalizing "Elemental Resistant" in the name.

Magic monsters keep the affix-based naming above ("Goblin Furioso da Velocidade"). Only rares get the proper-name treatment.

### Magic mob spawn rate
10% of mid-zone spawns are magic; the rest are normal. The bar-fill spawn (miniboss) is always rare regardless. Mobs that are part of an **ambush event** override the 10% baseline with the ambush's own magic rate (~60% per `pack.magicChance` — see Encounter Schedule).

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
Mobs live in **game data**, not the database. Each zone declares a **pool of eligible mobs**; combat sessions roll spawns from that pool. Mob templates declare **level-1 base stats** (HP, attack speed, damage, defenses) and any flavor-specific behavior; the instance-level scaler (see "Monster stat scaling") inflates the power stats at spawn time, and modifiers are layered on top for minibosses.

### Monster damage types
Monsters express damage with the **same shape as the player's swing**: `physicalDamage: {min, max}` (defaults to `{min: 0, max: 0}`) plus `elementalDamage: ElementContribution[]` (defaults to `[]`). The per-hit roll mirrors `rollPlayerSwing`: roll a flat amount per type, then mitigate physical via armor and each element via its resistance. A monster can be **single-type** (Goblin = `{physicalDamage: {min: 8, max: 12}, elementalDamage: []}`), **single-element** (Lich = `{physicalDamage: {min: 0, max: 0}, elementalDamage: [{element: "Cold", min: 12, max: 16}]}`), or **hybrid** (Vampire = both `physicalDamage` and one or more `elementalDamage` entries). The combat engine handles all three without branching — the damage types just sum.

### Zone level and monster instance level
Each combat **zone node** declares its `level: number`. When a mob spawns, the server rolls its **instance level** as `zoneLevel + random(-1, 0, +1)` — the same monster template scales slightly so the zone still feels varied. The instance level is what determines drop **item level** (ilvl) and gates equipment types that can drop (see Loot Pipeline → Drop pool). It is also the multiplier used by the stat scaler below.

### Monster stat scaling
A monster's template stats are declared as **level-1 baselines**. At spawn time, a pure scaler multiplies the power stats by a **geometric factor** of the monster's instance level:

```
scaleFactor(L) = 1.06 ^ (L - 1)
```

- **HP**, **physical damage** (min/max), **elemental damage** (min/max), and **XP reward** are each multiplied by `scaleFactor(instanceLevel)`. So a Goblin defined as `{hp: 10, physicalDamage: {min: 8, max: 12}, xpReward: 5}` at instance level 50 effectively has ~174 HP, ~139–209 physical damage per swing, and rewards ~87 XP. At instance level 100, the factor is `1.06^99 ≈ 320`: ~3 201 HP, ~2 561–3 841 damage, ~1 600 XP.
- **Attack speed** does **not** scale — it's a "feel" stat that anchors each monster's archetype (slow brute vs. fast assassin). A level-100 Goblin still swings 1.2 times/sec.
- **Defenses** (armor, evasion, resistances) stay at the template baseline (zero for all normal mobs today). Rare/miniboss modifiers layer on top of the scaled base.

The scaler runs at spawn time on the client (combat sim reads the scaled stats) and at kill time on the server (XP credit, drop ilvl). The client passes the spawn level to the server in `recordKill` so both agree on the effective stats. Per-monster identity (tank, swarmer, caster) is expressed by the **shape of the level-1 baseline** (high HP / low damage / slow AS for a tank, low HP / high damage / fast AS for a glass cannon), not by per-monster scaling curves. A single `g = 1.06` keeps every monster's curve predictable.

The curve is intentionally **geometric** because player power grows multiplicatively (gear stacks `% increased` pools, flat damage from rings, crit multipliers). A linear `× level` curve was prototyped but rejected: it would make endgame monsters trivial against gear-scaled player damage. Geometric scaling mirrors how PoE/Last Epoch/D3 handle area-level monster stats — they all use exponential curves with similar growth rates (~1.05–1.08 per level). XP scaling at 1.06 is paired with an even-steeper **1.08 XP cost curve** (see "Experience and Levels"), so kills-per-level *grows* with the character: ~20 Goblins at L1, ~50 at L50, ~127 at L100. The cost-vs-reward gap is the lever that makes leveling feel like real progress.

---

## Travel system

Movement between nodes on the act map is **time-gated**. A character is always "at" a node (`currentLocation`). To get to a different node they must **travel** — the trip takes seconds in real time, during which the player can't enter zones but can still browse stats, inventory, settings, etc. When the trip completes, the player automatically arrives at the destination and (for zone / city nodes) the view transitions into that area.

### Travel time
Each `NodeConnection` carries a **distance** in abstract units. The travel time formula lives in `src/game/world/travel.ts`:

```
time_seconds = max(0.5, distance / (1 + 2 × movementSpeed/100))
```

The 2× coefficient on movement speed is intentional — boots can roll up to ~30% MS in early game and we want the player to *feel* that gear choice on the world map, not see a barely-perceptible improvement. The 0.5s floor keeps travel always visible.

### Unlocked nodes
Every time the player arrives at a node (via any travel mechanic) the destination is appended to the character's `unlockedNodes` set. The character starts with `["city"]` on creation. This set is **append-only** — respawn doesn't clear it, leaving the world a one-time discover-then-fast-travel-back. Teleport stones consume this list to validate jump targets; nodes outside the list are inaccessible to stones even if they're shown on the map.

### Progression gating
A connected combat node is **only travel-eligible if the player has completed the upstream zone**. Concretely:

- The graph imposes a partial order: the city's only outgoing edge is `forest_starter`, which is its own gate (no upstream); `forest_profunda` requires `forest_starter` complete; `pantano` requires `forest_profunda`; and so on through the linear chain.
- City is always travel-eligible — it's the safety hub, no upstream gate.
- Attempting to travel to a locked node surfaces a toast (`"Complete a zona anterior"`); the map's "you are here" pin stays put.
- Teleport stones still respect this gate — jumping to a locked node is rejected (regardless of `unlockedNodes` membership).

A zone enters the **Complete** state by killing the miniboss at least once (see Zone states). The time-bar progress for the current visit lives on the character document; the Complete set is persistent and per-character.

### State on the character document
Four fields capture the player's location on the act map:

- `currentLocation` — the node id the character is at. Defaults to `"city"` on character creation and on respawn. **During travel it intentionally remains pointing at the source node** — that's what keeps the yellow "you are here" pin anchored to where the player departed from until arrival commits.
- `travelDestination` — set to the target node id at travel start; cleared on arrival.
- `travelStartedAt` — Unix ms timestamp the trip began. Used by the client to render the progress bar correctly even after a page refresh (without it, the bar would jump from 0 to 100% in the final second).
- `travelArrivesAt` — Unix ms timestamp the trip completes. The client uses this to schedule the auto-arrival mutation. Server validates it (with a small grace window for clock skew) before allowing `arriveAtTravel` to complete.

### Behaviour rules
- **Re-entering the same node is instant.** If the player retreats from a zone and clicks the same node again, no travel — they're already there.
- **Disconnected nodes can't be travelled to directly** by walking. Teleport stones unlock that path — clicking an unconnected node on the map opens a stone-confirmation if the node is in `unlockedNodes` and not zone-locked. Without a stone, the toast is "no route".
- **Travel survives refresh.** `travelArrivesAt` lives in the DB. On reload the client recomputes remaining time and schedules `arriveAtTravel` accordingly. Tab closed for longer than the travel? The next load arrives immediately.
- **No mid-travel actions.** Combat doesn't tick (the character isn't in any zone), `enterZone` rejects while travelling, and there's no cancel button. Future: teleport stones interrupt in-flight travel and re-target to the chosen destination.
- **Death resets to the city** and clears any in-flight travel.

### UI
The map view's nodes carry a yellow `MapPin` icon over the node matching `currentLocation`. During travel, a thin progress bar pins to the bottom of the world view (above the bottom of the section) showing the from/to and seconds remaining. The map's nodes are intentionally small (`h-7 w-7` ≈ 28px) so the icon overlay reads as a separate decoration rather than competing with the node itself.

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

### Off-hand (`offhand` slot)
A flexible slot. Four kinds of items can occupy it, each driving distinct behaviour:

**Shield** (`equipmentType: "offhand"`) — defensive identity, light hybrid potential. Rolls:
- Local defense (same resolution as armor — armorType determines armor/evasion/barrier)
- Block chance (only off-hand kind that does)
- Thorns
- Defensive utility

The shield does not swing — it adds its stats to the character's totals and that's it.

**Off-hand weapon (dual-wielding)** — see "Dual-wielding" below.

**Tome** (`equipmentType: "tome"`) — caster off-hand. Silk-base only (contributes barrier). **The only off-hand without block chance**, by design. Mod pool focused on spell amplification:
- Local barrier (flat + %), spell damage %, cast speed %, mana flat + regen
- Resistances, intelligence, magic find, crit chance / multi
- A **tome-exclusive** family: `+X% of Spell Damage as Extra Cold / Fire / Lightning / Void Damage` (see "Gain as Extra Elemental" below)
- Universal implicit: `+X% increased Spell Damage`
- Tome rolls **no life flat or regen** — barrier-only identity. Differentiates from silk armor (which rolls both).

**Quiver** (`equipmentType: "quiver"`) — bow-bound off-hand. Mod pool focused on attack amplification:
- Flat physical damage to attacks, flat elemental (per element) damage to attacks (global versions — see Modifier Categories)
- Attack speed, crit chance, crit multi, accuracy
- Life flat, life-on-hit, mana-on-hit, resistances, dexterity, magic find
- Universal implicit: `+X% increased Attack Speed`
- Quiver has **no defensive base stats** — it's a pure damage / utility off-hand.
- **Equip restriction**: the main hand must hold a `bow`. See "Bow + Quiver" rule below.

### Dual-wielding
A second one-handed weapon may go in the off-hand slot. When both hands hold a weapon, the character is **dual-wielding** and the off-hand contributes its own swings on top of the main hand's.

**Slot eligibility**:
- One-handed attack weapons (`sword`, `dagger`, `axe`, `mace`) can occupy main hand **or** off-hand.
- One-handed caster (`wand`) can occupy main hand **or** off-hand.
- Two-handed weapons (`greatsword`, `twoHandedAxe`, `staff`) occupy main hand **and block the off-hand slot** — equipping a 2H weapon while an off-hand item is equipped auto-unequips the off-hand back to inventory.
- **Bow is the exception**: 2H, blocks shields/tomes/off-hand weapons, but **accepts a quiver** in the off-hand (see "Bow + Quiver" below).
- Shields and tomes are off-hand only (never main hand).
- Quivers are off-hand only AND require a bow in main hand.
- **If the main hand is empty, the off-hand cannot hold a weapon.** Unequipping the main hand while the off-hand holds a weapon promotes the off-hand into the main-hand slot (the off-hand slot then becomes empty). Symmetric to the 2H rule above. Shields and tomes stay in the off-hand when the main hand is empty — neither swings, so neither can be promoted. **A quiver does not stay**: unequipping the bow main hand auto-unequips the quiver to inventory (see "Bow + Quiver").

**Same-archetype rule**: dual-wielding requires both weapons to share archetype. Attack 1H + attack 1H is allowed (sword + dagger, axe + sword, etc.). Caster 1H + caster 1H is allowed (wand + wand — the only caster combination). **Mixed archetype is rejected** (no sword + wand). This keeps the combat tick model coherent — one path (attack or spell) active at a time.

**Combat behaviour**:
- Combined tick rate = `average(mainHand.attackSpeed, offHand.attackSpeed)` (or `castSpeed` for caster pairs). Attack dual-wielding multiplies that average by an additional **+10% (more multiplier)** as an implicit style buff; wand+wand uses the plain average with no buff.
- Ticks **alternate**: tick 1 = main hand swings, tick 2 = off-hand, tick 3 = main hand again. The swinging weapon's local stats (base damage, local mods, weapon-specific crit chance) source that tick's damage.
- Global modifiers (`+X% Increased Physical`, `+X Strength`, global crit chance/multi, resistances, attributes) apply on **every** swing, regardless of which weapon is active.
- Cast speed base is `1.0` for caster weapons (no per-template base); cast speed mods scale that baseline.

**Attack dual-wielding implicits** (attack-1H + attack-1H only): **+10% attack speed** (applied as a more multiplier on top of the averaged base) and **+10% block chance** (additive to `blockChance`, still bound by the 75% block cap). Wand+wand does not receive either buff.

The trade-off vs shield: shield offers higher block ceilings, thorns rolls, and defensive stats from a dedicated slot; attack dual-wielding offers a second weapon's local mods (flat damage, local AS/crit) plus the modest +10% AS / +10% block implicits.

### Bow + Quiver
Bow is the only 2H weapon that **accepts a quiver in the off-hand**. The other 2H weapons (greatsword, twoHandedAxe, staff) keep the standard "2H blocks off-hand" rule. This mirrors PoE's bow + quiver pairing.

Quiver is **bow-bound**: it can only contribute stats while a bow is in the main hand. The rule is enforced two ways:

- **Equip-time enforcement (planEquip)**: violating the rule auto-unequips the conflicting item to inventory.
  - Equipping a quiver while main hand isn't a bow → rejected unless the player also equips a bow in the same action (manual sequence: equip bow first, then quiver).
  - Equipping a shield/tome/off-hand weapon to off-hand while bow is in main hand → displaces the bow (the bow can't coexist with non-quiver off-hands). The shield/tome/weapon wins; bow goes to inventory.
  - Equipping a non-bow weapon to main hand while quiver is in off-hand → both the old main and the now-orphan quiver are displaced to inventory.
  - Unequipping the bow while quiver is in off-hand → quiver also goes to inventory (orphan auto-cleanup).
- **Broken-state safety net**: if a quiver ever ends up equipped without a bow in main hand (data inconsistency, dev tools, future bug), the stat engine marks it broken — it contributes zero stats until the player equips a bow. Same semantics as attribute-requirement broken-state.

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
| Local defense | flat defense, % defense | Armor, shields, tomes |
| Spell damage flat | `+X Fire Damage to Spells` | Caster weapons only |
| Global damage % | `+% Fire Damage`, `+% Spell Damage` | Weapons, jewelry, gloves (some); silk helmet/chestplate + tomes for spell damage |
| Global damage flat | `+X Physical Damage to Attacks` | Ring, amulet, gloves, quiver (never belt) |
| Global elemental flat to attacks | `+X Fire Damage to Attacks` | Ring, amulet, quiver |
| Gain as extra elemental | `+X% of Spell Damage as Extra Cold Damage` | Tomes only |
| Accuracy | flat accuracy | Attack weapons, ring, amulet, gloves, helmet, quiver |
| Crit multi (flat-additive %) | `+X% Critical Strike Multiplier` | Weapons, ring, amulet, gloves, tomes, quivers |
| Life / mana | flat, regen | Armor, jewelry; mana also on caster weapons and tomes; quiver rolls life flat + life-on-hit + mana-on-hit |
| Resistances | cold/fire/lightning/void | Armor, jewelry, tomes, quivers |
| Attributes | str/dex/int | Armor, jewelry; tomes (int), quivers (dex) |
| Utility | movement speed, stun duration, reduced attribute requirements | Boots, gloves, belt, armor (varies per mod) |
| Magic find | item rarity (prefix + suffix) | Every slot except weapons (armor, jewelry, offhand kinds — shield, tome, quiver) |

### Gain as Extra Elemental (tome-exclusive family)

A new modifier family unique to tomes: `+X% of Spell Damage as Extra <Element> Damage`, one mod per element (Cold, Fire, Lightning, Void). Multiple may roll on the same tome.

**Math.** After the spell-path swing rolls its base spell damage per element and applies the `increased` pool, each `gainAsExtra` mod adds a sibling damage chunk: `baseSpellDamageTotal × (X / 100)` is added to the matching element's damage **before mitigation**. The converted chunk is then mitigated by the target's resistance for that element (so a Fire-gain bonus is reduced by fire resistance, regardless of which source it converted from).

**Stacking.** Stacks additively per element across mods (two `tomeGainAsExtraFire` rolls of 5% and 7% → 12% of spell damage added as fire). Cross-element gains don't interact (a Fire-gain mod and a Cold-gain mod produce independent fire and cold chunks).

**Why tome-only.** It mirrors how `+X Cold Damage to Spells` is staff/wand-exclusive — each item category gets one signature damage-source mechanic. Tome's mechanic scales with the player's existing spell damage (a multiplicative-feel lever), while wand/staff flat damage adds raw numbers (an additive baseline). The two play differently and stack cleanly.

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
5. **Spell damage flat rolls only on caster weapons.** Not on jewelry, not on armor, not on tomes — only staff and wand. Tomes get a different signature mod (gain-as-extra elemental); they don't infringe on the wand/staff flat-damage identity.
6. **Attack speed % never rolls on attack weapons.** They have base attack speed; the mod rolls on jewelry, gloves, and quivers.
7. **Magic find (item rarity) never rolls on weapons.** Rolls on all armor pieces, all jewelry, and every off-hand kind (shield, tome, quiver). Thematically, MF is a "lucky gear" stat; a weapon's job is to hit.
8. **Tome never rolls block chance.** It's the only off-hand kind without block — the absence is the identity. (Shields and the dual-wield implicit are the two block sources.)
9. **Quiver requires a bow in the main hand.** Equip-time check rejects/displaces; the stat engine marks an orphaned quiver as broken (zero contribution) until a bow is re-equipped.
10. **Gain-as-extra elemental rolls only on tomes.** It is to the tome what flat-damage-to-spells is to wand/staff: one signature damage-source family per item category.

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

Inventory items also expose a final **"Descartar"** action, placed after every equip option and separated from them, that permanently deletes the item (see Inventory → Discarding rules). Equipped items get a single-action menu — "Desequipar"; there is no "Descartar" on equipped items by design.

While an inventory dropdown is open, item tooltips remain visible but **reposition to dodge the menu** instead of sliding behind it: the tooltip pushes past the menu's right edge (or, when flipped, past the menu's left edge). Tooltips and the dropdown coexist so the player can read item stats while choosing a slot.

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
