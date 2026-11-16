# Adding a tRPC procedure

Server endpoints live in `src/server/trpc/routers/`, one sub-router per domain (ADR 0009). Read the `src/server/` section of [the codebase map](../codebase-map.md) first.

## The shape every procedure follows

**auth → load → decide in `src/game/` → one write (or one `batch()`)**. D1 has no interactive transactions, so all reads happen before the decision and all writes go out together at the end.

1. **Pick the base procedure** (`src/server/trpc/init.ts`):
   - It mutates character state → `characterSessionProcedure`. No exceptions: it carries the ownership + single-active-session check (threat #5). The row is in `ctx.character`, without the zone bag.
   - It reads account or character data → `authedProcedure`, and scope every query by `ctx.session.user.id`.
   - Admin dashboard → `adminProcedure`.
   - Public (leaderboard) → `publicProcedure`.
2. **Validate input with Zod**, reusing the game constants (`z.enum(EQUIPPED_SLOTS)`, `z.enum(STASH_MODES)`, `z.enum(MONSTER_RARITIES)`). Never accept item data, prices, HP caps or XP from the client: send ids and look the values up.
3. **Put the decision in a pure function in `src/game/`**, returning `{ ok: false, error } | { ok: true, … }`. Unit-test it next to the file. The procedure turns `ok: false` into `fail(error)` (`src/server/trpc/errors.ts`).
4. **Error messages:** strings the client matches exactly go in `SERVER_ERRORS` (`src/lib/server-errors.ts`); parametric ones ("Level 12 required") stay inline and the client matches them with a regex in `convex-errors.ts`. Keep the wording when porting.
5. **Write once.** One `update`, or `ctx.db.batch([...])` for several statements (`batchAll(db, list)` when the list can be empty). Every item write repeats the expected owner and location in its WHERE (`inInventoryOf`, `equippedOf`, `inStash` from `src/server/item-reads.ts`), so a stale request matches no row.
6. **Guard concurrent requests in SQL** where the statement can express it: decrement with `WHERE count > 0`, pay only while the sold items still exist, insert bag items only while the entry is still in the bag. Two requests for the same character can interleave otherwise (ADR 0009 trade-offs).
7. **Mind the write quota.** Every row written costs, and so does every index the write touches. Don't write when nothing changed (`syncHp` pattern), don't add indexes on hot columns, and keep `recordKill` / `syncHp` at one row.
8. **Name it without a `use` prefix** (the client's React hooks lint rule would flag `api.usePotion`). Mirror the old Convex name otherwise.
9. **Return what the client needs to update its cache.** There is no reactivity: a mutation returns the new values (or the client invalidates the right query keys).

## Test it

Add a case to the matching `src/server/trpc/routers/*.integration.test.ts`. The harness (`src/server/test/harness.ts`) gives you `createAccount()`, `createPlayableCharacter()`, `enterZone()`, `stageBag()`, `patchCharacter()` and `expectServerError()`. Cover the happy path, each rejection, another account's character, and a replayed or concurrent call if the procedure moves items or currency.

## Validation

```bash
pnpm db:generate          # only if you changed src/server/db/*-schema.ts
npx tsc --noEmit
pnpm test                 # unit + server (workerd) projects
pnpm lint:errors
```

If the schema changed: `pnpm db:migrate:staging`, then `pnpm deploy:staging`. Production deploys need the owner's go-ahead.
