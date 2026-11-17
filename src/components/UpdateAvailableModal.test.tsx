// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { m } from "#/paraglide/messages";

import UpdateAvailableModal from "./UpdateAvailableModal";

afterEach(cleanup);

function mount(open: boolean) {
	const onUpdate = vi.fn<() => void>();
	const onLater = vi.fn<() => void>();
	render(
		<UpdateAvailableModal open={open} onUpdate={onUpdate} onLater={onLater} />,
	);
	return { onUpdate, onLater };
}

describe("UpdateAvailableModal", () => {
	it("renders nothing while the client is current", () => {
		mount(false);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("offers to update now", () => {
		const { onUpdate, onLater } = mount(true);
		expect(screen.getByText(m.update_available_title())).toBeTruthy();

		fireEvent.click(screen.getByText(m.update_available_now()));

		expect(onUpdate).toHaveBeenCalledOnce();
		expect(onLater).not.toHaveBeenCalled();
	});

	it("can be put off for later", () => {
		const { onUpdate, onLater } = mount(true);

		fireEvent.click(screen.getByText(m.update_available_later()));

		expect(onLater).toHaveBeenCalledOnce();
		expect(onUpdate).not.toHaveBeenCalled();
	});
});
