import {
	DEX_ACCURACY_PER_POINT,
	DEX_EVASION_PCT_PER_POINT,
	INT_BARRIER_PCT_PER_POINT,
	STR_LIFE_PER_POINT,
	STR_MELEE_PCT_PER_POINT,
} from "#/game/stats/compute";
import { m } from "#/paraglide/messages";

export function attributeTooltips() {
	return {
		strength: m.attribute_tooltip_strength({
			melee: STR_MELEE_PCT_PER_POINT,
			life: STR_LIFE_PER_POINT,
		}),
		dexterity: m.attribute_tooltip_dexterity({
			accuracy: DEX_ACCURACY_PER_POINT,
			evasion: DEX_EVASION_PCT_PER_POINT,
		}),
		intelligence: m.attribute_tooltip_intelligence({
			barrier: INT_BARRIER_PCT_PER_POINT,
		}),
	};
}
