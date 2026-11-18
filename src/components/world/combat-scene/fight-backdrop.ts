const FIGHT_BACKDROP_BY_ZONE = new Map<string, string>([
	["forest_starter", "/assets/sprites/cenarios/floresta-1.png"],
]);

export function fightBackdropFor(zoneId: string): string | null {
	return FIGHT_BACKDROP_BY_ZONE.get(zoneId) ?? null;
}
