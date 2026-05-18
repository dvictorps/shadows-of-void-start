# Playbooks

Task recipes for common changes. Each playbook is a checklist of "touch these files in this order, run these commands at the end" so an agent doesn't have to rediscover the structure every time.

Use these when the task matches an existing pattern. For one-off architectural changes, start from [`CONTEXT.md`](../../CONTEXT.md) and the [codebase map](../codebase-map.md) instead.

## Playbooks

- [Adding a modifier](./adding-a-modifier.md) — new mod to drop on items (most common)
- [Adding an equipment template](./adding-an-equipment-template.md) — new weapon tier, new armor base
- [Adding a monster](./adding-a-monster.md) — new mob template + zone hookup
- [Adding a zone](./adding-a-zone.md) — new combat/city node in an act
- [Adding a class](./adding-a-class.md) — new playable class
- [Adding an i18n key](./adding-an-i18n-key.md) — new user-facing string
- [Touching combat](./touching-combat.md) — read this before editing `useCombatLoop.ts`

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
