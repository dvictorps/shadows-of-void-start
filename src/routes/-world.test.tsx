// @vitest-environment jsdom

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { Toaster, toast } from "sonner";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { characterRow } from "#/components/world/character-test-fixtures";
import {
	CHARACTER_ID,
	inventoryRow,
	sword,
} from "#/components/world/item-test-fixtures";
import { INVENTORY_MAX_SLOTS } from "#/game/inventory/constants";
import { translateItemName } from "#/game/items/item-name";
import { ConfirmationProvider } from "#/hooks/useConfirmationModal";
import { SessionTokenProvider } from "#/hooks/useSessionToken";
import { type TRPC, TRPCProvider } from "#/integrations/trpc/client";
import { fakeTrpc } from "#/integrations/trpc/fake-client";
import type { CharacterRow } from "#/lib/api-types";
import { m } from "#/paraglide/messages";

import { Route as WorldRoute } from "./world";

const BLADE = sword("Smoke Blade");
const claimInput = z.object({
	characterId: z.number(),
	sessionToken: z.string(),
});

function setup(character: CharacterRow | null = characterRow()) {
	const fake = fakeTrpc({
		"users.getUserRole": () => ({ role: "user" }),
		"characters.byId": () => character,
		"items.equipped": () => [],
		"items.inventory": () => [inventoryRow(11, BLADE, 0)],
		"characters.claimCharacterSession": (input) => ({
			sessionToken: claimInput.parse(input).sessionToken,
		}),
		"items.equipItem": () => ({}),
	});
	const root = createRootRouteWithContext<{
		queryClient: QueryClient;
		trpc: TRPC;
	}>()({
		beforeLoad: () => {},
		component: () => (
			<ConfirmationProvider>
				<SessionTokenProvider>
					<TooltipPrimitive.Provider delayDuration={0}>
						<Outlet />
					</TooltipPrimitive.Provider>
				</SessionTokenProvider>
				<Toaster />
			</ConfirmationProvider>
		),
	});
	const world = createRoute({
		...WorldRoute.options,
		getParentRoute: () => root,
		path: "/world",
	});
	const characterSelect = createRoute({
		getParentRoute: () => root,
		path: "/character-select",
		component: () => <p>character select</p>,
	});
	const router = createRouter({
		routeTree: root.addChildren([world, characterSelect]),
		history: createMemoryHistory({
			initialEntries: [`/world?characterId=${CHARACTER_ID}`],
		}),
		context: { queryClient: fake.queryClient, trpc: fake.trpc },
	});
	render(
		<QueryClientProvider client={fake.queryClient}>
			<TRPCProvider trpcClient={fake.trpcClient} queryClient={fake.queryClient}>
				<RouterProvider router={router} />
			</TRPCProvider>
		</QueryClientProvider>,
	);
	return { ...fake, router };
}

const ARRIVAL = { timeout: 15_000 };
const inventoryButton = () =>
	screen.findByRole("button", { name: m.open_inventory() }, ARRIVAL);

async function press(el: HTMLElement) {
	await act(async () => {
		fireEvent.click(el);
	});
}

afterEach(() => {
	cleanup();
	toast.dismiss();
	localStorage.clear();
});

describe("/world route — smoke", { timeout: 20_000 }, () => {
	it("mounts the map and the sidebar for the character in the search", async () => {
		const t = setup();
		expect(await inventoryButton()).toBeTruthy();
		expect(
			screen.getByRole("button", { name: m.leave_world_back_label() }),
		).toBeTruthy();
		expect(t.callsTo("characters.byId")[0]).toEqual({ id: CHARACTER_ID });
		expect(t.callsTo("items.inventory")[0]).toEqual({
			characterId: CHARACTER_ID,
		});
	});

	it("claims the character session on arrival and caches the claimed token", async () => {
		const t = setup();
		await inventoryButton();
		const claims = t.callsTo("characters.claimCharacterSession");
		const claim = claimInput.parse(claims[0]);
		expect(claim.characterId).toBe(CHARACTER_ID);
		expect(
			claims.every(
				(other) => claimInput.parse(other).sessionToken === claim.sessionToken,
			),
		).toBe(true);
		await waitFor(() =>
			expect(
				t.queryClient.getQueryData(
					t.trpc.characters.byId.queryKey({ id: CHARACTER_ID }),
				)?.activeSessionToken,
			).toBe(claim.sessionToken),
		);
	});

	it("opens the inventory with the fetched bag and equips through the server", async () => {
		const t = setup();
		await press(await inventoryButton());
		const dialog = screen.getByRole("dialog");
		expect(
			within(dialog).getByText(
				m.inventory_title({ used: 1, total: INVENTORY_MAX_SLOTS }),
			),
		).toBeTruthy();
		await press(
			within(dialog).getByRole("button", { name: translateItemName(BLADE) }),
		);
		await press(
			within(screen.getByRole("menu")).getByRole("button", {
				name: m.equip_main_hand(),
			}),
		);
		const { sessionToken } = claimInput.parse(
			t.callsTo("characters.claimCharacterSession")[0],
		);
		expect(t.callsTo("items.equipItem")).toEqual([
			{
				characterId: CHARACTER_ID,
				itemId: 11,
				targetSlot: "weapon",
				sessionToken,
			},
		]);
	});

	it("leaves for character select after confirming", async () => {
		const t = setup();
		await press(
			await screen.findByRole(
				"button",
				{ name: m.leave_world_back_label() },
				ARRIVAL,
			),
		);
		await press(screen.getByRole("button", { name: m.leave_world_confirm() }));
		expect(
			await screen.findByText("character select", {}, ARRIVAL),
		).toBeTruthy();
		expect(t.router.state.location.pathname).toBe("/character-select");
	});

	it("sends a missing character back to character select", async () => {
		setup(null);
		expect(
			await screen.findByText("character select", {}, ARRIVAL),
		).toBeTruthy();
	});
});
