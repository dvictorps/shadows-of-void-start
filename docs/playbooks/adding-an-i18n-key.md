# Adding an i18n key

This playbook covers **paraglide keys** — the system for UI labels. The game also has two other i18n systems for content with grammatical concerns (item / monster names with gender concord) and for tooltip mod lines with value interpolation. Before assuming paraglide is the right tool, skim **[Which i18n system to use](./i18n-which-system.md)** — five seconds, saves a misplaced entry.

Every user-facing UI string goes through paraglide. The source files are `messages/pt.json` and `messages/en.json`. Both are required — pt is the base locale and en is the alternate.

## When you need a new string

1. **Open both `messages/pt.json` and `messages/en.json`** and add the same key with values for each locale:

```json
"my_new_key": "Texto em Português",
"my_new_key_with_param": "Você ganhou {amount} XP"
```

(EN file gets the English versions.)

2. **Place it semantically.** The files are loosely grouped (character-select keys near other character-select keys, status_* near status_*, etc.). Add yours next to its neighbors so future agents can find it by scanning.

3. **Use it via the `m` proxy:**

```ts
import { m } from "#/paraglide/messages";

<p>{m.my_new_key()}</p>
<p>{m.my_new_key_with_param({ amount: 12 })}</p>
```

Paraglide auto-regenerates `src/paraglide/messages.js` on the next dev run (or via `npx paraglide-js compile`). You don't normally need to run it manually — it picks up changes automatically.

## Conventions

- **snake_case** keys (`status_class_label`, not `statusClassLabel`).
- **Prefix by area** when you have several related keys: `inventory_*`, `stats_*`, `error_*`, `equip_*`, `loot_*`.
- **Plural variants** use `_one` / `_other` suffixes when count-dependent (see `inventory_free_slot_one`/`_other` for the pattern). The caller picks: `count === 1 ? m.x_one({ count }) : m.x_other({ count })`. Paraglide has built-in ICU plurals but we keep it explicit per call site.
- **Strings with params** use `{name}` braces. Paraglide validates that all locales include the same placeholders — if pt has `{amount}` and en doesn't, the build errors.

## Never hardcode user-facing text

If you find yourself writing a string literal in a `<button>`, `<p>`, `toast.*()`, or `aria-label`, stop and add a key. The error pattern is easy to spot in code review — Portuguese accents (`ção`, `ões`) or English UI words in component files.

The only exceptions:
- Debug-only text (never shown to users)
- Internal modifier ids, slot ids, etc — system identifiers, not display strings

## Server-side errors

Server errors thrown from convex mutations as `throw new ConvexError("Inventory overflow")` are in English by design (the server doesn't know the locale). The translation happens client-side via `src/lib/convex-errors.ts:translateServerError`, which pattern-matches known server strings and returns the right PT key.

When you add a new server error:

1. Throw with a stable, distinctive English string in the convex mutation.
2. Add matching `error_*` paraglide keys in both locales.
3. Add a pattern (exact match or regex) in `translateServerError` that returns the localized key.

See the existing patterns in `src/lib/convex-errors.ts` for the structure.
