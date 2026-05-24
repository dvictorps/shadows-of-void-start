# Gemini Code Assist review style — Shadows of Void

## How to review this codebase

You are reviewing a **solo-developer indie ARPG** built mostly through prompt
engineering with AI agents. Treat that as load-bearing context — it changes
what counts as a real finding and what counts as noise.

**Default posture**: assume the author had a reason for every decision.
The author runs an internal senior-style review pass on every PR before
yours and routinely makes deliberate trade-offs (skip TanStack Query because
Convex's reactive layer is more powerful for game state; widen a type at the
Convex boundary because Convex validators can't express literal unions; keep
two parallel i18n tables because a future contributor might "unify" them and
break gender concord). Your review should ask **"is this done well?"** —
not **"does this match a generic pattern?"**.

The shape of a useful comment in this repo is:

> "I see why this was done [reason]. But [specific failure mode] — [concrete fix]."

The shape of a comment that wastes the author's time is:

> "Consider using X instead of Y." (no failure mode named, no project context)

## Before reviewing, internalize the project docs

These files exist precisely so a reviewer can ground feedback in the
project's actual rules and history. Read in this order:

1. **`CONTEXT.md`** — domain glossary. The game's rules. Single source of truth.
   If a PR contradicts CONTEXT.md, that's a finding — and a high-severity one.
2. **`CLAUDE.md`** — project guidelines + architectural conventions
   (item architecture, modifier id naming, design decisions). Lists invariants
   that should not change without an explicit ADR.
3. **`docs/plans/in-progress.md`** — what work is queued, what's already
   landed, and the project health snapshot with the current grade trajectory.
   PRs touching items on this list are following a plan; don't re-litigate
   decisions that are documented there.
4. **`docs/codebase-map.md`** — where each domain lives. Use this to verify
   that new code lands in the conventional location.
5. **`docs/playbooks/`** — recipes for common tasks (adding a modifier,
   adding an equipment template, adding an i18n key, choosing between the
   three i18n systems). A PR that contradicts a playbook is either a bug or
   an undocumented playbook update — flag it either way.

If you find yourself making a recommendation that contradicts one of these
docs, that's a signal the docs may need to update — say so explicitly,
rather than insisting on a "best practice" the project intentionally rejects.

## Architectural invariants (high-severity findings if violated)

These come from `CONTEXT.md` and were chosen for specific reasons. Violating
them is a real finding, not a stylistic preference.

- **Caster weapons (`staff`, `wand`) never roll local attack mods.** No
  `physicalDamageFlat`, `attackSpeedIncrease`, etc., in their `applicableTo`.
- **Belt never rolls flat damage of any kind.** Flat physical, flat elemental
  to attacks, flat spell damage: none. Damage % is fine.
- **Global defense % matches the base.** `globalArmorIncrease` only on plate;
  `globalEvasionIncrease` only on leather; `globalBarrierIncrease` only on
  silk. Jewelry is exempt.
- **Magic find never rolls on weapons.** Armor, jewelry, and off-hands only.
- **Tome never rolls block chance.** It's the only off-hand kind without
  block — the absence is the identity.
- **Quiver requires a bow in the main hand.** Equip-time check + broken-state
  safety net.
- **Item names are render-at-display only.** Templates and modifiers have NO
  `name` field — display strings live in `src/game/items/lexicon/{en,pt}.ts`
  and are composed at render time by `src/game/items/item-name.ts`. If a PR
  adds a `name` field back to a template, modifier, or `GeneratedItem` field
  read at render time, that's a regression — flag it.
- **Path alias `#/` is client-only.** Convex's tsconfig has no `paths`, so
  any `#/...` import in a file Convex pulls transitively (anywhere reachable
  from `convex/*.ts`) silently breaks `convex dev` typecheck. Use relative
  paths in those files. PR #43 (commit c582bd2) fixed an instance — don't
  reintroduce.
- **Modifier id naming**: suffix matches math. `*Flat` adds. `*Increase` enters
  the increased pool. `*More` cascades multiplicatively. Renaming a suffix
  without changing `modifierType` is a bug.

## Domain concerns to actively flag

