import { useEffect, useState, useSyncExternalStore } from "react";

import {
	checkServerBuild,
	isClientOutdated,
	subscribeClientOutdated,
} from "#/lib/app-version";

export function useUpdateAvailable() {
	const outdated = useSyncExternalStore(
		subscribeClientOutdated,
		isClientOutdated,
		() => false,
	);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		const onVisible = () => {
			if (document.visibilityState === "visible")
				void checkServerBuild(Date.now());
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => document.removeEventListener("visibilitychange", onVisible);
	}, []);

	return {
		open: outdated && !dismissed,
		update: () => window.location.reload(),
		later: () => setDismissed(true),
	};
}
