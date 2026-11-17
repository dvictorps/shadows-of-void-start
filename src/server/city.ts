import { SERVER_ERRORS } from "#/lib/server-errors";

import { fail } from "./trpc/errors";
import type { SessionCharacter } from "./trpc/init";

export function assertInCity(
	character: Pick<SessionCharacter, "currentLocation" | "travelDestination">,
): void {
	if (character.currentLocation !== "city") fail(SERVER_ERRORS.mustBeInCity);
	if (character.travelDestination !== null) {
		fail(SERVER_ERRORS.busyTravelling);
	}
}
