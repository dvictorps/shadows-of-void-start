# Playbook examples — type-check gate against doc drift

The files in this folder are **sentinel examples** referenced by the playbooks
in `docs/playbooks/`. Each one imports the real game types and declares a
minimal example matching the shape the playbook claims will compile.

They're part of the regular `tsc --noEmit` pass (`tsconfig.json` includes
`**/*.ts`), so if a future refactor changes a domain type in an
incompatible way, the corresponding example breaks and the playbook is
forced to update in the same PR.

**Caveat — local-only enforcement.** No `.github/workflows/` exists in the
repo, so nothing runs `tsc --noEmit` automatically on push. The gate only
fires when you (or a reviewing agent) run the validation sequence locally
before merging. Until a CI workflow is wired up, the discipline of running
the validation suite is the only thing keeping the sentinels honest.

Each example is a plain `.ts` file with one exported constant and no
side effects. They are NOT registered anywhere in the runtime — nothing
imports them. Their only job is to fail compilation when the playbook
goes stale.

## Map

| Sentinel | Validates |
|---|---|
| `modifier-example.ts` | `adding-a-modifier.md` step 1 (modifier definition shape) |
| `template-example.ts` | `adding-an-equipment-template.md` step 1 (template definition shape) |
| `monster-example.ts` | `adding-a-monster.md` step 1 (monster definition shape) |
| `zone-example.ts` | `adding-a-zone.md` step 1 (world node shape) |
| `class-example.ts` | `adding-a-class.md` step 1 (class definition shape) |

## Maintenance

When a playbook example block changes (or the underlying type changes),
update the matching sentinel in the same PR. If a sentinel grows past a
couple dozen lines, the playbook is probably too prescriptive — trim
both.
