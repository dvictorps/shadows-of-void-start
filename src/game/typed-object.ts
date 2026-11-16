// Typed views over Object.keys / own-key checks for the literal-keyed static
// tables in src/game (MODIFIERS, lexicons, i18n tables). Centralizes the one
// place where TypeScript can't express the invariant, instead of a cast per
// call site.

// Keys of a table declared as an object literal in source (no class
// instances, no prototype tricks, no runtime-added keys).
export function typedKeys<T extends object>(
	table: T,
): Array<Extract<keyof T, string>> {
	// SAFETY: Object.keys returns the own enumerable string keys. For the
	// object-literal tables this is used on, those are exactly the declared
	// keys; TS types Object.keys as string[] only because object types are open.
	return Object.keys(table) as Array<Extract<keyof T, string>>;
}

// Narrows a runtime/persisted id (a plain string) to the literal key set of a
// table. Own-property check, so prototype members ("toString") never resolve
// as entries.
export function hasOwnKey<T extends object>(
	table: T,
	key: PropertyKey,
): key is keyof T {
	return Object.hasOwn(table, key);
}
