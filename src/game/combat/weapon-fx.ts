// Single source of truth for the visual + sound that fires when the player's
// weapon connects. Both the hit-effect overlay (HitFx.tsx) and the swing
// sound (sfx.ts → playPlayerSwingSfx) read this map — adding a new weapon
// type is one entry here, not a switch in two files.
//
// Visual categories don't 1:1 match weapon types because some pairs share a
// motion (sword + greatsword + axe + twoHandedAxe all read as "slash"). The
// sound side splits one extra notch because dagger has its own audio asset
// (cortantePequeno) even though it shares the slash visual.

import type { WeaponType } from "../items/types/base";

export type HitFxKind = "slash" | "quickSlash" | "arrow" | "impact" | "magic";

export interface WeaponFx {
	visual: HitFxKind;
	/** Filename under `public/assets/sounds/sfx/`. */
	sound: string;
}

export const WEAPON_FX: Record<WeaponType, WeaponFx> = {
	sword: { visual: "slash", sound: "cortante.wav" },
	axe: { visual: "slash", sound: "cortante.wav" },
	greatsword: { visual: "slash", sound: "cortante.wav" },
	twoHandedAxe: { visual: "slash", sound: "cortante.wav" },
	dagger: { visual: "quickSlash", sound: "cortantePequeno.wav" },
	bow: { visual: "arrow", sound: "flecha.wav" },
	mace: { visual: "impact", sound: "impacto.wav" },
	wand: { visual: "magic", sound: "magia.wav" },
	staff: { visual: "magic", sound: "magia.wav" },
};
