import { useState, useSyncExternalStore } from "react";

import { isClientOutdated, subscribeClientOutdated } from "#/lib/app-version";

export function useUpdateAvailable() {
	const outdated = useSyncExternalStore(
		subscribeClientOutdated,
		isClientOutdated,
		() => false,
	);
	const [dismissed, setDismissed] = useState(false);
	return {
		open: outdated && !dismissed,
		update: () => window.location.reload(),
		later: () => setDismissed(true),
	};
}
