# In-progress work

What is open now, in priority order. Read it before starting a session. **Keep it short:** when an item ships, delete it (the commit / PR is the record; don't leave a "Done" summary); a future design gets its own file in `docs/plans/`; numbers are replaced, never appended. The grade and its gates: [project-health.md](./project-health.md).

**Doc language convention**: narrative + meta-docs in English (CLAUDE.md, CONTEXT.md, codebase-map, playbooks, ADRs, and the prose in this file all follow this). PT preserved only for game-domain proper nouns — `Acampamento`, `Incenso Etéreo`, `Calmaria`, item-name examples (`Espada de Ferro`), monster names, etc. Code identifiers stay English. Mixing the two in narrative produces the kind of code-switching that confuses future agents and downstream tooling (translation platforms, search) — don't.

---

## Priority queue: the path to A+

The project is at **A** (see project-health.md). Gameplay, tuning and polish open on the owner's request; this queue is the engineering work that moves the grade, in order. Each item is one PR unless noted.

1. **Tests for the client mutation hooks** — `useWorldMutations` (418 lines), `useInventoryMutations`, `useCombatMutations`: the optimistic `onMutate` / `rollbackOnError` and the cache writes have no direct tests. Use the injected-server pattern of `useCombatLoop.test.ts` (no `vi.mock`). Plus `useViewMode` (the auto-arrival timer). Testing in hooks A- → A.
2. **Tests for the untested world components** — `MapScene` (node click / hover / stone reach), `ExitZoneModal` (bag retention flow), `EquipmentPanel`, `ItemContextMenu`, `WorldModals`, on the shared harness (playbook: adding-a-world-component). Then a `/world` wiring smoke test. Testing in components B+ → A. 2 PRs.
3. **Ambush rarity onto the engine** — `useEncounterSchedule` rolls the ambush pack's magic chance inline (`chance(ambushPlan.magicChance)`) on the ambient source: move it to `src/game/world/encounter-schedule.ts` with an `rng` parameter and a seeded test, like `rollMonsterRarity`.
4. **Accessibility leftovers of the design-system pass** — `aria-pressed` on the active element in `ElementSelector` and on the `VendorModal` tabs; the selected character card in `character-select` onto the `toggle` look; the admin user search onto `<Input variant="stark">`.
5. **Native PT review of the lexicon** (owner-driven) — [lexicon-follow-ups.md](./lexicon-follow-ups.md). Translation B- → A.
6. **The A+ condition itself** — ship the first new system (passive tree, [passive-tree-and-skills.md](./passive-tree-and-skills.md)) against its stub playbook without an emergency refactor. Only time and real additions prove this; items 1–4 make it cheap.

## Future plans (one file each)

[beta-readiness](./beta-readiness.md) (D1 quota envelope, actions before a public beta) · [anti-cheat](./anti-cheat.md) · [combat-identity](./combat-identity.md) · [passive-tree-and-skills](./passive-tree-and-skills.md) · [camp-ambience](./camp-ambience.md) · [lexicon-follow-ups](./lexicon-follow-ups.md) · [rare-name-bestiary](./rare-name-bestiary.md) · [admin-latency](./admin-latency.md) · [roadmap](./roadmap.md) (unique items)

## Open, not blocking

- **D1 JSON columns are typed, not validated.** `items.data`, `zone_bag`, `boss_kill_counts` and the leaderboard entries decode through Drizzle's `text({ mode: "json" }).$type<>()`, which casts (ADR 0009). `shadows/no-unvalidated-json-parse` guards hand-written `JSON.parse`, not these. Revisit if a stored shape changes without a migration.
- **Inline `oxlint-disable`s still in the tree (4)**, each with its external constraint in the comment beside it: the `useCombatTick` HP flush on deactivation (to revisit); kept for good: the 2 framer-motion imperative-controls effects (`useEnemySpriteMotion.ts`, `HealthGlobe` hit shake) and the `/world` session claim (`useSessionClaim.ts`). Separately, 2 `SAFETY:` casts: `typedKeys` (`src/game/typed-object.ts`) and `useSessionedMutation` (`src/hooks/useSessionToken.tsx`).
- **`world.tsx` size rule.** The measured gate is `complexity` on `WorldLayout` (18 after `refactor/world-split`). A new decision goes into `src/game` or one of the `/world` hooks (`useExitFlow`, `useSessionClaim`, `useIncenseGuard`), not inline; raw line growth is not the trigger, concerns re-mixing is.
