import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import CityScene from "#/components/world/CityScene";
import CombatScene from "#/components/world/CombatScene";
import EquipmentPanel from "#/components/world/EquipmentPanel";
import MapScene from "#/components/world/MapScene";
import StatusCard from "#/components/world/StatusCard";
import TextLog from "#/components/world/TextLog";
import { findClassDefinition } from "#/game/classes/data";
import { findStarterItem } from "#/game/items/starter-gear";
import { computeMaxHp, xpToNextLevel } from "#/game/progression/levels";
import { ACT_1, findNode } from "#/game/world";
import { useCombatLoop } from "#/hooks/useCombatLoop";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

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
					Loading...
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
	const respawnDead = useMutation(api.characters.respawnDead);

	const [view, setView] = useState<ViewMode>("map");
	const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const [deathLog, setDeathLog] = useState<string | null>(null);

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
				setDeathLog(`Você morreu! -${result.xpLost} XP`);
				setView("map");
				setCurrentNodeId(null);
				toast.error(`Você morreu! -${result.xpLost} XP`);
			} else {
				// Hardcore handling — for MVP, just toast and bounce to character-select.
				toast.error("Você morreu (hardcore). Personagem apagado.");
				window.location.href = "/character-select";
			}
		} catch {
			toast.error("Failed to handle death");
		}
	}, [respawnDead, character._id]);

	const combat = useCombatLoop({
		characterId: character._id,
		maxHp,
		initialHp: character.hpCurrent ?? maxHp,
		initialPotions: character.potions ?? 0,
		weapon,
		monsterPool,
		active: view === "combat",
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
		}
	};

	const handleBackToMap = () => {
		setView("map");
		setCurrentNodeId(null);
	};

	const logMessage =
		deathLog ??
		(view === "map" && hoveredNode
			? hoveredNode.name
			: view === "combat" && currentNode
				? `Inside: ${currentNode.name}`
				: view === "city" && currentNode
					? `Inside: ${currentNode.name}`
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
					/>
				)}
				{view === "city" && currentNode && (
					<CityScene cityName={currentNode.name} onLeave={handleBackToMap} />
				)}
				{view === "combat" && currentNode && (
					<CombatScene
						zoneName={currentNode.name}
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
						onRetreat={handleBackToMap}
					/>
				)}
				<TextLog message={logMessage} />
			</div>

			<aside className="grid grid-rows-[1fr_auto] gap-3">
				<EquipmentPanel weapon={weapon} />
				<StatusCard
					character={character}
					classDef={classDef}
					hpOverride={hpOverride}
					potionsOverride={potionsOverride}
					onUsePotion={onUsePotion}
				/>
			</aside>
		</main>
	);
}
