// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { Toaster, toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { narrow } from "#/components/dom-test-utils";
import { ruleError } from "#/components/trpc-test-utils";
import { getClassDisplayName } from "#/game/classes/i18n";
import { SERVER_ERRORS } from "#/lib/server-errors";
import { m } from "#/paraglide/messages";

import CreateCharacterModal, {
	type CreateCharacterServer,
} from "./CreateCharacterModal";

type Props = Parameters<typeof CreateCharacterModal>[0];

afterEach(() => {
	toast.dismiss();
	cleanup();
});

function setup(overrides: Partial<Props> = {}) {
	const create = vi.fn<CreateCharacterServer["create"]>(async () => 42);
	const onClose = vi.fn<() => void>();
	const onCreated = vi.fn<(id: number) => void>();
	const props: Props = {
		isOpen: true,
		onClose,
		onCreated,
		server: { create },
		...overrides,
	};
	render(
		<>
			<CreateCharacterModal {...props} />
			<Toaster />
		</>,
	);
	return { create, onClose, onCreated };
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

const nameInput = () =>
	narrow(screen.getByLabelText(m.name_label()), HTMLInputElement);
const classCard = (id: "warrior" | "rogue" | "mage") =>
	narrow(
		screen.getByText(getClassDisplayName(id)).closest("button"),
		HTMLButtonElement,
	);
const hardcoreBox = () =>
	narrow(screen.getByRole("checkbox"), HTMLInputElement);
const createButton = () =>
	narrow(
		screen.getByRole("button", { name: m.create_action() }),
		HTMLButtonElement,
	);
const cancelButton = () =>
	narrow(screen.getByRole("button", { name: m.cancel() }), HTMLButtonElement);

function typeName(value: string) {
	fireEvent.change(nameInput(), { target: { value } });
}

async function submit() {
	await act(async () => {
		fireEvent.submit(narrow(nameInput().form, HTMLFormElement));
	});
}

describe("CreateCharacterModal — form", () => {
	it("renders nothing while closed", () => {
		setup({ isOpen: false });
		expect(screen.queryByText(m.create_character_title())).toBeNull();
	});

	it("counts the name's characters against the 20 limit", () => {
		setup();
		expect(screen.getByText("0/20")).toBeTruthy();
		typeName("Aldra");
		expect(screen.getByText("5/20")).toBeTruthy();
		expect(nameInput().maxLength).toBe(20);
	});

	it("offers the three classes with their primary attribute, warrior first", () => {
		setup();
		expect(classCard("warrior").textContent).toBe(
			`${getClassDisplayName("warrior")}${m.attribute_strength()}`,
		);
		expect(classCard("rogue").textContent).toBe(
			`${getClassDisplayName("rogue")}${m.attribute_dexterity()}`,
		);
		expect(classCard("mage").textContent).toBe(
			`${getClassDisplayName("mage")}${m.attribute_intelligence()}`,
		);
		expect(classCard("warrior").getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByText(m.class_warrior_description())).toBeTruthy();
	});

	it("selects a class and shows its description", () => {
		setup();
		fireEvent.click(classCard("mage"));
		expect(classCard("mage").getAttribute("aria-pressed")).toBe("true");
		expect(classCard("warrior").getAttribute("aria-pressed")).toBe("false");
		expect(screen.getByText(m.class_mage_description())).toBeTruthy();
		expect(screen.queryByText(m.class_warrior_description())).toBeNull();
	});
});

describe("CreateCharacterModal — create", () => {
	it("refuses an empty or blank name without calling the server", async () => {
		const t = setup();
		typeName("   ");
		await submit();
		expect(await screen.findByText(m.name_cannot_be_empty())).toBeTruthy();
		expect(t.create).not.toHaveBeenCalled();
	});

	it("creates with the trimmed name, the class and hardcore, then hands back the id", async () => {
		const t = setup();
		typeName("  Aldra  ");
		fireEvent.click(classCard("rogue"));
		fireEvent.click(hardcoreBox());
		await submit();
		expect(t.create).toHaveBeenCalledWith({
			name: "Aldra",
			classId: "rogue",
			hardcore: true,
		});
		expect(t.onCreated).toHaveBeenCalledWith(42);
		expect(
			await screen.findByText(m.character_created({ name: "Aldra" })),
		).toBeTruthy();
	});

	it("resets the form after a creation", async () => {
		setup();
		typeName("Aldra");
		fireEvent.click(classCard("mage"));
		fireEvent.click(hardcoreBox());
		await submit();
		expect(nameInput().value).toBe("");
		expect(classCard("warrior").getAttribute("aria-pressed")).toBe("true");
		expect(hardcoreBox().checked).toBe(false);
	});

	it("locks the form while the call is in flight", async () => {
		const t = setup();
		const call = deferred<number>();
		t.create.mockReturnValue(call.promise);
		typeName("Aldra");
		await submit();
		const creating = narrow(
			screen.getByRole("button", { name: m.creating() }),
			HTMLButtonElement,
		);
		expect(creating.disabled).toBe(true);
		expect(cancelButton().disabled).toBe(true);
		fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
		expect(t.onClose).not.toHaveBeenCalled();
		await act(async () => {
			call.resolve(7);
			await call.promise;
		});
		expect(t.onCreated).toHaveBeenCalledWith(7);
	});

	it("translates a rule error and unlocks the form", async () => {
		const t = setup();
		t.create.mockRejectedValue(ruleError(SERVER_ERRORS.duplicateName));
		typeName("Aldra");
		await submit();
		expect(await screen.findByText(m.error_duplicate_name())).toBeTruthy();
		expect(createButton().disabled).toBe(false);
		expect(nameInput().value).toBe("Aldra");
		expect(t.onCreated).not.toHaveBeenCalled();
	});

	it("toasts the generic failure on a crash", async () => {
		const t = setup();
		t.create.mockRejectedValue(new Error("boom"));
		typeName("Aldra");
		await submit();
		expect(
			await screen.findByText(m.failed_to_create_character()),
		).toBeTruthy();
		expect(screen.queryByText("boom")).toBeNull();
	});
});

describe("CreateCharacterModal — cancel", () => {
	it("closes and clears the form", () => {
		const t = setup();
		typeName("Aldra");
		fireEvent.click(classCard("mage"));
		fireEvent.click(cancelButton());
		expect(t.onClose).toHaveBeenCalledTimes(1);
		expect(nameInput().value).toBe("");
		expect(classCard("warrior").getAttribute("aria-pressed")).toBe("true");
	});

	it("closes on Escape too", () => {
		const t = setup();
		fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
		expect(t.onClose).toHaveBeenCalledTimes(1);
	});
});
