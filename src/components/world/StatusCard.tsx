import { Button } from "#/components/ui/button";
import type { CharacterClassDefinition } from "#/game/classes/types";
import type { Doc } from "../../../convex/_generated/dataModel";

type Props = {
	character: Doc<"characters">;
	classDef: CharacterClassDefinition | null;
};

export default function StatusCard({ character, classDef }: Props) {
	const className = classDef?.name ?? "Unknown";
	const attrs = classDef?.baseStats.attributes ?? {
		strength: 0,
		dexterity: 0,
		intelligence: 0,
	};
	const hp = classDef?.baseStats.hp ?? 0;
	const barrier = classDef?.baseStats.barrier ?? 0;

	return (
		<section className="rounded-md border border-white/40 p-4">
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
		</section>
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
