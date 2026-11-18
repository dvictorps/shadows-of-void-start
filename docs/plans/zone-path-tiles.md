# Zone Path tileset (deferred)

**Status**: Started: the Floresta Inicial has its road pieces.
**Today**: the Zone Path (CONTEXT.md → Zone Path) is drawn as an SVG by `src/components/world/combat-scene/ZonePath.tsx`. A zone listed in `path-tileset.ts` gets its road pieces; the others keep plain stone tiles. Everywhere: a gold exit, amber campfires, dots per monster `pathColor`, a white walker.

## Scope

- **More zones**: road pieces for the other zones, one `path-tileset.ts` entry each.
- **Markers**: campfire and exit sprites; monsters may get an icon per family, with `pathColor` kept as the tint or fallback.
- **Empty grid cells**: biome decoration around the path (trees, graves, rubble), still out of the walk.
- **Unchanged**: the route, its timing and the layout roll; this is presentation only.
