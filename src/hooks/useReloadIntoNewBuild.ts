import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { reloadIntoNewBuild } from "#/lib/app-version";

function assignDocument(href: string): void {
	window.location.assign(href);
}

export function useReloadIntoNewBuild(
	loadDocument: (href: string) => void = assignDocument,
): void {
	const { history } = useRouter();

	useEffect(
		() =>
			history.block({
				blockerFn: (step) => reloadIntoNewBuild(step, loadDocument),
				enableBeforeUnload: false,
			}),
		[history, loadDocument],
	);
}
