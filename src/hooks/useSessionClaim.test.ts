// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSessionClaim } from "./useSessionClaim";

const TOKEN = "tab-a";

type Props = { matches: boolean; id: number };

function setup(matches: boolean) {
	let settle = () => {};
	let fail = (_error: Error) => {};
	const claim = vi.fn<
		(args: { characterId: number; sessionToken: string }) => Promise<object>
	>(
		() =>
			new Promise<object>((resolve, reject) => {
				settle = () => resolve({});
				fail = reject;
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
	return {
		claim,
		hook,
		settle: () => settle(),
		fail: (error: Error) => fail(error),
	};
}

describe("useSessionClaim", () => {
	it("claims once on arrival without a prior claim", async () => {
		const { claim, hook, settle } = setup(false);
		await act(async () => {});
		expect(claim).toHaveBeenCalledTimes(1);
		expect(claim).toHaveBeenCalledWith({ characterId: 3, sessionToken: TOKEN });
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
		hook.rerender({ matches: false, id: 4 });
		await act(async () => {});
		expect(claim).toHaveBeenCalledTimes(1);
		hook.rerender({ matches: true, id: 4 });
		await act(async () => settle());
	});

	it("latches a rejected claim instead of re-firing it", async () => {
		const { claim, hook, fail } = setup(false);
		await act(async () => {});
		const error = new Error("network down");
		await act(async () => fail(error));
		for (let i = 0; i < 5; i++) {
			hook.rerender({ matches: false, id: 3 });
			await act(async () => {});
		}
		expect(claim).toHaveBeenCalledTimes(1);
		expect(hook.result.current.claimFailure).toEqual({ error });
		expect(hook.result.current.sessionLost).toBe(false);
	});

	it("claims again on retry, and a successful retry clears the failure", async () => {
		const { claim, hook, settle, fail } = setup(false);
		await act(async () => {});
		await act(async () => fail(new Error("network down")));
		act(() => hook.result.current.retryClaim());
		await act(async () => {});
		expect(claim).toHaveBeenCalledTimes(2);
		expect(hook.result.current.claimFailure).toBeNull();
		hook.rerender({ matches: true, id: 3 });
		await act(async () => settle());
		expect(claim).toHaveBeenCalledTimes(2);
		expect(hook.result.current.claimFailure).toBeNull();
		expect(hook.result.current.sessionLost).toBe(false);
	});

	it("clears the failure once our token shows (the write landed, the response was lost)", async () => {
		const { claim, hook, fail } = setup(false);
		await act(async () => {});
		await act(async () => fail(new Error("response lost")));
		hook.rerender({ matches: true, id: 3 });
		await act(async () => {});
		expect(hook.result.current.claimFailure).toBeNull();
		expect(hook.result.current.sessionLost).toBe(false);
		expect(claim).toHaveBeenCalledTimes(1);
	});
});
