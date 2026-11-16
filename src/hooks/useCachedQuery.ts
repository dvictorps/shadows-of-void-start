import { useEffect, useState } from "react";

/**
 * Bumped any time a cached query's shape changes incompatibly. Cached
 * payloads carrying a different version are discarded on read — readers fall
 * back to "no cache" until the live query writes a fresh entry. Cheap
 * insurance against renaming a field in the items table and rendering a
 * stale shape after a cold reload.
 */
const CACHE_VERSION = 2;

interface CachedPayload<T> {
	v: number;
	data: T;
}

/**
 * Wraps a reactive query value with a localStorage-backed cache so the UI
 * can render the last-known value while the live query is still resolving
 * (covers cold reloads + modal-open flicker).
 *
 * On mount: returns whatever was last persisted under `cacheKey` if the
 * version matches; undefined otherwise.
 * Whenever `live` changes from undefined → defined, the value is written
 * back to localStorage (tagged with CACHE_VERSION) and returned. Subsequent
 * updates flow live.
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

	// Remember the latest live value during render (React's "adjust state
	// while rendering" pattern) so a later live → undefined flip falls back to
	// it rather than to the mount-time cache. The identity compare assumes
	// `live` is referentially stable between renders (query results are). A
	// caller that passes a value rebuilt every render would loop here.
	if (live !== undefined && live !== cached) {
		setCached(live);
	}

	// Persisting is a sync to an external system (localStorage), so it stays
	// in an effect. `writeCache` skips the not-yet-resolved state itself.
	useEffect(() => {
		writeCache(cacheKey, live);
	}, [cacheKey, live]);

	return live ?? cached;
}

function readCache<T>(key: string): T | undefined {
	try {
		if (globalThis.localStorage === undefined) return undefined;
		const raw = localStorage.getItem(key);
		if (!raw) return undefined;
		const parsed: unknown = JSON.parse(raw);
		if (!isCurrentPayload<T>(parsed)) {
			// Stale shape from a previous schema. Drop it; live query rewrites.
			localStorage.removeItem(key);
			return undefined;
		}
		return parsed.data;
	} catch {
		return undefined;
	}
}

function writeCache<T>(key: string, value: T | undefined): void {
	// Undefined means the live query hasn't resolved; keep the last entry.
	if (value === undefined) return;
	try {
		if (globalThis.localStorage === undefined) return;
		const payload: CachedPayload<T> = { v: CACHE_VERSION, data: value };
		localStorage.setItem(key, JSON.stringify(payload));
	} catch {
		// Quota exceeded or storage disabled — silently no-op.
	}
}

// The version tag is the cache's whole contract: only this module writes
// these keys, always as `{ v: CACHE_VERSION, data }`, so a matching `v` is
// what vouches for `data` having the caller's current shape.
function isCurrentPayload<T>(value: unknown): value is CachedPayload<T> {
	return (
		typeof value === "object" &&
		value !== null &&
		"v" in value &&
		value.v === CACHE_VERSION &&
		"data" in value
	);
}
