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
