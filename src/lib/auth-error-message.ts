import { m } from "#/paraglide/messages";

const AUTH_ERROR_MESSAGE = new Map<string, () => string>([
	["INVALID_EMAIL_OR_PASSWORD", m.auth_error_invalid_credentials],
	["USER_ALREADY_EXISTS", m.auth_error_user_exists],
	["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", m.auth_error_user_exists],
	["INVALID_EMAIL", m.auth_error_invalid_email],
	["PASSWORD_TOO_SHORT", m.auth_error_password_too_short],
]);

export function authErrorMessage(code?: string): string {
	const message = code === undefined ? undefined : AUTH_ERROR_MESSAGE.get(code);
	return (message ?? m.auth_error_generic)();
}
