import { useSyncExternalStore } from "react";
import {
	getGlobalSfxVolume,
	setGlobalSfxVolume,
	subscribeGlobalSfxVolume,
} from "#/lib/sfx";

/**
 * React binding for the global SFX volume. Reads through useSyncExternalStore
 * so settings changes propagate to every consumer (modal slider, status HUD,
 * etc.) without a context provider. The setter writes through to localStorage
 * via sfx.ts.
 */
export function useSfxVolume(): readonly [number, (value: number) => void] {
	const volume = useSyncExternalStore(
		subscribeGlobalSfxVolume,
		getGlobalSfxVolume,
		// SSR fallback — playSfx is also a no-op on the server, so any value is
		// fine. 1 keeps hydration consistent with the client default.
		() => 1,
	);
	return [volume, setGlobalSfxVolume] as const;
}
