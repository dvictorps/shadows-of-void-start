export function typedKeys<T extends object>(
	table: T,
): Array<Extract<keyof T, string>> {
	// SAFETY: Object.keys returns the own enumerable string keys. For the
	// object-literal tables this is used on, those are exactly the declared
	// keys; TS types Object.keys as string[] only because object types are open.
	return Object.keys(table) as Array<Extract<keyof T, string>>;
}

export function hasOwnKey<T extends object>(
	table: T,
	key: PropertyKey,
): key is keyof T {
	return Object.hasOwn(table, key);
}
