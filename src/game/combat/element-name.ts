import { m } from "#/paraglide/messages";

import type { DamageElement } from "../items/types";
import { hasOwnKey } from "../typed-object";

const ELEMENT_NAME = {
	physical: m.element_physical,
	cold: m.element_cold,
	fire: m.element_fire,
	lightning: m.element_lightning,
	void: m.element_void,
} satisfies Record<DamageElement, () => string>;

/**
 * The localized name of a damage element. Takes the lowercase key ("cold",
 * as resistances and the element selector carry it) or the capitalized label
 * the computed damage lines carry ("Cold"); anything else comes back as given.
 */
export function elementName(element: string): string {
	const key = element.toLowerCase();
	return hasOwnKey(ELEMENT_NAME, key) ? ELEMENT_NAME[key]() : element;
}
