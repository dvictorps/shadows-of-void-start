import { isTRPCClientError, type TRPCClientError } from "@trpc/client";

import { hasOwnKey } from "#/game/typed-object";
import { SERVER_ERRORS } from "#/lib/server-errors";
import { m } from "#/paraglide/messages";
import type { AppRouter } from "#/server/trpc/router";

// Procedures throw `TRPCError` with fixed message strings
// (src/server/trpc/errors.ts); this table translates them. Exact-match strings
// live in `SERVER_ERRORS`, shared with the server.

/** True when the server answered with a rule violation (not a crash or a
 * network failure), so the message is one of ours and safe to show. */
export function isServerRuleError(
	cause: unknown,
): cause is TRPCClientError<AppRouter> {
	// `isTRPCClientError<AppRouter>` types `data` from the router; a bare
	// `instanceof` leaves it as `any`.
	if (!isTRPCClientError<AppRouter>(cause)) return false;
	const code = cause.data?.code;
	return code !== undefined && code !== "INTERNAL_SERVER_ERROR";
}

/** True when another tab or device took over the character (threat #5). */
export function isSessionLost(cause: unknown): boolean {
	return (
		isServerRuleError(cause) && cause.message === SERVER_ERRORS.sessionLost
	);
}

/**
 * A localized message for an error thrown by a tRPC call (`cause` is the
 * catch-clause value). Rule violations are translated; crashes and network
 * failures show `fallback`.
 */
export function serverErrorMessage(cause: unknown, fallback: string): string {
	return isServerRuleError(cause)
		? translateServerError(cause.message)
		: fallback;
}

/**
 * Pattern-translates known server error strings to the active locale's
 * paraglide message. Returns the raw input untouched when no pattern matches
 * — that lets unexpected server errors surface verbatim instead of being
 * silently swallowed.
 */
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
} satisfies Record<string, () => string>;

const REQUIREMENT = {
	Level: m.error_requirement_level,
	Strength: m.error_requirement_strength,
	Dexterity: m.error_requirement_dexterity,
	Intelligence: m.error_requirement_intelligence,
} satisfies Record<string, (p: { value: number }) => string>;

// Rejection codes the message carries verbatim (planEquip's `reject`,
// zone-locked). Tried in order after the exact matches.
const SUBSTRING = [
	["wrong-slot", m.error_wrong_slot],
	["mixed-archetype", m.error_mixed_archetype],
	["needs-main-hand", m.error_needs_main_hand],
	["needs-bow", m.error_needs_bow],
	["offhand-not-weapon", m.error_offhand_not_weapon],
	["zone-locked", m.error_zone_locked],
] as const;

// Tried in order after the substrings; the first one that answers wins.
// Each returns null when the message isn't its own.
const PATTERNS: readonly ((msg: string) => string | null)[] = [
	(msg) =>
		msg.toLowerCase().includes("inventory") &&
		/full|overflow|free a slot/i.test(msg)
			? m.error_inventory_overflow()
			: null,
	// Bag retention cap (non-camp exitZone with too many keepIds). Pull the
	// cap number out so the UI can show "you can take N right now".
	(msg) => {
		const cap = msg.match(/Phase cap exceeded: kept \d+ > cap (\d+)/)?.[1];
		return cap ? m.error_phase_cap_exceeded({ cap: Number(cap) }) : null;
	},
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
