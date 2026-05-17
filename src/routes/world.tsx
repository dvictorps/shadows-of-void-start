import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { z } from "zod";
import EquipmentPanel from "#/components/world/EquipmentPanel";
import StatusCard from "#/components/world/StatusCard";
import TextLog from "#/components/world/TextLog";
import Viewport from "#/components/world/Viewport";
import { findClassDefinition } from "#/game/classes/data";
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

function WorldLayout({ character }: { character: Doc<"characters"> }) {
	const classDef = findClassDefinition(character.classId);

	return (
		<main className="relative grid h-screen grid-cols-[1fr_640px] gap-3 overflow-hidden bg-black p-3 text-white">
			<div className="grid grid-rows-[1fr_160px] gap-3 overflow-hidden">
				<Viewport />
				<TextLog />
			</div>

			<aside className="grid grid-rows-[1fr_auto] gap-3 overflow-hidden">
				<EquipmentPanel />
				<StatusCard character={character} classDef={classDef} />
			</aside>
		</main>
	);
}
