import { useSyncExternalStore } from "react";

import {
	getGlobalSfxVolume,
	setGlobalSfxVolume,
	subscribeGlobalSfxVolume,
} from "#/lib/sfx";

export function useSfxVolume(): readonly [number, (value: number) => void] {
	const volume = useSyncExternalStore(
		subscribeGlobalSfxVolume,
		getGlobalSfxVolume,
		() => 1,
	);
	return [volume, setGlobalSfxVolume] as const;
}
