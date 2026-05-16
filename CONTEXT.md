# Shadows of Void — Context

Canonical glossary for the item domain. Defines what each term **means** in the game, not how the code implements it. When the code disagrees with this document, fix the code.

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
Currently restricted to **shields** — defensive identity with light hybrid potential. Rolls:
- Local defense (same resolution as armor)
- Block chance
- Thorns
- Defensive utility

Dual-wielding (two attack weapons, no shield) is on the roadmap but not yet modeled; when added, the second weapon will likely not occupy the `offhand` slot — TBD.

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

## Out of Scope (for now)

- **Unique items** — hand-crafted rarity above Epic, planned. See `docs/plans/roadmap.md`.
- **Dual wielding** — two attack weapons instead of weapon+shield. Slot model TBD.
- **% max life / % max mana mods** — intentionally removed, reserved for future power creep.
- **Light radius** — removed. The game is an auto-battler resolved by stats; there is no perception/sight mechanic for light radius to modify.
- **Stun duration** — kept in the pool as filler, but the stun mechanic itself is **not yet designed**. Treat existing tier values as placeholders. Once stun is specified (does the auto-battler simulate stun? as a damage window? as a global debuff?), revisit the mod.
