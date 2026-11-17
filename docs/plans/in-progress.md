# In-progress work

What is open now, in priority order. Read it before starting a session. **Keep it short:** when an item ships, delete it (the commit / PR is the record; don't leave a "Done" summary); a future design gets its own file in `docs/plans/`; numbers are replaced, never appended. The grade and its gates: [project-health.md](./project-health.md).

**Doc language convention**: narrative + meta-docs in English (CLAUDE.md, CONTEXT.md, codebase-map, playbooks, ADRs, and the prose in this file all follow this). PT preserved only for game-domain proper nouns — `Acampamento`, `Incenso Etéreo`, `Calmaria`, item-name examples (`Espada de Ferro`), monster names, etc. Code identifiers stay English. Mixing the two in narrative produces the kind of code-switching that confuses future agents and downstream tooling (translation platforms, search) — don't.

---

## Priority queue: the path to A+

The project is at **A** (see project-health.md). Gameplay, tuning and polish open on the owner's request; the engineering queue toward A+ is empty. What is left is not engineering work:

- **Launch requirement: native PT review of the lexicon** (owner-driven) — [lexicon-follow-ups.md](./lexicon-follow-ups.md). Must ship before a paid Brazilian release. Translation B- → A.
- **Waiting on the next feature: the A+ condition itself** — ship the first new system (passive tree, [passive-tree-and-skills.md](./passive-tree-and-skills.md)) against its stub playbook without an emergency refactor. Only time and real additions prove this.

## Future plans (one file each)

[beta-readiness](./beta-readiness.md) (D1 quota envelope, actions before a public beta) · [anti-cheat](./anti-cheat.md) · [combat-identity](./combat-identity.md) · [passive-tree-and-skills](./passive-tree-and-skills.md) · [camp-ambience](./camp-ambience.md) · [lexicon-follow-ups](./lexicon-follow-ups.md) · [rare-name-bestiary](./rare-name-bestiary.md) · [admin-latency](./admin-latency.md) · [roadmap](./roadmap.md) (unique items)

## Open, not blocking

- **`/world` claims the session up to 3 times on arrival.** The route smoke test (`src/routes/-world.test.tsx`) sees three `characters.claimCharacterSession` calls with one token despite the `useInFlight` guard, which points at the world match mounting more than once under the router. Harmless today: a repeat claim with the same token is a D1 read and no write (`characters.claimCharacterSession` skips the update). Check in a real browser before a public beta, since a double mount also doubles the route's queries.
- **D1 JSON columns are typed, not validated.** `items.data`, `zone_bag`, `boss_kill_counts` and the leaderboard entries decode through Drizzle's `text({ mode: "json" }).$type<>()`, which casts (ADR 0009). `shadows/no-unvalidated-json-parse` guards hand-written `JSON.parse`, not these. Revisit if a stored shape changes without a migration.
- **Inline `oxlint-disable`s still in the tree (4)**, each with its external constraint in the comment beside it: the `useCombatTick` HP flush on deactivation (to revisit); kept for good: the 2 framer-motion imperative-controls effects (`useEnemySpriteMotion.ts`, `HealthGlobe` hit shake) and the `/world` session claim (`useSessionClaim.ts`). Separately, 2 `SAFETY:` casts: `typedKeys` (`src/game/typed-object.ts`) and `useSessionedMutation` (`src/hooks/useSessionToken.tsx`).
- **`world.tsx` size rule.** The measured gate is `complexity` on `WorldLayout` (18 after `refactor/world-split`). A new decision goes into `src/game` or one of the `/world` hooks (`useExitFlow`, `useSessionClaim`, `useIncenseGuard`), not inline; raw line growth is not the trigger, concerns re-mixing is.
