import { isTRPCClientError, type TRPCClientError } from "@trpc/client";

import { hasOwnKey } from "#/game/typed-object";
import { SERVER_ERRORS } from "#/lib/server-errors";
import { m } from "#/paraglide/messages";
import type { AppRouter } from "#/server/trpc/router";

export function isServerRuleError(
	cause: unknown,
): cause is TRPCClientError<AppRouter> {
	if (!isTRPCClientError<AppRouter>(cause)) return false;
	const code = cause.data?.code;
	return code !== undefined && code !== "INTERNAL_SERVER_ERROR";
}

export function isSessionLost(cause: unknown): boolean {
	return (
		isServerRuleError(cause) && cause.message === SERVER_ERRORS.sessionLost
	);
}

export function serverErrorMessage(cause: unknown, fallback: string): string {
	return isServerRuleError(cause)
		? translateServerError(cause.message)
		: fallback;
}

export function translateServerError(raw: string): string {
	const result = tryTranslate(raw);
	return result ?? raw;
}

const EXACT = {
	[SERVER_ERRORS.notAuthenticated]: m.error_not_authenticated,
	[SERVER_ERRORS.characterNotFound]: m.error_character_not_found,
	[SERVER_ERRORS.notYourCharacter]: m.error_not_your_character,
	[SERVER_ERRORS.itemNotFound]: m.error_item_not_found,
	[SERVER_ERRORS.notYourItem]: m.error_not_your_item,
	[SERVER_ERRORS.itemNotInInventory]: m.error_item_not_in_inventory,
	[SERVER_ERRORS.slotEmpty]: m.error_slot_empty,
	[SERVER_ERRORS.nameEmpty]: m.name_cannot_be_empty,
	[SERVER_ERRORS.duplicateName]: m.error_duplicate_name,
	[SERVER_ERRORS.sessionLost]: m.error_session_lost,
	[SERVER_ERRORS.notEnoughRubys]: m.error_not_enough_rubys,
	[SERVER_ERRORS.invalidQuantity]: m.error_invalid_quantity,
	[SERVER_ERRORS.travelInProgress]: m.error_already_traveling,
	[SERVER_ERRORS.notInZone]: m.error_not_in_zone,
	[SERVER_ERRORS.noCampsInBoss]: m.error_no_camps_in_boss,
	[SERVER_ERRORS.campAlreadyUsed]: m.error_camp_already_used,
	[SERVER_ERRORS.campNotReached]: m.error_camp_not_reached,
	[SERVER_ERRORS.alreadyTraveling]: m.error_already_traveling,
	[SERVER_ERRORS.alreadyAtDestination]: m.error_already_at_destination,
	[SERVER_ERRORS.noTeleportStones]: m.error_no_teleport_stones,
	[SERVER_ERRORS.destinationLocked]: m.error_destination_locked,
	[SERVER_ERRORS.mustBeInCity]: m.error_must_be_in_city,
	[SERVER_ERRORS.busyTravelling]: m.error_busy_travelling,
	[SERVER_ERRORS.noPotions]: m.error_no_potions,
	[SERVER_ERRORS.fullLife]: m.error_full_life,
	[SERVER_ERRORS.noIncense]: m.error_no_incense,
	[SERVER_ERRORS.incenseInBoss]: m.error_incense_in_boss,
	[SERVER_ERRORS.travelNotComplete]: m.error_travel_not_complete,
	[SERVER_ERRORS.onlyMagesSwitch]: m.error_only_mages_switch,
	[SERVER_ERRORS.elementSwitchCooldown]: m.error_element_switch_cooldown,
	[SERVER_ERRORS.bothHandsRequired]: m.error_both_hands_required,
	[SERVER_ERRORS.handsNotInterchangeable]: m.error_hands_not_interchangeable,
	[SERVER_ERRORS.itemNotInStash]: m.error_item_not_in_stash,
	[SERVER_ERRORS.wrongStashMode]: m.error_wrong_stash_mode,
	[SERVER_ERRORS.cannotRevokeSelf]: m.error_cannot_revoke_self,
	[SERVER_ERRORS.userNotFound]: m.error_user_not_found,
	[SERVER_ERRORS.adminRequired]: m.error_admin_required,
} satisfies Record<string, () => string>;

const REQUIREMENT = {
	Level: m.error_requirement_level,
	Strength: m.error_requirement_strength,
	Dexterity: m.error_requirement_dexterity,
	Intelligence: m.error_requirement_intelligence,
} satisfies Record<string, (p: { value: number }) => string>;

const SUBSTRING = [
	["wrong-slot", m.error_wrong_slot],
	["mixed-archetype", m.error_mixed_archetype],
	["needs-main-hand", m.error_needs_main_hand],
	["needs-bow", m.error_needs_bow],
	["offhand-not-weapon", m.error_offhand_not_weapon],
	["zone-locked", m.error_zone_locked],
] as const;

const PATTERNS: readonly ((msg: string) => string | null)[] = [
	(msg) =>
		msg.toLowerCase().includes("inventory") &&
		/full|overflow|free a slot/i.test(msg)
			? m.error_inventory_overflow()
			: null,
	(msg) => {
		const cap = msg.match(/Phase cap exceeded: kept \d+ > cap (\d+)/)?.[1];
		return cap ? m.error_phase_cap_exceeded({ cap: Number(cap) }) : null;
	},
	(msg) =>
		msg.startsWith("discardFromBag") && msg.includes("is camp-only")
			? m.error_discard_camp_only()
			: null,
	(msg) => (msg.includes("is camp-only") ? m.error_pick_camp_only() : null),
	(msg) => {
		const req = msg.match(
			/(Level|Strength|Dexterity|Intelligence)\s+(\d+)\s+required/,
		);
		if (!req || !hasOwnKey(REQUIREMENT, req[1])) return null;
		return REQUIREMENT[req[1]]({ value: Number(req[2]) });
	},
	(msg) => {
		const max = msg.match(/Name must be at most (\d+) characters/)?.[1];
		return max ? m.error_name_too_long({ max: Number(max) }) : null;
	},
	(msg) => {
		const max = msg.match(/Max (\d+) characters per account/)?.[1];
		return max ? m.error_max_characters({ max: Number(max) }) : null;
	},
	(msg) => (msg.startsWith("Unknown class") ? m.error_unknown_class() : null),
	(msg) => (/^[a-z_]+ cap reached$/.test(msg) ? m.vendor_buy_at_cap() : null),
	(msg) =>
		msg.startsWith("Unknown product") ? m.error_unknown_product() : null,
	(msg) =>
		/^Cannot enter \S+ from \S+$/.test(msg)
			? m.error_cannot_enter_from_here()
			: null,
];

function tryTranslate(raw: string): string | null {
	const msg = raw.trim();
	if (hasOwnKey(EXACT, msg)) return EXACT[msg]();
	for (const [needle, message] of SUBSTRING) {
		if (msg.includes(needle)) return message();
	}
	for (const pattern of PATTERNS) {
		const translated = pattern(msg);
		if (translated !== null) return translated;
	}
	return null;
}
