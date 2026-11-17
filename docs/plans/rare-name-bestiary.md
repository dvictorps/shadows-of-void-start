# Future: rare-name bestiary (low priority)

**Status**: Idea parked. Not a priority — touches persistence, not combat feel.

**Why**: rares now get random proper names from the lexicon pools ("Garra de Aço, o Furioso" / "Stonemaw, the Furious"). Each spawn rolls a fresh `RareNameSeed` so the same monster type produces a different name every time. A bestiary would let the player accumulate the rares they've killed across runs — a memorable trophy log instead of forgotten flavor text.

## Scope sketch

- New D1 table `rare_encounters` keyed by characterId (mind the write quota: one more row per rare kill), storing: spawn seed, monster id, level, mods, killed-at timestamp, zone id. (Seed lets the renderer reproduce the same name later — the displayed string isn't stored, so locale-switch reads the right language out of the bestiary too.)
- `recordKill` mutation grows a branch: when `monsterRarity === "rare"`, also insert into `rareEncounters`.
- New world view (`/world` view mode `"bestiary"`, or a modal opened from the status card) lists past rares chronologically or by zone. Each entry renders via `translateEnemyName({ def, mods, rarity: "rare", nameSeed })`.
- Optional: count how many times the same `(monsterId, mod combo)` has been killed — repeat-kill stats add a collector dimension.

## Why deferred

Combat-feel work pays off the moment the player fights; persistence pays off later. The seed + mods are already first-class on the Enemy object, so the data plumbing is cheap when we get to it — no schema migration on monsters or names needed.

## Validation when picked up

- Add the table in `src/server/db/game-schema.ts` (`pnpm db:generate`), then have `combat.recordKill` insert the encounter on rare kills in the same batch.
- Manual: kill a rare, open the bestiary, see the same name. Switch locale — the bestiary entry renders in the new language. Kill a rare with the same monsterId, see a different name.
