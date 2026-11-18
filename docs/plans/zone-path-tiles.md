# Zone Path tileset (deferred)

**Status**: Started: the Floresta Inicial has its art.
**Today**: the Zone Path (CONTEXT.md → Zone Path) is drawn as an SVG by `src/components/world/combat-scene/ZonePath.tsx`. A zone listed in `path-tileset.ts` gets a single repeating road sprite and a ground sprite around it (the forest: dirt path and tree canopy, 64×64). The other zones keep plain stone tiles. Everywhere: a gold exit, amber campfires, dots per monster `pathColor`, a white walker.

## Scope

- **More zones**: road and ground sprites for the Floresta Profunda, Pântano, Cripta, Castelo and Fenda do Vazio, one `path-tileset.ts` entry each.
- **Road pieces**: the road repeats one sprite today. `path-layout.ts` already knows each cell's neighbours, so a tile can pick its piece (straight, corner, entrance, exit, a grass edge) from the previous and next cell.
- **Markers**: campfire and exit sprites; monsters may get an icon per family, with `pathColor` kept as the tint or fallback.
- **Unchanged**: the route, its timing and the layout roll; this is presentation only.
