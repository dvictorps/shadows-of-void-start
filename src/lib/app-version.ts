export const BUILD_ID_HEADER = "x-build-id";

export const BUILD_ID = __BUILD_ID__;

let outdated = false;
const listeners = new Set<() => void>();

export function noteServerBuild(serverBuild: string | null): void {
	if (outdated || serverBuild === null || serverBuild === BUILD_ID) return;
	outdated = true;
	for (const listener of listeners) listener();
}

export function isClientOutdated(): boolean {
	return outdated;
}

export function subscribeClientOutdated(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function withBuildCheck(fetchImpl: typeof fetch): typeof fetch {
	return async (input, init) => {
		const response = await fetchImpl(input, init);
		noteServerBuild(response.headers.get(BUILD_ID_HEADER));
		return response;
	};
}

export const BUILD_CHECK_MIN_INTERVAL_MS = 60_000;
const BUILD_CHECK_URL = "/api/trpc/health";

let lastBuildCheckAt = Number.NEGATIVE_INFINITY;

export async function checkServerBuild(
	now: number,
	fetchImpl: typeof fetch = fetch,
): Promise<void> {
	if (outdated || now - lastBuildCheckAt < BUILD_CHECK_MIN_INTERVAL_MS) return;
	lastBuildCheckAt = now;
	await withBuildCheck(fetchImpl)(BUILD_CHECK_URL, { cache: "no-store" }).catch(
		() => null,
	);
}

export interface NavigationStep {
	action: string;
	currentLocation: { pathname: string };
	nextLocation: { pathname: string; href: string };
}

export function reloadIntoNewBuild(
	step: NavigationStep,
	loadDocument: (href: string) => void,
): boolean {
	const leavesRoute =
		step.action === "PUSH" &&
		step.nextLocation.pathname !== step.currentLocation.pathname;
	if (!outdated || !leavesRoute) return false;
	loadDocument(step.nextLocation.href);
	return true;
}
