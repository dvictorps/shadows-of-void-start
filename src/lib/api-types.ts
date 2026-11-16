import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "#/server/trpc/router";

// Row shapes the client reads, inferred from the tRPC router so the server
// stays the single source (ADR 0009). Type-only: nothing here reaches the
// client bundle.
type RouterOutputs = inferRouterOutputs<AppRouter>;
type RouterInputs = inferRouterInputs<AppRouter>;

/** A character as `characters.byId` returns it: every column but the bag. */
export type CharacterRow = NonNullable<RouterOutputs["characters"]["byId"]>;
/** An inventory, equipped or stash item. */
export type ItemRow = RouterOutputs["items"]["inventory"][number];
/** A staged drop in the zone bag; `bagId` is what pick / discard take. */
export type BagEntry = RouterOutputs["items"]["zoneBag"][number];
/** The admin dashboard's queries. */
export type AdminOutputs = RouterOutputs["admin"];
/** One leaderboard snapshot (category × mode), as the hourly cron wrote it. */
export type LeaderboardSnapshot = NonNullable<
	RouterOutputs["leaderboard"]["getSnapshot"]
>;
/** Which snapshot to read: the leaderboard's two tab rows (category × mode). */
export type LeaderboardQuery = RouterInputs["leaderboard"]["getSnapshot"];
