// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { m } from "#/paraglide/messages";
import { overwriteGetLocale, overwriteSetLocale } from "#/paraglide/runtime";

import LanguagePicker from "./LanguagePicker";

const setLocale = vi.fn<(locale: string) => void>();

beforeEach(() => {
	setLocale.mockReset();
	overwriteGetLocale(() => "pt");
	overwriteSetLocale(setLocale);
});

afterEach(cleanup);

describe("LanguagePicker", () => {
	it("offers every locale and marks the current one", () => {
		render(<LanguagePicker />);
		const pt = screen.getByRole("button", { name: m.language_pt() });
		const en = screen.getByRole("button", { name: m.language_en() });
		expect(pt.getAttribute("aria-pressed")).toBe("true");
		expect(en.getAttribute("aria-pressed")).toBe("false");
	});

	it("switches to another locale, and ignores a click on the current one", () => {
		render(<LanguagePicker />);
		fireEvent.click(screen.getByRole("button", { name: m.language_pt() }));
		expect(setLocale).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: m.language_en() }));
		expect(setLocale).toHaveBeenCalledExactlyOnceWith("en");
	});
});
