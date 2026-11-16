// Error messages the server throws and the client translates
// (`translateServerError` in convex-errors.ts). One source so a rename can't
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
} as const;
