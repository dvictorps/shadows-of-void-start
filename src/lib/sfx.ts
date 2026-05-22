// Lightweight SFX helper. Pools HTMLAudioElement instances per file so the
// same sound can overlap (combat hit fires faster than the clip's length).
// Browsers reject autoplay when the user hasn't interacted yet — the
// promise rejection is silently swallowed so first-touch quirks don't crash
// the combat loop.

type SfxOptions = {
	volume?: number;
	/** Random pitch jitter in [-x, +x] applied via playbackRate. 0.1 = ±10%. */
	pitchVariance?: number;
};

const POOL_SIZE = 4;
const SFX_BASE = "/assets/sounds/sfx";

const audioPools = new Map<string, HTMLAudioElement[]>();

function getFromPool(path: string): HTMLAudioElement {
	let pool = audioPools.get(path);
	if (!pool) {
		pool = [];
		audioPools.set(path, pool);
	}
	for (const audio of pool) {
		if (audio.paused || audio.ended) {
			audio.currentTime = 0;
			return audio;
		}
	}
	if (pool.length < POOL_SIZE) {
		const audio = new Audio(path);
		audio.preload = "auto";
		pool.push(audio);
		return audio;
	}
	const audio = pool[0];
	audio.currentTime = 0;
	return audio;
}

/**
 * Play a SFX clip from `public/assets/sounds/sfx/<path>`. Missing files
 * silently no-op (the underlying play() promise rejects, we swallow it).
 * `pitchVariance` is convenient for breaking the monotony of high-AS combat
 * — `playSfx("hit.wav", { volume: 0.3, pitchVariance: 0.1 })` plays at
 * 0.9×–1.1× speed each call.
 */
export function playSfx(path: string, opts: SfxOptions = {}): void {
	if (typeof window === "undefined") return;
	const audio = getFromPool(`${SFX_BASE}/${path}`);
	audio.volume = Math.max(0, Math.min(1, opts.volume ?? 1));
	const variance = opts.pitchVariance ?? 0;
	audio.playbackRate =
		variance > 0 ? 1 + (Math.random() * 2 - 1) * variance : 1;
	audio.play().catch(() => {});
}

// Several skeleton variants share one clip. Slime and lich currently have no
// asset; the missing-key fallback in playMonsterDeathSfx leaves them silent.
const MONSTER_DEATH_SOUNDS: Record<string, string> = {
	morcego: "bat.wav",
	olho_do_vazio: "eyeball.wav",
	goblin: "goblin.wav",
	macaco: "gorilla.wav",
	esqueleto: "skeleton.wav",
	esqueleto_armadurado: "skeleton.wav",
	esqueleto_lanca: "skeleton.wav",
	serpente: "snake.wav",
	vampiro: "vampire.wav",
	criatura_do_vazio: "voidcreature.wav",
	zumbi: "zombie.wav",
};

export function playMonsterDeathSfx(monsterId: string): void {
	const file = MONSTER_DEATH_SOUNDS[monsterId];
	if (!file) return;
	playSfx(`creatures/${file}`, { volume: 0.5 });
}
