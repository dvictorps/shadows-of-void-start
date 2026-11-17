import { SERVER_ERRORS } from "#/lib/server-errors";

import { fail } from "./trpc/errors";
import type { SessionCharacter } from "./trpc/init";

// City-only procedures (vendor, stash) need the character standing in the
// city, not in a zone and not in transit. The UI hides those actions
// elsewhere; this is the server-side fence.
export function assertInCity(
	character: Pick<SessionCharacter, "currentLocation" | "travelDestination">,
): void {
	if (character.currentLocation !== "city") fail(SERVER_ERRORS.mustBeInCity);
	if (character.travelDestination !== null) {
		fail(SERVER_ERRORS.busyTravelling);
	}
}
