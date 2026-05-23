# Which i18n system do I use?

The game has **three** translation systems running in parallel. Each exists for a reason — picking the wrong one breaks runtime fallback paths or makes future locales painful. This doc is the decision tree.

## Decision tree

**Q1: Is the string a UI label that doesn't change per-item / per-monster?**
(Button text, panel header, error message, settings option, modal title, etc.)

→ **Paraglide messages** — `messages/{en,pt}.json` + call as `m.key_name()`.

**Q2: Is the string a noun phrase whose translation depends on grammatical gender or context (per item, per monster)?**
(Item names like "Espada Sagrada" / "Espada Sagrado", monster names with adjective concord.)

→ **Lexicon** — `src/game/items/lexicon/{en,pt}.ts` (items) or `src/game/world/lexicon/{en,pt}.ts` (monsters).

**Q3: Is the string a stat description that interpolates a rolled numeric value, and might have different word order in PT vs EN?**
(Mod tooltip lines like "+15 Physical Damage to Attacks" / "+15 de Dano Físico em Ataques".)

→ **mod-i18n.ts** — `src/game/items/mod-i18n.ts:PT_EXPLICIT_FORMATTERS`.

## When each system applies

### Paraglide (`messages/{en,pt}.json` + `import { m } from "#/paraglide/messages"`)

**Use for**: static UI strings — every button label, every panel header, every error, every modal title. Anything that the player sees in the chrome around the game, not in the game data itself.

**Conventions**:
- Keys are snake_case, namespaced by surface (`stats_*`, `tooltip_*`, `vendor_*`, `loot_*`).
- Parameterized via `{name}` placeholders, called as `m.foo({ name: "x" })`.
- Both `en.json` and `pt.json` MUST have every key — paraglide errors at compile.
- Adding a new key: see `docs/playbooks/adding-an-i18n-key.md`.

**Don't use for**:
- Per-item names (the player sees thousands of these — paraglide isn't built for game data with grammatical concerns)
- Tooltip mod lines (those need runtime value interpolation with min-max range support; paraglide can't reach in)

### Lexicon (`src/game/items/lexicon/`, `src/game/world/lexicon/`)

**Use for**: noun phrases whose translation depends on **grammatical gender** or **adjective concord** in PT. Item base names + magic-item affix forms; monster names + monster modifier adjectives.

**Why it exists**: paraglide treats every string as opaque. If you want "Iron Sword" → "Espada de Ferro" (PT material phrase appended) and the same modifier "Hallowed" to render as "Sagrada" on a sword (feminine) but "Sagrado" on a helmet (masculine), you need a lookup table that carries gender alongside the noun. Paraglide can't model that without exploding into key-suffix soup.

**Conventions**:
- One file per locale: `lexicon/en.ts`, `lexicon/pt.ts`. Both `export` an object matching the `ItemNameLexicon` (or `MonsterNameLexicon`) interface.
- The interface uses `Record<TemplateBaseId, ...>` etc. — literal-union keys. Forgetting a key in either locale is a compile error.
- PT entries carry `gender: "m" | "f"` on bases; modifiers that inflect are `{ m, f }` GenderedForm objects.
- Composition logic lives in the renderer (`item-name.ts`, `world/i18n.ts`), NOT in the lexicon data.

**Don't use for**:
- UI labels (use paraglide — lexicons aren't meant to be exhaustive for chrome)
- Tooltip mod lines (use mod-i18n — different concern: value interpolation + word order)

### `mod-i18n.ts` (`src/game/items/mod-i18n.ts`)

**Use for**: the rendered text of a rolled item mod inside the tooltip body. Things like `"+15 Physical Damage to Attacks"` (EN) / `"+15 de Dano Físico em Ataques"` (PT). Each mod has its own format that interpolates the rolled value.

**Why it exists**:
- EN renders by interpolating the mod's `displayFormat` (`"+{value} Physical Damage to Attacks"`) at display time — automatic, no per-mod EN entry needed.
- PT word order, gender concord, and idioms don't map cleanly from the EN format. So PT has a per-modifierId formatter table (`PT_EXPLICIT_FORMATTERS`) where each entry returns the rendered string.
- The renderer also passes the `item` so slot-aware modifiers (local defense) can pick the right noun (Armadura / Evasão / Barreira).

**Conventions**:
- Keyed by `modifierId`. EN derives from `MODIFIERS[id].displayFormat`; PT uses the formatter table.
- A new modifier needs an entry in `PT_EXPLICIT_FORMATTERS` to render in PT (otherwise falls back to the EN displayFormat).
- For implicits (whose displayFormat lives on the template, not on `MODIFIERS`), `PT_IMPLICIT_PATTERNS` does regex-based translation.

**Don't use for**:
- Item base names or magic-item affix words (use lexicon — different concern: noun phrases with concord)
- UI labels (use paraglide)

## "Where do I put it" cheatsheet

| Surface | System |
|---|---|
| Settings panel labels | Paraglide |
| Error toast messages | Paraglide |
| Stat panel section titles | Paraglide |
| Status card numeric labels ("Vida", "Mana") | Paraglide |
| Item name in tooltip header ("Espada de Ferro") | Lexicon |
| Monster name in combat header | Lexicon (world) |
| Magic-item compound name affix ("Sagrada" prefix) | Lexicon |
| Tooltip mod line ("+15 de Dano Físico em Ataques") | mod-i18n |
| Tooltip implicit line ("+50 Vida") | mod-i18n PT_IMPLICIT_PATTERNS |
| Damage popup numbers | Paraglide (the label, e.g. "Crítico!") |
| Zone name on the map ("Floresta Profunda") | Paraglide |

## Cross-system rules

- **One modifier = TWO i18n entries** (lexicon affix form + mod-i18n tooltip line). They translate the same modifier but for different displays. Adding a new mod without both is fine TypeScript-wise (the lexicon Records are `Partial<Record<...>>`) but produces the modifier id as a string fallback in whichever surface lacks the entry.
- **A new template = ONE possible new lexicon entry pair** (base + modifier, if they don't already exist in `template-ids.ts`). See `adding-an-equipment-template.md` step 4.
- **A new monster = ONE lexicon entry** in the monster lexicon. See `adding-a-monster.md`.
- **A new UI string = ONE paraglide entry** in both `messages/en.json` AND `messages/pt.json`. See `adding-an-i18n-key.md`.

## Why three systems instead of one

Tried in PR #41 and rejected:

- **Just use paraglide for everything**: gender concord turns into `prefix_hallowed_m` / `prefix_hallowed_f` key explosions. Paraglide's parameter system doesn't model "pick masc/fem based on a separate runtime value". Possible with conditionals but messy at scale.
- **Just use a single lexicon with all UI strings inside**: lexicons run through the renderer, which means every UI label would need a render step. Paraglide's static-extract-at-build-time pipeline is faster and supports tooling (lint for missing keys, future translation platforms).
- **Just use mod-i18n.ts for everything mod-related**: doesn't handle compound naming because tooltip mod lines and magic-item affix names are different shapes. Forcing one table to do both creates per-entry conditional logic.

The split mirrors three different problems with three different solutions. The cost is the discipline to know which to use — hence this doc.
