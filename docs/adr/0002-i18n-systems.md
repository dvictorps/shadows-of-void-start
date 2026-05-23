# 0002 — Three i18n systems instead of one

**Status**: Accepted
**Date**: 2026-05-23

## Context

The game ships text from three distinct shapes:

1. **Static UI strings** — buttons, panel headers, error toasts, modal titles. Thousands of small invariant labels. No grammatical context per call.
2. **Item / monster names** — composed at runtime from `(base, modifier)` tuples. Portuguese needs gender concord between noun and adjective (`Espada Sagrada` vs `Capacete Sagrado`); English doesn't.
3. **Tooltip mod lines** — rendered with a rolled numeric value interpolated (`+15 de Dano Físico em Ataques`). PT word order, prepositions, and idioms don't always line-up to the EN format.

Each shape has its own constraints. Forcing one i18n system to handle all three either explodes the key namespace (modifier × gender = duplicate keys per locale) or pushes runtime composition into places that should stay static.

PR #41 (the lexicon refactor) explicitly considered unifying the three systems and rejected each unification — the analysis was load-bearing on every subsequent translation decision, and the playbook [`i18n-which-system.md`](../playbooks/i18n-which-system.md) explains the *how*. This ADR captures the *why* so a future contributor doesn't redo the analysis.

## Decision

Three parallel systems, each owning one shape:

### Paraglide (`messages/{en,pt}.json` → `src/paraglide/`)

For static UI labels. Builds at compile time into typed message functions (`m.button_save()`). Both locales must carry the same keys and the same parameter shape — the compiler errors otherwise. Tooling for missing keys / future translation platforms is mature.

### Lexicon (`src/game/items/lexicon/`, `src/game/world/lexicon/`)

For noun phrases with grammatical concord. One file per locale, both export the same typed interface (`ItemNameLexicon`, `MonsterNameLexicon`). PT entries carry `gender: "m" | "f"` on bases; modifiers that inflect are `{ m, f }` `GenderedForm` objects. Composition logic lives in a renderer per domain (`translateItemName`, `translateMonsterName`). The interface uses literal-union `Record<...>` keys — forgetting a base or modifier in either locale is a compile error.

### `mod-i18n.ts` (`src/game/items/mod-i18n.ts`)

For the rendered text of a rolled item modifier inside the tooltip body. Keyed by `modifierId`. EN derives from each modifier's `displayFormat` automatically (sprintf-style interpolation of the rolled value). PT has a per-modifierId formatter table because word order, gender, and idioms don't map cleanly from the EN format. Implicits (which don't carry a modifierId on the rolled row) match via regex against the literal EN displayFormat.

## Why not unify

### Just use paraglide for everything

Tried; rejected. Gender concord turns into `prefix_hallowed_m` / `prefix_hallowed_f` key explosions, and paraglide's parameter system doesn't model "pick masc/fem based on a separate runtime value the caller passes." Achievable with branchy ICU plurals, but at the cost of every PT entry being a conditional — a maintenance trap that gets worse with every new modifier × base pairing.

### Just use a single lexicon for everything (including UI strings)

Tried; rejected. Lexicons run through a per-call renderer (`translateItemName`, `translateMonsterName`) — that's the whole point, since the output depends on the input data. Routing every UI label through a renderer wastes the static-extract-at-build-time pipeline paraglide already provides, and loses ecosystem tooling (missing-key lint, future translation platform integrations).

### Just use mod-i18n for everything mod-related (rolled lines + magic compound names)

Tried; rejected. Tooltip mod lines and magic-item affix names have different shapes. The tooltip is a sentence with value interpolation (`+15 de Dano Físico em Ataques`); the compound name is one word in a noun phrase (`Espada Sagrada Poderosa`). Forcing one table to do both creates per-entry conditional logic that hides the shape mismatch instead of resolving it.

## Trade-offs

**Cost we paid:**

- Three systems = three places to learn before adding a new modifier (lexicon prefixForms + mod-i18n PT_EXPLICIT_FORMATTERS + the modifier id in the union). The [`adding-a-modifier.md`](../playbooks/adding-a-modifier.md) playbook walks both i18n touches.
- A new modifier without both lexicon and mod-i18n entries renders as a raw id string in the missing surface. The lexicon `Record` is literal-union-typed (compile error), but `PT_EXPLICIT_FORMATTERS` is not — it's caught at the next agent's tooltip QA, not at compile.
- The decision tree for "which system" is a doc to read, not a property of the codebase. `i18n-which-system.md` mitigates this.

**Why we paid it:**

- Each shape gets the cheapest tool that fits it. Paraglide's static extraction stays for the UI; lexicons' runtime composition stays for naming; mod-i18n's per-id formatters stay for tooltips.
- The split *enables* per-domain enforcement (literal-union keys on lexicon Records) that a single shared table couldn't model cleanly.
- Adding a new locale = one new lexicon file per domain + the matching paraglide JSON. The decomposition keeps each locale's effort proportional to the locale's needs, not multiplied across surfaces.

## Consequences

- The "which system?" question is now a doc lookup, not an architecture decision. Future contributors read `i18n-which-system.md` and pick.
- A future cross-coverage test (one vitest iterating MODIFIERS and asserting every modifier has both a lexicon prefixForms entry and a PT_EXPLICIT_FORMATTERS entry) would close the runtime fallback gap. Tracked in `docs/plans/in-progress.md` → Item naming lexicon follow-ups.
- A new modifier shape (e.g. a percentage-range value like `+5-10% Cold Resistance`) that doesn't fit the existing mod-i18n formatter signature is the kind of change that justifies an ADR amendment rather than a silent workaround.
