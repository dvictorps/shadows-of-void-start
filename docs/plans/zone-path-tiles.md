# Zone Path tileset (deferred)

**Status**: Planned, waiting on the owner's tiles.
**Today**: the Zone Path (CONTEXT.md → Zone Path) is drawn as an SVG of plain shapes by `src/components/world/combat-scene/ZonePath.tsx`: stone tiles, a gold exit, amber campfires, dots per monster `pathColor`, a white walker.

## Scope

- **Tiles**: swap the CSS tile for sprites. `path-layout.ts` already knows each cell's neighbours, so a tile can pick its piece (straight, corner, entrance, exit) from the previous and next cell.
- **Markers**: campfire and exit sprites; monsters may get an icon per family, with `pathColor` kept as the tint or fallback.
- **Empty grid cells**: biome decoration around the path (trees, graves, rubble), still out of the walk.
- **Unchanged**: the route, its timing and the layout roll; this is presentation only.
