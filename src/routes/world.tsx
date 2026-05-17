import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import { findClassDefinition } from "#/game/classes/data";
import type { CharacterClassDefinition } from "#/game/classes/types";
import type { EquipmentType } from "#/game/items/types/base";
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
		<main className="grid h-screen grid-cols-[1fr_640px] gap-3 overflow-hidden bg-black p-3 text-white">
			<div className="grid grid-rows-[1fr_160px] gap-3 overflow-hidden">
				<section className="rounded-md border border-white/40">
					<div className="flex h-full items-center justify-center">
						<span className="text-xs uppercase tracking-[0.2em] text-neutral-700">
							World view
						</span>
					</div>
				</section>

				<section className="overflow-y-auto rounded-md border border-white/40 p-3">
					<p className="text-[11px] uppercase tracking-wider text-white/50">
						Status / location log
					</p>
				</section>
			</div>

			<aside className="grid grid-rows-[1fr_auto] gap-3 overflow-hidden">
				<section className="rounded-md border border-white/40 p-3">
					<EquipmentSlots />
				</section>

				<section className="rounded-md border border-white/40 p-4">
					<HUD character={character} classDef={classDef} />
				</section>
			</aside>
		</main>
	);
}

// Paper doll layout — see `gridTemplateAreas` below for the visual map.
// `area` is the positional identifier (rings are duplicated, so ring1/ring2 distinguish them);
// `type` is the in-game equipment type that an item must match to occupy the slot.
type SlotArea =
	| "helmet"
	| "amulet"
	| "weapon"
	| "body"
	| "offhand"
	| "ring1"
	| "ring2"
	| "belt"
	| "gloves"
	| "boots";

const SLOT_GRID_STYLE = {
	gridTemplateColumns: "120px 120px 120px",
	gridTemplateRows: "120px 170px 80px 120px",
	gridTemplateAreas: `
		".      helmet amulet"
		"weapon body   offhand"
		"ring1  belt   ring2"
		"gloves .      boots"
	`,
} as const;

function EquipmentSlots() {
	return (
		<div className="flex h-full items-center justify-center">
			<div className="grid gap-2" style={SLOT_GRID_STYLE}>
				<EquipmentSlot type="helmet" label="HELM" area="helmet" />
				<EquipmentSlot type="amulet" label="AMU" area="amulet" w={80} h={80} />
				<EquipmentSlot type="weapon" label="WPN" area="weapon" />
				<EquipmentSlot type="chestplate" label="BODY" area="body" />
				<EquipmentSlot type="offhand" label="OFF" area="offhand" />
				<EquipmentSlot type="ring" label="RNG" area="ring1" w={80} h={80} />
				<EquipmentSlot type="belt" label="BELT" area="belt" w={120} h={50} />
				<EquipmentSlot type="ring" label="RNG" area="ring2" w={80} h={80} />
				<EquipmentSlot type="gloves" label="GLV" area="gloves" />
				<EquipmentSlot type="boots" label="BTS" area="boots" />
			</div>
		</div>
	);
}

function EquipmentSlot({
	label,
	area,
	type,
	w,
	h,
}: {
	label: string;
	area: SlotArea;
	type: EquipmentType;
	w?: number;
	h?: number;
}) {
	const sized = w !== undefined && h !== undefined;
	return (
		<div
			data-slot={type}
			data-slot-area={area}
			style={{
				gridArea: area,
				...(sized
					? { width: w, height: h, placeSelf: "center" }
					: { width: "100%", height: "100%" }),
			}}
			className="flex items-center justify-center rounded-sm border border-white/30 bg-black/40 text-[10px] uppercase tracking-wider text-white/40"
		>
			{label}
		</div>
	);
}

type HudProps = {
	character: Doc<"characters">;
	classDef: CharacterClassDefinition | null;
};

function HUD({ character, classDef }: HudProps) {
	const className = classDef?.name ?? "Unknown";
	const attrs = classDef?.baseStats.attributes ?? {
		strength: 0,
		dexterity: 0,
		intelligence: 0,
	};
	const hp = classDef?.baseStats.hp ?? 0;
	const barrier = classDef?.baseStats.barrier ?? 0;

	return (
		<div className="flex flex-col gap-3">
			<div className="grid grid-cols-2 gap-4">
				<div className="min-w-0">
					<h3 className="display-title truncate text-xl uppercase tracking-wider text-white">
						{character.name}
					</h3>
					<p className="mt-1 text-sm text-white/80">
						<span className="text-white/50">Classe:</span> {className}
					</p>
					<p className="text-sm text-white/80">
						<span className="text-white/50">Nível:</span> {character.level}
					</p>
					<p className="text-sm text-white/80">
						<span className="text-white/50">DPS:</span> —
					</p>
				</div>
				<div className="text-right text-sm">
					<p className="text-white">
						<span className="text-white/50">Força:</span> {attrs.strength}
					</p>
					<p className="text-white">
						<span className="text-white/50">Destreza:</span> {attrs.dexterity}
					</p>
					<p className="text-white">
						<span className="text-white/50">Inteligência:</span>{" "}
						{attrs.intelligence}
					</p>
				</div>
			</div>

			<div className="space-y-1">
				<div className="text-[10px] uppercase tracking-wider text-yellow-300/80">
					XP: 0 / 100
				</div>
				<div
					role="progressbar"
					aria-label="Experience"
					aria-valuenow={0}
					aria-valuemin={0}
					aria-valuemax={100}
					className="h-2 w-full overflow-hidden rounded-full bg-white/10"
				>
					<div className="h-full bg-yellow-300" style={{ width: "0%" }} />
				</div>
			</div>

			<hr className="border-white/15" />

			<div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
				<div className="flex flex-col items-center gap-1">
					<span className="text-[10px] uppercase tracking-wider text-white/50">
						Status
					</span>
					<Button
						type="button"
						variant="stark"
						className="px-3 py-1.5 text-xs uppercase tracking-wider"
					>
						Exibir
					</Button>
				</div>

				<div className="flex justify-center gap-2">
					<ConsumableSlot label="P" count={0} />
					<ConsumableSlot label="S" count={0} />
					<ConsumableSlot label="?" count={0} />
				</div>

				<HealthGlobe hp={hp} barrier={barrier} />
			</div>
		</div>
	);
}

function ConsumableSlot({ label, count }: { label: string; count: number }) {
	return (
		<div className="relative flex h-12 w-12 items-center justify-center border border-white/30 bg-black/60 text-xs font-bold uppercase tracking-wider text-white/60">
			{label}
			<span className="absolute -bottom-1 -right-1 min-w-[1.25rem] border border-white/40 bg-black px-1 text-center text-[10px] leading-tight text-white">
				×{count}
			</span>
		</div>
	);
}

function HealthGlobe({ hp, barrier }: { hp: number; barrier: number }) {
	return (
		<div
			role="img"
			aria-label="Health and barrier"
			className="relative flex h-16 w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-full border-2 border-red-900/70 bg-gradient-to-b from-red-600 to-red-950 text-center shadow-[inset_0_-10px_18px_rgba(0,0,0,0.45),0_0_18px_rgba(220,38,38,0.4)]"
		>
			<span className="text-[10px] font-bold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
				{hp}/{hp}
			</span>
			<span className="text-[9px] leading-tight text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
				{barrier}/{barrier}
			</span>
		</div>
	);
}
