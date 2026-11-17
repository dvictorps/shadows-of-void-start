# Camp screen art and ambience (deferred)

**Status**: Partly done.
**Today**: the camp screen shows the hand-drawn campfire (three frames in `public/assets/sprites/acampamento/`, shuffled by `CampFire`) with a CSS glow, the title and line above it and the two buttons below (CONTEXT.md → Acampamento). The staged three-line cinematic with a wind sound was removed on purpose: text plus wind read as filler, and the cascade of fades felt generic.

## Scope

- **Character art**: the character sitting in front of the fire, a layer over the campfire frames. Per-biome variants (forest, swamp, crypt, castle, void) only if the single piece holds up.
- **Ambient audio**: a campfire crackle loop, maybe a biome bed under it.
- **Zone metadata**: if per-biome variants happen, each zone declares a biome key and the camp screen looks up its art and audio.
- **Volume**: respects the global SFX volume (`src/lib/sfx.ts`). The screen still reads fully with audio off.
