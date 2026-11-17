import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "#/server/trpc/router";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type RouterInputs = inferRouterInputs<AppRouter>;

export type CharacterRow = NonNullable<RouterOutputs["characters"]["byId"]>;
export type ItemRow = RouterOutputs["items"]["inventory"][number];
export type BagEntry = RouterOutputs["items"]["zoneBag"][number];
export type AdminOutputs = RouterOutputs["admin"];
export type LeaderboardSnapshot = NonNullable<
	RouterOutputs["leaderboard"]["getSnapshot"]
>;
export type LeaderboardQuery = RouterInputs["leaderboard"]["getSnapshot"];
