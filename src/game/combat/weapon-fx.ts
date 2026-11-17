import type { WeaponType } from "../items/types/base";

export type HitFxKind = "slash" | "quickSlash" | "arrow" | "impact" | "magic";

export interface WeaponFx {
	visual: HitFxKind;
	sound: string;
}

export const WEAPON_FX = {
	sword: { visual: "slash", sound: "combat/cortante.wav" },
	axe: { visual: "slash", sound: "combat/cortante.wav" },
	greatsword: { visual: "slash", sound: "combat/cortante.wav" },
	twoHandedAxe: { visual: "slash", sound: "combat/cortante.wav" },
	dagger: { visual: "quickSlash", sound: "combat/cortantePequeno.wav" },
	bow: { visual: "arrow", sound: "combat/flecha.wav" },
	mace: { visual: "impact", sound: "combat/impacto.wav" },
	wand: { visual: "magic", sound: "combat/magia.wav" },
	staff: { visual: "magic", sound: "combat/magia.wav" },
} satisfies Record<WeaponType, WeaponFx>;
