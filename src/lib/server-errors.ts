// Error messages the server throws and the client translates
// (`translateServerError` in server-error-message.ts). One source so a rename can't
// silently break the translation. Kept dependency-free: both bundles import it.
//
// Only messages the client matches exactly live here. Parametric ones
// ("Level 12 required", "Phase cap exceeded: …") keep their wording inline at
// the throw site; the client matches them with a regex.
export const SERVER_ERRORS = {
	notAuthenticated: "Not authenticated",
	adminRequired: "Admin access required",
	characterNotFound: "Character not found",
	notYourCharacter: "Not your character",
	sessionLost: "Session lost",
	itemNotFound: "Item not found",
	notYourItem: "Not your item",
	itemNotInInventory: "Item is not in inventory",
	slotEmpty: "Slot is empty",
	nameEmpty: "Name cannot be empty",
	duplicateName: "You already have a character with this name",
	notEnoughRubys: "Not enough rubys",
	invalidQuantity: "Quantity must be a positive integer",
	travelInProgress: "Cannot enter — travel in progress",
	notInZone: "Not in a zone",
	noCampsInBoss: "No camps in boss nodes",
	campAlreadyUsed: "Camp threshold already consumed",
	campNotReached: "Camp threshold not reached",
	alreadyTraveling: "Already traveling",
	alreadyAtDestination: "Already at destination",
	noTeleportStones: "No teleport stones",
	destinationLocked: "Destination not yet unlocked",
	mustBeInCity: "Must be in the city",
	busyTravelling: "Cannot do this while travelling",
	noPotions: "No potions to use",
	fullLife: "Already at full HP",
	noIncense: "No incense to use",
	incenseInBoss: "Cannot use incense inside a boss node",
	travelNotComplete: "Travel not complete",
	onlyMagesSwitch: "Only mages can switch elements",
	elementSwitchCooldown: "Element switch on cooldown",
	bothHandsRequired: "Both hand slots must be filled",
	handsNotInterchangeable: "Cannot swap: hands are not interchangeable",
	itemNotInStash: "Item is not in stash",
	wrongStashMode: "Item is in a different stash mode",
	cannotRevokeSelf: "Cannot revoke your own admin role",
	userNotFound: "User not found",
} as const;
