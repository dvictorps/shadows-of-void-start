import { BASE_CRIT_MULTIPLIER } from "../combat/constants";
import type { ComputedCharacterStats } from "./types";

// Tooltip / status-readout DPS estimate. Averages per-swing damage across
// all configured swings, scales by tickRate (effective attacks/casts per
// second after speed mods + dual-wield averaging) and the expected crit
// factor. Doesn't model enemy armor/evasion/resistances — it's a
// "ballpark if all hits land" number meant to compare gear, not predict
// real combat output. Authoritative for both StatusCard and ShowStatsModal
// so the two readouts can't drift.
export function estimateDps(stats: ComputedCharacterStats): number {
	if (stats.swings.length === 0) return 0;
	const inc = stats.increased;
	const isSpell = stats.path === "spell";
	const pathBonus = isSpell ? inc.spell : inc.melee;

	const elemInc = (key: string) => {
		const per =
			key === "cold"
				? inc.cold
				: key === "fire"
					? inc.fire
					: key === "lightning"
						? inc.lightning
						: key === "void"
							? inc.void
							: 0;
		return (
			per +
			inc.elementalGlobal +
			(isSpell ? 0 : inc.elementalWithAttacks) +
			pathBonus
		);
	};

	const avgPerSwing =
		stats.swings.reduce((sum, s) => {
			const phys =
				((s.physicalDamage.min + s.physicalDamage.max) / 2) *
				(1 + (inc.physical + pathBonus) / 100);
			let cold = 0;
			let fire = 0;
			let lightning = 0;
			let voidDmg = 0;

			for (const e of s.elementalDamage) {
				const avg = (e.min + e.max) / 2;
				const scaled = avg * (1 + elemInc(e.element.toLowerCase()) / 100);
				const key = e.element.toLowerCase();
				if (key === "cold") cold += scaled;
				else if (key === "fire") fire += scaled;
				else if (key === "lightning") lightning += scaled;
				else if (key === "void") voidDmg += scaled;
			}

			if (isSpell) {
				const gain = stats.gainAsExtraSpell;
				const total = phys + cold + fire + lightning + voidDmg;
				cold += total * (gain.cold / 100);
				fire += total * (gain.fire / 100);
				lightning += total * (gain.lightning / 100);
				voidDmg += total * (gain.void / 100);
			}

			return sum + phys + cold + fire + lightning + voidDmg;
		}, 0) / stats.swings.length;

	const avgCrit =
		stats.swings.reduce(
			(sum, s) =>
				sum + Math.min(100, s.baseCritChance * (1 + inc.criticalChance / 100)),
			0,
		) / stats.swings.length;
	const critMult = (BASE_CRIT_MULTIPLIER + stats.bonusCritMultiplier) / 100;
	const critFactor = 1 + (avgCrit / 100) * critMult;

	return Math.round(avgPerSwing * stats.tickRate * critFactor);
}
