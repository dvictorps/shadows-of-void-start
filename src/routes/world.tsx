import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { z } from "zod";
import { findClassDefinition } from "#/game/classes/data";
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
	const character = characters?.find(
		(c) => c._id === (characterId as Id<"characters">),
	);

	if (characters === undefined) {
		return (
			<main className="flex h-screen items-center justify-center bg-black text-white">
				<p className="text-xs uppercase tracking-[0.2em] text-neutral-600">
					Loading...
				</p>
			</main>
		);
	}

	if (!character) {
		// Character missing — bounce back to select.
		void navigate({ to: "/character-select" });
		return null;
	}

	return <WorldLayout character={character} />;
}

function WorldLayout({ character }: { character: Doc<"characters"> }) {
	const classDef = findClassDefinition(character.classId);
	const className = classDef?.name ?? "Unknown";

	return (
		<main className="grid h-screen grid-cols-[1fr_340px] gap-3 overflow-hidden bg-black p-3 text-white">
			{/* Left column: viewport + text log */}
			<div className="grid grid-rows-[1fr_140px] gap-3 overflow-hidden">
				{/* Main viewport */}
				<section className="rounded-md border border-white/40">
					<div className="flex h-full items-center justify-center">
						<span className="text-xs uppercase tracking-[0.2em] text-neutral-700">
							World view
						</span>
					</div>
				</section>

				{/* Text log */}
				<section className="overflow-y-auto rounded-md border border-white/40 p-3">
					<p className="text-[11px] uppercase tracking-wider text-white/50">
						Status / location log
					</p>
				</section>
			</div>

			{/* Right column: equipment + HUD */}
			<aside className="grid grid-rows-[1fr_auto_auto] gap-3 overflow-hidden">
				{/* Equipment slots area */}
				<section className="rounded-md border border-white/40 p-3">
					<EquipmentSlots />
				</section>

				{/* Open inventory button */}
				<button
					type="button"
					className="flex h-12 items-center justify-center rounded-md border border-white/40 bg-black text-xs uppercase tracking-[0.2em] text-white/70 transition hover:bg-white/10 hover:text-white"
				>
					Inventory
				</button>

				{/* HUD: name/level/dps/xp + health globe + stats button */}
				<section className="rounded-md border border-white/40 p-3">
					<div className="flex items-center gap-3">
						<div className="min-w-0 flex-1">
							<div className="flex items-baseline justify-between gap-2">
								<span className="display-title truncate text-base uppercase tracking-wider text-white">
									{character.name}
								</span>
								<span className="text-xs uppercase tracking-wider text-white/60">
									LVL {character.level}
								</span>
							</div>
							<div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/50">
								{className} · DPS —
							</div>
							<div
								role="progressbar"
								aria-label="Experience"
								aria-valuenow={0}
								aria-valuemin={0}
								aria-valuemax={100}
								className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
							>
								<div className="h-full bg-yellow-300" style={{ width: "0%" }} />
							</div>
						</div>

						{/* Health globe */}
						<div
							role="img"
							aria-label="Health"
							className="h-14 w-14 shrink-0 rounded-full border border-red-900/60 bg-gradient-to-b from-red-700 to-red-950"
						/>

						{/* Stats button */}
						<button
							type="button"
							aria-label="Full stats"
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/40 bg-black text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
						>
							I
						</button>
					</div>
				</section>
			</aside>
		</main>
	);
}

// Equipment slot layout — placeholder using the 9 game slots.
// Top row: helmet (center). Second row: weapon / chest / offhand. Third row: amulet / gloves / ring. Bottom row: ring / belt / boots.
function EquipmentSlots() {
	return (
		<div className="grid h-full grid-cols-3 grid-rows-4 gap-2">
			<Slot label="" className="col-span-3 mx-auto w-1/3" type="helmet" />

			<Slot label="WPN" type="weapon" />
			<Slot label="CHS" type="chestplate" />
			<Slot label="OFF" type="offhand" />

			<Slot label="AMU" type="amulet" />
			<Slot label="GLV" type="gloves" />
			<Slot label="RNG" type="ring" />

			<Slot label="RNG" type="ring" />
			<Slot label="BLT" type="belt" />
			<Slot label="BTS" type="boots" />
		</div>
	);
}

function Slot({
	label,
	className,
	type,
}: {
	label: string;
	className?: string;
	type: string;
}) {
	return (
		<div
			data-slot={type}
			className={`flex items-center justify-center rounded-sm border border-white/30 bg-black/40 text-[9px] uppercase tracking-wider text-white/30 ${className ?? ""}`}
		>
			{label}
		</div>
	);
}
