import { describe, expect, it } from "vitest";

import { m } from "#/paraglide/messages";

import { translateServerError } from "./server-error-message";
import { SERVER_ERRORS } from "./server-errors";

describe("translateServerError — exact matches", () => {
	it.each([
		[SERVER_ERRORS.notAuthenticated, m.error_not_authenticated()],
		[SERVER_ERRORS.characterNotFound, m.error_character_not_found()],
		[SERVER_ERRORS.notYourCharacter, m.error_not_your_character()],
		[SERVER_ERRORS.itemNotFound, m.error_item_not_found()],
		[SERVER_ERRORS.notYourItem, m.error_not_your_item()],
		[SERVER_ERRORS.itemNotInInventory, m.error_item_not_in_inventory()],
		[SERVER_ERRORS.slotEmpty, m.error_slot_empty()],
		[SERVER_ERRORS.nameEmpty, m.name_cannot_be_empty()],
		[SERVER_ERRORS.duplicateName, m.error_duplicate_name()],
		[SERVER_ERRORS.sessionLost, m.error_session_lost()],
		[SERVER_ERRORS.notEnoughRubys, m.error_not_enough_rubys()],
		[SERVER_ERRORS.invalidQuantity, m.error_invalid_quantity()],
		[SERVER_ERRORS.travelInProgress, m.error_already_traveling()],
		[SERVER_ERRORS.notInZone, m.error_not_in_zone()],
		[SERVER_ERRORS.noCampsInBoss, m.error_no_camps_in_boss()],
		[SERVER_ERRORS.campAlreadyUsed, m.error_camp_already_used()],
		[SERVER_ERRORS.campNotReached, m.error_camp_not_reached()],
		[SERVER_ERRORS.killNotReached, m.error_kill_not_reached()],
		[SERVER_ERRORS.alreadyTraveling, m.error_already_traveling()],
		[SERVER_ERRORS.alreadyAtDestination, m.error_already_at_destination()],
		[SERVER_ERRORS.noTeleportStones, m.error_no_teleport_stones()],
		[SERVER_ERRORS.destinationLocked, m.error_destination_locked()],
		[SERVER_ERRORS.mustBeInCity, m.error_must_be_in_city()],
		[SERVER_ERRORS.busyTravelling, m.error_busy_travelling()],
		[SERVER_ERRORS.noPotions, m.error_no_potions()],
		[SERVER_ERRORS.fullLife, m.error_full_life()],
		[SERVER_ERRORS.noIncense, m.error_no_incense()],
		[SERVER_ERRORS.incenseInBoss, m.error_incense_in_boss()],
		[SERVER_ERRORS.travelNotComplete, m.error_travel_not_complete()],
		[SERVER_ERRORS.onlyMagesSwitch, m.error_only_mages_switch()],
		[SERVER_ERRORS.elementSwitchCooldown, m.error_element_switch_cooldown()],
		[SERVER_ERRORS.bothHandsRequired, m.error_both_hands_required()],
		[
			SERVER_ERRORS.handsNotInterchangeable,
			m.error_hands_not_interchangeable(),
		],
		[SERVER_ERRORS.itemNotInStash, m.error_item_not_in_stash()],
		[SERVER_ERRORS.wrongStashMode, m.error_wrong_stash_mode()],
		[SERVER_ERRORS.cannotRevokeSelf, m.error_cannot_revoke_self()],
		[SERVER_ERRORS.userNotFound, m.error_user_not_found()],
		[SERVER_ERRORS.adminRequired, m.error_admin_required()],
	])("%s", (raw, expected) => {
		expect(translateServerError(raw)).toBe(expected);
	});

	it("trims before matching", () => {
		expect(translateServerError(`  ${SERVER_ERRORS.slotEmpty}\n`)).toBe(
			m.error_slot_empty(),
		);
	});
});

describe("translateServerError — substring and parametric matches", () => {
	it.each([
		["Cannot equip: wrong-slot", m.error_wrong_slot()],
		["Cannot equip: mixed-archetype", m.error_mixed_archetype()],
		["Cannot equip: needs-main-hand", m.error_needs_main_hand()],
		["Cannot equip: needs-bow", m.error_needs_bow()],
		["Cannot equip: offhand-not-weapon", m.error_offhand_not_weapon()],
		["zone-locked: act1_2", m.error_zone_locked()],
		["Inventory full — free a slot first", m.error_inventory_overflow()],
		["Inventory overflow — free a slot first", m.error_inventory_overflow()],
		["Inventory overflow: 61 > 60", m.error_inventory_overflow()],
		[
			"Phase cap exceeded: kept 9 > cap 4 for phase combat",
			m.error_phase_cap_exceeded({ cap: 4 }),
		],
		[
			"pickFromBag is camp-only — must commit via exitZone",
			m.error_pick_camp_only(),
		],
		[
			"discardFromBag is camp-only — must commit via exitZone",
			m.error_discard_camp_only(),
		],
		["Level 12 required", m.error_requirement_level({ value: 12 })],
		["Strength 30 required", m.error_requirement_strength({ value: 30 })],
		["Dexterity 25 required", m.error_requirement_dexterity({ value: 25 })],
		[
			"Intelligence 40 required",
			m.error_requirement_intelligence({ value: 40 }),
		],
		["Name must be at most 20 characters", m.error_name_too_long({ max: 20 })],
		["Max 6 characters per account", m.error_max_characters({ max: 6 })],
		["Unknown class: bard", m.error_unknown_class()],
		["potion cap reached", m.vendor_buy_at_cap()],
		["teleport_stone cap reached", m.vendor_buy_at_cap()],
		["Unknown product: sword", m.error_unknown_product()],
		["Cannot enter act1_3 from act1_1", m.error_cannot_enter_from_here()],
	])("%s", (raw, expected) => {
		expect(translateServerError(raw)).toBe(expected);
	});

	it("checks the slot rejections before the inventory wording", () => {
		expect(translateServerError("Inventory wrong-slot overflow")).toBe(
			m.error_wrong_slot(),
		);
	});

	it("needs both 'inventory' and a full / overflow word for the overflow message", () => {
		expect(translateServerError("Inventory locked")).toBe("Inventory locked");
		expect(translateServerError("Stash full")).toBe("Stash full");
	});
});

describe("translateServerError — unknown", () => {
	it("passes an unknown message through untouched", () => {
		expect(translateServerError("  Out of stock ")).toBe("  Out of stock ");
	});

	it("never matches an object prototype name", () => {
		expect(translateServerError("toString")).toBe("toString");
	});
});
