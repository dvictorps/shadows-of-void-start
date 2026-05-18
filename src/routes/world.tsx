import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import BagPreviewModal from "#/components/world/BagPreviewModal";
import CityScene from "#/components/world/CityScene";
import CombatScene from "#/components/world/CombatScene";
import EquipmentPanel from "#/components/world/EquipmentPanel";
import ExitZoneModal from "#/components/world/ExitZoneModal";
import InventoryModal from "#/components/world/InventoryModal";
import MapScene from "#/components/world/MapScene";
import SettingsModal from "#/components/world/SettingsModal";
import StatusCard from "#/components/world/StatusCard";
import TextLog from "#/components/world/TextLog";
import { findClassDefinition } from "#/game/classes/data";
import { findStarterItem } from "#/game/items/starter-gear";
import { computeMaxHp, xpToNextLevel } from "#/game/progression/levels";
import { ACT_1, findNode } from "#/game/world";
import { translateNodeName } from "#/game/world/i18n";
import { useCombatLoop } from "#/hooks/useCombatLoop";
import { useModal } from "#/hooks/useModal";
import { m } from "#/paraglide/messages";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

const searchSchema = z.object({
	characterId: z.string(),
});

export const Route = createFileRoute("/world")({
	validateSearch: searchSchema,
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/sign-in" });
		}
	},
	component: WorldView,
});

function WorldView() {
	const { characterId } = Route.useSearch();
	const navigate = useNavigate();
	const characters = useQuery(api.characters.list);
	const character = characters?.find((c) => c._id === characterId);

	const charactersLoaded = characters !== undefined;
	const missing = charactersLoaded && !character;

	useEffect(() => {
		if (missing) void navigate({ to: "/character-select" });
	}, [missing, navigate]);

	if (!charactersLoaded || !character) {
		return (
			<main className="flex h-screen items-center justify-center bg-black text-white">
				<p className="text-xs uppercase tracking-[0.2em] text-neutral-600">
					{m.loading()}
				</p>
			</main>
		);
	}

	return <WorldLayout character={character} />;
}

type ViewMode = "map" | "city" | "combat";

