import { isTRPCClientError, type TRPCClientError } from "@trpc/client";

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

function tryTranslate(raw: string): string | null {
	const msg = raw.trim();

	// Exact matches
	switch (msg) {
		case SERVER_ERRORS.notAuthenticated:
			return m.error_not_authenticated();
		case SERVER_ERRORS.characterNotFound:
			return m.error_character_not_found();
		case SERVER_ERRORS.notYourCharacter:
			return m.error_not_your_character();
		case SERVER_ERRORS.itemNotFound:
			return m.error_item_not_found();
		case SERVER_ERRORS.notYourItem:
			return m.error_not_your_item();
		case SERVER_ERRORS.itemNotInInventory:
			return m.error_item_not_in_inventory();
		case SERVER_ERRORS.slotEmpty:
			return m.error_slot_empty();
		case SERVER_ERRORS.nameEmpty:
			return m.name_cannot_be_empty();
		case SERVER_ERRORS.duplicateName:
			return m.error_duplicate_name();
		case SERVER_ERRORS.sessionLost:
			return m.error_session_lost();
	}

	// Substring / parametric matches
	if (msg.includes("wrong-slot")) return m.error_wrong_slot();
	if (msg.includes("mixed-archetype")) return m.error_mixed_archetype();
	if (msg.includes("needs-main-hand")) return m.error_needs_main_hand();
	if (msg.includes("needs-bow")) return m.error_needs_bow();
	if (msg.includes("offhand-not-weapon")) return m.error_offhand_not_weapon();
	if (msg.includes("zone-locked")) return m.error_zone_locked();
	if (
		msg.toLowerCase().includes("inventory") &&
		/full|overflow|free a slot/i.test(msg)
	)
		return m.error_inventory_overflow();

	// Bag retention cap (non-camp exitZone with too many keepIds). Pull the
	// cap number out so the UI can show "you can take N right now".
	const capMatch = msg.match(/Phase cap exceeded: kept \d+ > cap (\d+)/);
	if (capMatch) {
		return m.error_phase_cap_exceeded({ cap: Number(capMatch[1]) });
	}
	if (msg.includes("is camp-only")) return m.error_pick_camp_only();

	const reqMatch = msg.match(
		/(Level|Strength|Dexterity|Intelligence)\s+(\d+)\s+required/,
	);
	if (reqMatch) {
		const value = Number(reqMatch[2]);
		switch (reqMatch[1]) {
			case "Level":
				return m.error_requirement_level({ value });
			case "Strength":
				return m.error_requirement_strength({ value });
			case "Dexterity":
				return m.error_requirement_dexterity({ value });
			case "Intelligence":
				return m.error_requirement_intelligence({ value });
		}
	}

	const nameMatch = msg.match(/Name must be at most (\d+) characters/);
	if (nameMatch) return m.error_name_too_long({ max: Number(nameMatch[1]) });

	const maxCharsMatch = msg.match(/Max (\d+) characters per account/);
	if (maxCharsMatch)
		return m.error_max_characters({ max: Number(maxCharsMatch[1]) });

	if (msg.startsWith("Unknown class")) return m.error_unknown_class();

	return null;
}