- **Drift between code and playbooks.** If a PR changes the shape of
  `EquipmentTemplate`, `Modifier`, or `GeneratedItem` but doesn't update
  `docs/playbooks/adding-an-equipment-template.md` or
  `docs/playbooks/adding-a-modifier.md` in the same PR, that's a real
  finding — the project lives on agent productivity and stale playbooks
  cost downstream agents real hours. This pattern has happened once (PR #41
  → fixed by #42). Don't let it happen twice.
- **Drift between lexicon and `mod-i18n.ts`.** Adding a modifier requires
  entries in both `lexicon.prefixForms` / `suffixPhrases` (magic-item name)
  AND `mod-i18n.ts:PT_EXPLICIT_FORMATTERS` (tooltip mod line). Missing
  either renders the modifier id as a raw string in that surface.
- **`mod.description` becoming load-bearing again.** It's legacy data on
  items rolled before the lexicon refactor. The tooltip MUST NOT read it
  as a primary display source for new code. If a PR uses it as anything
  but a fallback for legacy rows, flag.
- **`world.tsx` mixing concerns.** The 900→740-line decomposition (PRs
  #45 + #52) split the file into four contiguous sections —
  composition (queries + memos + hooks), handlers, derivations
  (text-log / travel-overlay), and JSX. The original problem was
  concerns *interleaved* inside the same scope, not raw line count.
  Flag a PR that re-mixes concerns (e.g., business logic inside JSX, a
  new mutation hook called inline outside the composition block, fetch
  or state-of-truth derivation in a handler). Do NOT flag growth that
  stays inside the right section — adding a new handler in the handlers
  block or new JSX in the render block is fine, even if it bumps line
  count. The current floor for an orchestrator route at this app's scale
  is ~700-750 lines.
- **Pre-rendering display strings.** Item / monster names are rendered at
  display time on purpose so locale switching retranslates everything. If a
  PR caches a rendered name on a row, in localStorage, or anywhere
  persistent, that silently breaks locale switching — flag with high
  severity.
- **Performance regressions in the combat tick or per-render hot path.**
  Tooltip render is event-driven (hover, modal open) — micro-optimizations
  there are noise. But adding work to `useCombatLoop` tick, `recordKill`,
  or per-frame paths IS load-bearing — flag with named failure mode.

## Common false positives — SKIP these

These look like generic best-practice issues but are deliberate or
inapplicable to this project. Don't flag.

- **`.replace()` vs `.replaceAll()`** when the pattern provably appears
  zero or one time (e.g., a `{value}` placeholder in a modifier
  displayFormat). The project audits these — the single-occurrence case is
  the norm. (PR #39 review comment that was rejected.)
- **"You should use TanStack Query directly instead of Convex's `useQuery`"**.
  Convex's reactive queries are intentionally chosen for live game state.
  TanStack Query is present for QueryClient setup only.
- **"Consider extracting this to a utility"** for one-shot logic. The
  project rejects premature abstractions — three similar lines beats a
  one-use helper.
- **"Add error handling"** for scenarios that can't happen given upstream
  invariants. Validate only at system boundaries (user input, external
  APIs).
- **"This `as` cast is unsafe"** at the Convex boundary specifically.
  Convex validators store literal-union fields as plain strings; the
  in-process types narrow them back via `as`. This is documented in
  `convex/itemValidator.ts` and `src/game/items/item-name.ts`.
- **Stylistic nits about comment density / variable names / file
  organization** that don't reference a specific failure mode. The project
  has its own conventions in `CLAUDE.md`.
- **"Consider adding tests"** generically. Tests already cover `src/game/`
  comprehensively (315+ vitest cases). Per-component / per-route tests
  are intentionally absent — flagged once, decided against until features
  stabilize.

## Severity calibration

The repo's `.gemini/config.yaml` sets `comment_severity_threshold: HIGH`.
This is intentional — the author runs an internal senior-style review pass
and only wants Gemini to flag what would be a real bug or violate an
architectural invariant. To pass the HIGH bar, a finding should:

- Reference a **specific failure mode** ("this throws TypeError when X" /
  "this silently breaks locale switching" / "this regresses the tooltip
  render for shield items").
- Cite the **project invariant** it violates when applicable (link to
  CONTEXT.md section or CLAUDE.md guideline).
- Propose a **concrete fix**, not just "consider another approach".

If you can't satisfy all three, the finding is probably MEDIUM or below —
don't post it.

## Language

Comments in English. The project's narrative docs are English; PT is
reserved for game-domain proper nouns (`Acampamento`, `Incenso Etéreo`,
`Espada de Ferro`). Don't switch languages mid-comment.

## When the project docs themselves should be the finding

If your review surfaces a real issue but no playbook / CONTEXT entry /
ADR covers it, say so explicitly. Example:

> "The Convex `useQuery` pattern in `world.tsx:331` doesn't match the
> optimistic-update recipe used elsewhere in the file. CLAUDE.md doesn't
> document the trade-off. Either align with the existing pattern or add
> an ADR explaining why this case differs."

That kind of comment is high-value — it surfaces tribal knowledge that
hasn't been written down yet.
