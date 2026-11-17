import { useEffect, useState } from "react";

const CACHE_VERSION = 3;

interface CachedPayload<T> {
	v: number;
	data: T;
}

export function useCachedQuery<T>(
	cacheKey: string,
	live: T | undefined,
): T | undefined {
	const [cached, setCached] = useState<T | undefined>(() =>
		readCache<T>(cacheKey),
	);

	if (live !== undefined && live !== cached) {
		setCached(live);
	}

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
			localStorage.removeItem(key);
			return undefined;
		}
		return parsed.data;
	} catch {
		return undefined;
	}
}

function writeCache<T>(key: string, value: T | undefined): void {
	if (value === undefined) return;
	try {
		if (globalThis.localStorage === undefined) return;
		const payload: CachedPayload<T> = { v: CACHE_VERSION, data: value };
		localStorage.setItem(key, JSON.stringify(payload));
	} catch {}
}

function isCurrentPayload<T>(value: unknown): value is CachedPayload<T> {
	return (
		typeof value === "object" &&
		value !== null &&
		"v" in value &&
		value.v === CACHE_VERSION &&
		"data" in value
	);
}
