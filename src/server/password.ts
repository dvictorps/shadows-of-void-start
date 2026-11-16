import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Better Auth's default hasher runs scrypt in pure JS (@noble/hashes), which
// burns hundreds of ms of CPU per sign-in. Workers Free allows 10 ms. This
// runs the same scrypt through `node:crypto`, which workerd implements
// natively (nodejs_compat). Parameters and the `salt:key` hex format match
// Better Auth's default, so hashes stay interchangeable with it.
const N = 16_384;
const R = 16;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 128 * N * R * 2;

function deriveKey(password: string, salt: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(
			password.normalize("NFKC"),
			salt,
			KEY_LENGTH,
			{ N, r: R, p: P, maxmem: MAX_MEMORY },
			(error, key) => {
				if (error) reject(error);
				else resolve(key);
			},
		);
	});
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString("hex");
	const key = await deriveKey(password, salt);
	return `${salt}:${key.toString("hex")}`;
}

interface PasswordCheck {
	hash: string;
	password: string;
}

export async function verifyPassword({
	hash,
	password,
}: PasswordCheck): Promise<boolean> {
	const [salt, storedKey] = hash.split(":");
	if (!salt || !storedKey) return false;
	const expected = Buffer.from(storedKey, "hex");
	const actual = await deriveKey(password, salt);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}
