# Playbooks

Task recipes for common changes. Each playbook is a checklist of "touch these files in this order, run these commands at the end" so an agent doesn't have to rediscover the structure every time.

Use these when the task matches an existing pattern. For one-off architectural changes, start from [`CONTEXT.md`](../../CONTEXT.md) and the [codebase map](../codebase-map.md) instead.

## Playbooks

- [Adding a modifier](./adding-a-modifier.md) — new mod to drop on items (most common)
- [Adding an equipment template](./adding-an-equipment-template.md) — new weapon tier, new armor base
- [Adding a monster](./adding-a-monster.md) — new mob template + zone hookup
- [Adding a boss](./adding-a-boss.md) — new act-boss config + node + cinematic
- [Adding a zone](./adding-a-zone.md) — new combat/city node in an act
- [Adding a class](./adding-a-class.md) — new playable class
- [Adding a vendor product](./adding-a-vendor-product.md) — new consumable in the vendor catalog
- [Adding an i18n key](./adding-an-i18n-key.md) — new user-facing string (paraglide)
- [Which i18n system to use](./i18n-which-system.md) — decision tree: paraglide vs lexicon vs `mod-i18n.ts`
- [Touching combat](./touching-combat.md) — read this before editing `useCombatLoop.ts`

### Stubs (orientation docs for systems not yet built)

- [Adding a skill](./adding-a-skill.md) — active skill (gem-style). System not yet implemented.
- [Adding a passive](./adding-a-passive.md) — passive tree node. System not yet implemented.
- [Adding a stash tab](./adding-a-stash-tab.md) — stash + ruby loop. System not yet implemented.

## Conventions

Every playbook ends with the same validation sequence — you should always run these before considering a task done:

```bash
npx tsc --noEmit       # type-check
npx vitest run         # all tests
npx biome check src/   # lint + format
```

If your change touched convex code, also verify the dev server doesn't reject the schema:

```bash
npx convex dev --once  # one-shot deploy check
```

Don't bypass these. If a check fails, fix it before adding more changes.

## Type-check gate against drift

The playbooks for adding a modifier / template / monster / zone / class each link to a sentinel file under [`_examples/`](./_examples/) that mirrors the exact compile-checked shape. The sentinels are included in `tsconfig.json` (via `**/*.ts`) so `npx tsc --noEmit` fails on the sentinel when a domain type changes incompatibly — the playbook must then be updated in the same PR.

**Caveat — this is a local-only gate, not CI.** There is no `.github/workflows/` in the repo today, so nothing automatically runs `tsc --noEmit` on push. The sentinel only fires when *you* (or a reviewing agent) run the validation sequence above before merging. If a PR lands without that run, a stale sentinel can ship undetected. Treat the discipline as load-bearing until a CI workflow gets wired up.

When you change a domain shape **or** when you change a playbook example, update both. The sentinels exist to make that coupling hard to forget.
