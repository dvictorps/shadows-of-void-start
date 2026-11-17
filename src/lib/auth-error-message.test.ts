import { describe, expect, it } from "vitest";

import { m } from "#/paraglide/messages";

import { authErrorMessage } from "./auth-error-message";

describe("authErrorMessage", () => {
	it("translates the Better Auth codes a player can hit", () => {
		expect(authErrorMessage("INVALID_EMAIL_OR_PASSWORD")).toBe(
			m.auth_error_invalid_credentials(),
		);
		expect(authErrorMessage("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")).toBe(
			m.auth_error_user_exists(),
		);
		expect(authErrorMessage("PASSWORD_TOO_SHORT")).toBe(
			m.auth_error_password_too_short(),
		);
	});

	it("falls back to a generic message for an unknown or missing code", () => {
		expect(authErrorMessage("SOMETHING_NEW")).toBe(m.auth_error_generic());
		expect(authErrorMessage()).toBe(m.auth_error_generic());
		expect(authErrorMessage("constructor")).toBe(m.auth_error_generic());
	});
});
