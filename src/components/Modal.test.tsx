// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Modal from "./Modal";

const pressEscape = () => fireEvent.keyDown(document, { key: "Escape" });

function twoModals(top: { dismissible?: boolean } = {}) {
	const onCloseBelow = vi.fn<() => void>();
	const onCloseTop = vi.fn<() => void>();
	const view = render(
		<Modal isOpen onClose={onCloseBelow} title="below">
			below
		</Modal>,
	);
	view.rerender(
		<>
			<Modal isOpen onClose={onCloseBelow} title="below">
				below
			</Modal>
			<Modal isOpen onClose={onCloseTop} title="top" {...top}>
				top
			</Modal>
		</>,
	);
	return { onCloseBelow, onCloseTop };
}

afterEach(cleanup);

describe("Modal — Escape", () => {
	it("closes an open modal", () => {
		const onClose = vi.fn<() => void>();
		render(
			<Modal isOpen onClose={onClose}>
				body
			</Modal>,
		);
		pressEscape();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does nothing while closed", () => {
		const onClose = vi.fn<() => void>();
		render(
			<Modal isOpen={false} onClose={onClose}>
				body
			</Modal>,
		);
		pressEscape();
		expect(onClose).not.toHaveBeenCalled();
	});

	it("closes only the modal on top of another", () => {
		const t = twoModals();
		pressEscape();
		expect(t.onCloseTop).toHaveBeenCalledTimes(1);
		expect(t.onCloseBelow).not.toHaveBeenCalled();
	});

	it("a non-dismissible modal ignores Escape and keeps it from the one beneath", () => {
		const t = twoModals({ dismissible: false });
		pressEscape();
		expect(t.onCloseTop).not.toHaveBeenCalled();
		expect(t.onCloseBelow).not.toHaveBeenCalled();
	});
});
