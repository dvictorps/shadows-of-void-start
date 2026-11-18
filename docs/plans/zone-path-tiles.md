# Zone Path tileset (deferred)

**Status**: Started: the Floresta Inicial has its art.
**Today**: the Zone Path (CONTEXT.md → Zone Path) is drawn as an SVG by `src/components/world/combat-scene/ZonePath.tsx`. A zone listed in `path-tileset.ts` gets road pieces picked per cell (straights and corners) and an overlapping tree canopy around it (the forest, 64×64 sprites). The other zones keep plain stone tiles. Everywhere: a gold exit, amber campfires, dots per monster `pathColor`, a white walker.

## Scope

- **More zones**: road and ground sprites for the Floresta Profunda, Pântano, Cripta, Castelo and Fenda do Vazio, one `path-tileset.ts` entry each.
- **Road ends**: the entrance and the exit use a straight today; dedicated end pieces could close them.
- **Markers**: campfire and exit sprites; monsters may get an icon per family, with `pathColor` kept as the tint or fallback.
- **Unchanged**: the route, its timing and the layout roll; this is presentation only.
