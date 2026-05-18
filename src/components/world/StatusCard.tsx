import { Button } from "#/components/ui/button";
import type {
	CharacterClassDefinition,
	CharacterClassId,
} from "#/game/classes/types";
import { computeMaxHp, xpToNextLevel } from "#/game/progression/levels";
import { m } from "#/paraglide/messages";
import type { Doc } from "../../../convex/_generated/dataModel";
import HealthGlobe from "./HealthGlobe";

const CLASS_NAME: Record<CharacterClassId, () => string> = {
	warrior: m.class_warrior_name,
	rogue: m.class_rogue_name,
	mage: m.class_mage_name,
};

type Props = {
	character: Doc<"characters">;
	classDef: CharacterClassDefinition | null;
	hpOverride?: number;
	potionsOverride?: number;
	onUsePotion?: () => void;
	onShowStats?: () => void;
};

export default function StatusCard({
	character,
	classDef,
	hpOverride,
	potionsOverride,
	onShowStats,
	onUsePotion,
}: Props) {
	const classResolved = classDef
		? CLASS_NAME[classDef.id as CharacterClassId]()
		: "Unknown";
	const attrs = classDef?.baseStats.attributes ?? {
		strength: 0,
		dexterity: 0,
		intelligence: 0,
	};
	const maxHp = computeMaxHp(classDef, character.level);
	const hpServer = character.hpCurrent ?? maxHp;
	const hp = hpOverride ?? hpServer;
	const potions = potionsOverride ?? character.potions ?? 0;
	const xp = character.xp ?? 0;
	const xpNeeded = xpToNextLevel(character.level);
	const xpPct = Math.min(100, (xp / xpNeeded) * 100);
	const barrier = classDef?.baseStats.barrier ?? 0;
	const canUsePotion = !!onUsePotion && potions > 0 && hp < maxHp;

	return (
		<section className="rounded-md border border-white/40 p-4">
			<div className="flex flex-col gap-3">
				<div className="grid grid-cols-2 gap-4">
					<div className="min-w-0">
						<h3 className="display-title truncate text-xl uppercase tracking-wider text-white">
							{character.name}
						</h3>
						<p className="mt-1 text-sm text-white/80">
							<span className="text-white/50">{m.status_class_label()}</span>{" "}
							{classResolved}
						</p>
						<p className="text-sm text-white/80">
							<span className="text-white/50">{m.status_level_label()}</span>{" "}
							{character.level}
						</p>
						<p className="text-sm text-white/80">
							<span className="text-white/50">{m.status_dps_label()}</span> —
						</p>
					</div>
					<div className="display-title space-y-1.5 text-right text-base tracking-wider">
						<p className="text-glow-red">
							{m.status_strength_label()} {attrs.strength}
						</p>
						<p className="text-glow-green">
							{m.status_dexterity_label()} {attrs.dexterity}
						</p>
						<p className="text-glow-blue">
							{m.status_intelligence_label()} {attrs.intelligence}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<div className="flex-1 space-y-1">
						<div className="text-[10px] uppercase tracking-wider text-yellow-300/80">
							{m.status_xp_label({ current: xp, needed: xpNeeded })}
						</div>
						<div
							role="progressbar"
							aria-label="Experience"
							aria-valuenow={xp}
							aria-valuemin={0}
							aria-valuemax={xpNeeded}
							className="h-2 w-full overflow-hidden rounded-full bg-white/10"
						>
							<div
								className="h-full bg-yellow-300 transition-[width] duration-200"
								style={{ width: `${xpPct}%` }}
							/>
						</div>
					</div>
					<button
						type="button"
						onClick={onUsePotion}
						disabled={!canUsePotion}
						aria-label="Use potion"
						className="relative flex h-10 w-10 shrink-0 items-center justify-center border border-white/40 bg-black text-base transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black"
					>
						🧪
						<span className="absolute -bottom-1 -right-1 min-w-[1rem] border border-white/40 bg-black px-1 text-center text-[9px] leading-tight text-white">
							{potions}
						</span>
					</button>
				</div>

				<hr className="border-white/15" />

				<div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
					<div className="flex flex-col items-center gap-1">
						<span className="text-[10px] uppercase tracking-wider text-white/50">
							{m.status_header()}
						</span>
						<Button
							type="button"
							variant="stark"
							onClick={onShowStats}
							disabled={!onShowStats}
							className="px-3 py-1.5 text-xs uppercase tracking-wider"
						>
							{m.show_action()}
						</Button>
					</div>

					<div className="flex justify-center gap-2">
						<ConsumableSlot label="?" count={0} />
						<ConsumableSlot label="?" count={0} />
						<ConsumableSlot label="?" count={0} />
					</div>

					<HealthGlobe hp={hp} maxHp={maxHp} barrier={barrier} />
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
