// @vitest-environment jsdom

// Threat #5: the auto-claim on arriving at /world, the "seen winning" latch,
// and no re-claim after a takeover (two tabs would ping-pong forever).
//
// The fake claim stays pending until the test settles it, the way the real
// one is followed by the character row carrying our token. A claim that
// settles while the row still shows another token re-fires on the next
// render (see docs/plans/in-progress.md), so no test leaves one in that state.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSessionClaim } from "./useSessionClaim";

const TOKEN = "tab-a";

type Props = { matches: boolean; id: number };

function setup(matches: boolean) {
	let settle = () => {};
	const claim = vi.fn<
		(args: { characterId: number; sessionToken: string }) => Promise<object>
	>(
		() =>
			new Promise<object>((resolve) => {
				settle = () => resolve({});
			}),
	);
	const hook = renderHook(
		(props: Props) =>
			useSessionClaim({
				tokenMatches: props.matches,
				characterId: props.id,
				sessionToken: TOKEN,
				claim,
			}),
		{ initialProps: { matches, id: 3 } },
	);
	return { claim, hook, settle: () => settle() };
}

describe("useSessionClaim", () => {
	it("claims once on arrival without a prior claim", async () => {
		const { claim, hook, settle } = setup(false);
		await act(async () => {});
		expect(claim).toHaveBeenCalledTimes(1);
		expect(claim).toHaveBeenCalledWith({ characterId: 3, sessionToken: TOKEN });
		// The claim landed: the patched row carries our token.
		hook.rerender({ matches: true, id: 3 });
		await act(async () => settle());
		expect(claim).toHaveBeenCalledTimes(1);
		expect(hook.result.current.sessionLost).toBe(false);
	});

	it("does not claim when the session is already ours", async () => {
		const { claim, hook } = setup(true);
		await act(async () => {});
		expect(claim).not.toHaveBeenCalled();
		expect(hook.result.current.sessionLost).toBe(false);
	});

	it("reports a takeover and never re-claims", async () => {
		const { claim, hook } = setup(true);
		hook.rerender({ matches: false, id: 3 });
		await act(async () => {});
		expect(hook.result.current.sessionLost).toBe(true);
		expect(claim).not.toHaveBeenCalled();
	});

	it("does not report a loss before the token was ever seen winning", async () => {
		const { hook } = setup(false);
		await act(async () => {});
		expect(hook.result.current.sessionLost).toBe(false);
	});

	it("does not fire a second claim while one is in flight", async () => {
		const { claim, hook, settle } = setup(false);
		await act(async () => {});
		// A dep change re-runs the effect while the first claim is pending.
		hook.rerender({ matches: false, id: 4 });
		await act(async () => {});
		expect(claim).toHaveBeenCalledTimes(1);
		hook.rerender({ matches: true, id: 4 });
		await act(async () => settle());
	});
});
