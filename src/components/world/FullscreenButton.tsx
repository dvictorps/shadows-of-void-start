import { Maximize, Minimize } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "#/components/ui/button";
import { m } from "#/paraglide/messages";

type FullscreenState = "unsupported" | "off" | "on";

function subscribe(onChange: () => void) {
	document.addEventListener("fullscreenchange", onChange);
	return () => document.removeEventListener("fullscreenchange", onChange);
}

function readState(): FullscreenState {
	if (!document.fullscreenEnabled) return "unsupported";
	return document.fullscreenElement === null ? "off" : "on";
}

const SERVER_STATE: FullscreenState = "unsupported";

function toggleFullscreen() {
	const request =
		document.fullscreenElement === null
			? document.documentElement.requestFullscreen()
			: document.exitFullscreen();
	request.catch(() => null);
}

export default function FullscreenButton() {
	const state = useSyncExternalStore(subscribe, readState, () => SERVER_STATE);
	if (state === "unsupported") return null;
	const active = state === "on";
	const Icon = active ? Minimize : Maximize;
	return (
		<Button
			type="button"
			variant="hud"
			size="icon"
			onClick={toggleFullscreen}
			aria-label={active ? m.exit_fullscreen() : m.enter_fullscreen()}
			aria-pressed={active}
		>
			<Icon className="size-4" strokeWidth={2} />
		</Button>
	);
}