function WorldLayout({ character }: { character: Doc<"characters"> }) {
	const classDef = findClassDefinition(character.classId);
	const enterCity = useMutation(api.characters.enterCity);
	const enterZone = useMutation(api.characters.enterZone);
	const exitZone = useMutation(api.characters.exitZone);
	const pickFromBag = useMutation(api.characters.pickFromBag);
	const discardFromBag = useMutation(api.characters.discardFromBag);
	const respawnDead = useMutation(api.characters.respawnDead);

	const [view, setView] = useState<ViewMode>("map");
	const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const [deathLog, setDeathLog] = useState<string | null>(null);

	const bagModal = useModal();
	const exitModal = useModal();
	const inventoryModal = useModal();
	const settingsModal = useModal();
	const wantsBag = view === "combat" || exitModal.isOpen;
	const zoneBag = useQuery(
		api.characters.zoneBag,
		wantsBag ? { characterId: character._id } : "skip",
	);
	const currentNode = currentNodeId ? findNode(ACT_1, currentNodeId) : null;
	const hoveredNode = hoveredNodeId ? findNode(ACT_1, hoveredNodeId) : null;

	const maxHp = computeMaxHp(classDef, character.level);
	const weapon = useMemo(
		() =>
			character.equippedWeapon
				? findStarterItem(character.equippedWeapon)
				: null,
		[character.equippedWeapon],
	);
	const monsterPool = useMemo(
		() => currentNode?.monsterPool ?? [],
		[currentNode],
	);

	const handlePlayerDeath = useCallback(async () => {
		try {
			const result = await respawnDead({ characterId: character._id });
			if (result.mode === "softcore") {
				const message = m.you_died_softcore({ xp: result.xpLost });
				setDeathLog(message);
				// Respawn in the city node — view changes deactivate the combat hook;
				// the hook skips the HP flush when dead so the server-side heal sticks.
				setView("city");
				setCurrentNodeId("city");
				toast.error(message);
			} else {
				toast.error(m.you_died_hardcore());
				window.location.href = "/character-select";
			}
		} catch {
			toast.error(m.failed_handle_death());
		}
	}, [respawnDead, character._id]);

	const combat = useCombatLoop({
		characterId: character._id,
		maxHp,
		initialHp: character.hpCurrent ?? maxHp,
		initialPotions: character.potions ?? 0,
		weapon,
		monsterPool,
		// Pause combat while the loot picker is open so the player can't die
		// mid-selection from a goblin they've already retreated from.
		active: view === "combat" && !exitModal.isOpen,
		onPlayerDeath: handlePlayerDeath,
	});

	const handleEnterNode = (nodeId: string) => {
		const node = findNode(ACT_1, nodeId);
		if (!node) return;
		setCurrentNodeId(nodeId);
		setDeathLog(null);
		if (node.kind === "city") {
			setView("city");
			void enterCity({ characterId: character._id });
		} else if (node.kind === "combat" || node.kind === "boss") {
			setView("combat");
			void enterZone({ characterId: character._id, zoneId: nodeId });
		}
	};

	const handleBackToMap = () => {
		setView("map");
		setCurrentNodeId(null);
	};

	const handleRetreat = () => {
		// Wait for the bag query to resolve before deciding modal vs auto-exit —
		// otherwise an undefined (still-loading) bag silently discards the loot.
		if (zoneBag === undefined) return;
		handleBackToMap();
		if (zoneBag.length > 0) {
			exitModal.open();
		} else {
			void exitZone({ characterId: character._id, keepIds: [] });
		}
	};

	const handlePickSelected = async (ids: Id<"items">[]) => {
		try {
			await pickFromBag({ characterId: character._id, itemIds: ids });
		} catch {
			toast.error(m.inventory_full_error());
		}
	};

	const handleDiscardSelected = async (ids: Id<"items">[]) => {
		await discardFromBag({ characterId: character._id, itemIds: ids });
	};

	const handlePickAll = async (ids: Id<"items">[]) => {
		try {
			await exitZone({ characterId: character._id, keepIds: ids });
			exitModal.close();
		} catch {
			toast.error(m.inventory_full_error());
		}
	};

	const handleDiscardAll = async () => {
		await exitZone({ characterId: character._id, keepIds: [] });
		exitModal.close();
	};

	const handleCloseExit = () => {
		// Leftover bag items survive until the next enterZone/enterCity, which
		// purges any orphan session.
		exitModal.close();
	};

	const logMessage =
		deathLog ??
		(view === "map" && hoveredNode
			? translateNodeName(hoveredNode)
			: view !== "map" && currentNode
				? m.inside_zone({ zone: translateNodeName(currentNode) })
				: undefined);

	const hpOverride = view === "combat" ? combat.playerHp : undefined;
	const potionsOverride = view === "combat" ? combat.potions : undefined;
	const onUsePotion =
		view === "combat" || view === "map" ? combat.usePotion : undefined;

	return (
		<main className="relative grid h-screen grid-cols-[1fr_640px] gap-3 overflow-hidden bg-black p-3 text-white">
			<div className="grid grid-rows-[1fr_160px] gap-3 overflow-hidden">
				{view === "map" && (
					<MapScene
						act={ACT_1}
						onEnterNode={handleEnterNode}
						onHoverNode={setHoveredNodeId}
						hoveredNodeId={hoveredNodeId}
						onOpenSettings={settingsModal.open}
					/>
				)}
				{view === "city" && currentNode && (
					<CityScene
						cityName={translateNodeName(currentNode)}
						onLeave={handleBackToMap}
					/>
				)}
				{view === "combat" && currentNode && (
					<CombatScene
						zoneName={translateNodeName(currentNode)}
						state={combat.state}
						enemy={combat.enemy}
						events={combat.events}
						lastXpGain={combat.lastXpGain}
						playerHp={combat.playerHp}
						maxHp={maxHp}
						xp={character.xp ?? 0}
						xpNeeded={xpToNextLevel(character.level)}
						potions={combat.potions}
						canUsePotion={combat.potions > 0 && combat.playerHp < maxHp}
						onUsePotion={combat.usePotion}
						onRetreat={handleRetreat}
						bagCount={zoneBag?.length ?? 0}
						onOpenBag={bagModal.open}
					/>
				)}
				<TextLog message={logMessage} />
			</div>

			<aside className="grid grid-rows-[1fr_auto] gap-3">
				<EquipmentPanel weapon={weapon} onOpenInventory={inventoryModal.open} />
				<StatusCard
					character={character}
					classDef={classDef}
					hpOverride={hpOverride}
					potionsOverride={potionsOverride}
					onUsePotion={onUsePotion}
				/>
			</aside>

			<BagPreviewModal
				isOpen={bagModal.isOpen}
				onClose={bagModal.close}
				items={zoneBag ?? []}
			/>
			<ExitZoneModal
				isOpen={exitModal.isOpen}
				onClose={handleCloseExit}
				onPickSelected={handlePickSelected}
				onDiscardSelected={handleDiscardSelected}
				onPickAll={handlePickAll}
				onDiscardAll={handleDiscardAll}
				bagItems={zoneBag ?? []}
			/>
			<InventoryModal
				isOpen={inventoryModal.isOpen}
				onClose={inventoryModal.close}
				characterId={character._id}
			/>
			<SettingsModal
				isOpen={settingsModal.isOpen}
				onClose={settingsModal.close}
			/>
		</main>
	);
}
