import { ConvexError } from "convex/values";
import { m } from "#/paraglide/messages";

/**
 * Extracts a user-presentable string from an unknown error thrown by a Convex
 * query/mutation. ConvexError carries its payload on `.data` — we route it
 * through translateServerError() to surface a localized message; non-Convex
 * errors fall back to the caller-provided default.
 */
export function convexErrorMessage(err: unknown, fallback: string): string {
	if (err instanceof ConvexError) {
		return translateServerError(String(err.data));
	}
	if (err instanceof Error) {
		return translateServerError(err.message) ?? fallback;
	}
	return fallback;
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
	// Strip Convex's stack-trace decorations so the patterns match cleanly.
	const msg = raw
		.replace(/^\[CONVEX [^\]]+\]\s*/, "")
		.replace(/^Uncaught (?:Convex)?Error:\s*/i, "")
		.replace(/\bConvexError:\s*/, "")
		.replace(/\s+at handler[\s\S]*$/, "")
		.trim();

	// Exact matches
	switch (msg) {
		case "Not authenticated":
			return m.error_not_authenticated();
		case "Character not found":
			return m.error_character_not_found();
		case "Not your character":
			return m.error_not_your_character();
		case "Item not found":
			return m.error_item_not_found();
		case "Not your item":
			return m.error_not_your_item();
		case "Item is not in inventory":
			return m.error_item_not_in_inventory();
		case "Slot is empty":
			return m.error_slot_empty();
		case "Name cannot be empty":
			return m.name_cannot_be_empty();
		case "You already have a character with this name":
			return m.error_duplicate_name();
		case "Session lost":
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
