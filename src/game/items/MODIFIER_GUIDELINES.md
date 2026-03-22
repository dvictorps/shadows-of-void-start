# Item Modifier Guidelines

Specific design rules for each modifier category. For general system docs (how to add mods, tier system, rarity limits), see `CLAUDE.md`.

---

## Block Chance

- Block chance is a **local stat** exclusive to shields (`offhand`).
- Shields have a **base block chance** in `baseStats` (e.g. `blockChance: 22` for Wooden Shield). Future shield bases may range 22–28.
- The modifier `blockChanceIncrease` is `increased` — it **multiplies** the base block chance: `base × (1 + value/100)`.
- This follows the same pattern as `localDefenseIncrease` and `criticalChance`: increased is always multiplicative on the base, never flat additive.
- The computed block chance appears in the tooltip header alongside armor/evasion (blue when modified by a local mod).
- The shield implicit (`+{value}% Block Chance`) is a separate flat bonus handled by the stat engine, not the item generator.

## Critical Strike Chance

- `increased` crit chance is **multiplicative** on the weapon's base crit: `base × (1 + value/100)`.
- It is NOT flat additive. This is an intentional design decision.
- Local crit mods only roll on attack weapons.

## Defense (Armor / Evasion / Barrier)

- `localDefenseFlat` and `localDefenseIncrease` use a generic "Defense" display that resolves to the correct label (Armor/Evasion/Barrier) based on the armor's `armorType` at roll time.
- `plate` → Armor, `leather` → Evasion, `silk` → Barrier.
- Global defense mods (`armorFlat`, `evasionFlat`, `barrierFlat`, `globalArmorIncrease`, etc.) are separate and handled by the stat engine.

## Attack Speed

- **Local** attack speed only rolls on weapons (via `statEffect: { target: "attackSpeed", operation: "increased" }`).
- **Global** attack speed (`globalAttackSpeedIncrease`) intentionally does NOT roll on weapons — only jewelry and gloves. This prevents double-dipping.

## Elemental Damage

- Flat elemental damage (`statEffect: { target: "elementalDamage", operation: "flat", element: "Cold" }`) adds a new elemental damage line to the weapon header.
- Each element has its own modifier (cold, fire, lightning). They are independent rolls with separate min/max values.
- Only rolls on attack weapons.

## Life / Mana

- `% max life` and `% max mana` mods were **intentionally removed** — reserved for future power creep.
- Flat life/mana are global mods handled by the stat engine.

## Mods That Are Intentionally Bad (High Weight)

| Mod | Weight | Reason |
|---|---|---|
| Light Radius | 2000 | Filler, dilutes mod pool |
| Thorns Damage | 1800 | Weak stat, common roll |
| Stun Duration | 1500 | Marginal value |

These exist to make good rolls feel rewarding. Do not lower their weight without discussion.
