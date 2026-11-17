import { SERVER_ERRORS } from "../../lib/server-errors";
import {
	findStarterItem,
	STARTER_CHESTPLATE_BY_CLASS,
	STARTER_OFFHAND_BY_CLASS,
	STARTER_WEAPON_BY_CLASS,
} from "../items/starter-gear";
import type { GeneratedItem } from "../items/types";
import { computeStatCache, type StatCache } from "../stats/cache";
import type { EquippedItem, SelectableElement } from "../stats/types";
import { hasOwnKey } from "../typed-object";
import { defaultElementFor } from "./attunement";
import { CLASS_DEFINITIONS } from "./data";
import type { CharacterClassId } from "./types";

export const MAX_CHARACTERS_PER_USER = 8;
export const MAX_NAME_LENGTH = 20;
export const STARTING_POTIONS = 5;

export interface NewCharacterRequest {
	name: string;
	classId: string;
	hardcore: boolean;
}

export interface NewCharacterPlan {
	name: string;
	classId: CharacterClassId;
	hardcore: boolean;
	selectedElement: SelectableElement | null;
	hpCurrent: number;
	barrierCurrent: number;
	potions: number;
	stats: StatCache;
	starterItems: EquippedItem[];
}

export type NewCharacterResult =
	| { ok: true; plan: NewCharacterPlan }
	| { ok: false; error: string };

function starterItems(classId: CharacterClassId): EquippedItem[] {
	const picks: Array<[EquippedItem["slot"], string | undefined]> = [
		["weapon", STARTER_WEAPON_BY_CLASS[classId]],
		["offhand", STARTER_OFFHAND_BY_CLASS[classId]],
		["chestplate", STARTER_CHESTPLATE_BY_CLASS[classId]],
	];
	return picks.flatMap(([slot, id]) => {
		const item: GeneratedItem | null = id ? findStarterItem(id) : null;
		return item ? [{ slot, item }] : [];
	});
}

export function planNewCharacter(
	request: NewCharacterRequest,
	existingNames: readonly string[],
): NewCharacterResult {
	if (!hasOwnKey(CLASS_DEFINITIONS, request.classId)) {
		return { ok: false, error: `Unknown class: ${request.classId}` };
	}
	const name = request.name.trim();
	if (name.length === 0) return { ok: false, error: SERVER_ERRORS.nameEmpty };
	if (name.length > MAX_NAME_LENGTH) {
		return {
			ok: false,
			error: `Name must be at most ${MAX_NAME_LENGTH} characters`,
		};
	}
	if (existingNames.length >= MAX_CHARACTERS_PER_USER) {
		return {
			ok: false,
			error: `Max ${MAX_CHARACTERS_PER_USER} characters per account`,
		};
	}
	const nameLower = name.toLowerCase();
	if (existingNames.some((n) => n.toLowerCase() === nameLower)) {
		return { ok: false, error: SERVER_ERRORS.duplicateName };
	}

	const selectedElement = defaultElementFor(request.classId);
	const items = starterItems(request.classId);
	const stats = computeStatCache(
		{ classId: request.classId, level: 1, selectedElement },
		items,
	);
	return {
		ok: true,
		plan: {
			name,
			classId: request.classId,
			hardcore: request.hardcore,
			selectedElement,
			hpCurrent: stats.cachedMaxLife,
			barrierCurrent: stats.cachedMaxBarrier,
			potions: STARTING_POTIONS,
			stats,
			starterItems: items,
		},
	};
}
