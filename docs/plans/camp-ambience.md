# Camp screen art and ambience (deferred)

**Status**: Planned, not started.
**Today**: the camp screen is a plain cut to black with the title, one line and the two buttons (CONTEXT.md → Acampamento). The staged three-line cinematic with a wind sound was removed on purpose: text plus wind read as filler, and the cascade of fades felt generic.

## Scope

- **Background art**: a night campfire with the character sitting in front of it, behind the title and the line. One piece first; per-biome variants (forest, swamp, crypt, castle, void) only if the single piece holds up.
- **Ambient audio, only with the art**: a campfire crackle loop, maybe a biome bed under it. Not before the art lands: sound over a black screen is what got removed.
- **Zone metadata**: if per-biome variants happen, each zone declares a biome key and the camp screen looks up its art and audio.
- **Volume**: respects the global SFX volume (`src/lib/sfx.ts`). The screen still reads fully with audio off.
