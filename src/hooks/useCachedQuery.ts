import { useEffect, useState } from "react";

/**
 * Wraps a reactive query value with a localStorage-backed cache so the UI
 * can render the last-known value while the live query is still resolving
 * (covers cold reloads + modal-open flicker).
 *
 * On mount: returns whatever was last persisted under `cacheKey`.
 * Whenever `live` changes from undefined → defined, the value is written
 * back to localStorage and returned. Subsequent updates flow live.
 *
 * Falls back to the live value alone when localStorage is unavailable
 * (private browsing, quota exceeded, etc.) — never throws.
 */
export function useCachedQuery<T>(
	cacheKey: string,
	live: T | undefined,
): T | undefined {
	const [cached, setCached] = useState<T | undefined>(() =>
		readCache<T>(cacheKey),
	);

	useEffect(() => {
		if (live === undefined) return;
		writeCache(cacheKey, live);
		setCached(live);
	}, [cacheKey, live]);

	return live ?? cached;
}

function readCache<T>(key: string): T | undefined {
	try {
		if (typeof localStorage === "undefined") return undefined;
		const raw = localStorage.getItem(key);
		if (!raw) return undefined;
		return JSON.parse(raw) as T;
	} catch {
		return undefined;
	}
}

function writeCache<T>(key: string, value: T): void {
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Quota exceeded or storage disabled — silently no-op.
	}
}
