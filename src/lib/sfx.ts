// Lightweight SFX helper. Pools HTMLAudioElement instances per file so the
// same sound can overlap (combat hit fires faster than the clip's length).
// Browsers reject autoplay when the user hasn't interacted yet — the
// promise rejection is silently swallowed so first-touch quirks don't crash
// the combat loop.

import { type BossId, findBoss } from "#/game/bosses";
import { WEAPON_FX } from "#/game/combat/weapon-fx";
import type { WeaponType } from "#/game/items/types/base";
import type { MonsterRarity } from "#/game/monsters/types";
import { randSymmetric } from "./rng";

type SfxOptions = {
	volume?: number;
	/** Random pitch jitter in [-x, +x] applied via playbackRate. 0.1 = ±10%. */
	pitchVariance?: number;
	/**
	 * Force a single instance per path — incoming plays restart the existing
	 * clip instead of layering a new one on top. Use for high-frequency events
	 * (player swing landing) where overlapping copies stack into a muddy
	 * "three at once" sound at high attack speed.
	 */
	exclusive?: boolean;
};

const POOL_SIZE = 4;
const SFX_BASE = "/assets/sounds/sfx";

const audioPools = new Map<string, HTMLAudioElement[]>();

// ── Global SFX volume ───────────────────────────────────────────────────────
// Persisted multiplier applied on top of each playSfx call's `volume` opt.
// Stored as a string in localStorage so the settings modal survives reloads;
// the React side subscribes via the `sfx:volume` event so updates propagate
// without prop-drilling. Range [0, 1]; default 1.

const VOLUME_STORAGE_KEY = "sfx.globalVolume";
const VOLUME_EVENT = "sfx:volume";

function readStoredVolume(): number {
	if (typeof window === "undefined") return 1;
	const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
	if (raw === null) return 1;
	const n = Number.parseFloat(raw);
	if (!Number.isFinite(n)) return 1;
	return Math.max(0, Math.min(1, n));
}

let globalVolume = readStoredVolume();

export function getGlobalSfxVolume(): number {
	return globalVolume;
}

export function setGlobalSfxVolume(value: number): void {
	const clamped = Math.max(0, Math.min(1, value));
	if (clamped === globalVolume) return;
	globalVolume = clamped;
	if (typeof window !== "undefined") {
		window.localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
		window.dispatchEvent(new CustomEvent(VOLUME_EVENT));
	}
}

export function subscribeGlobalSfxVolume(listener: () => void): () => void {
	if (typeof window === "undefined") return () => {};
	window.addEventListener(VOLUME_EVENT, listener);
	return () => window.removeEventListener(VOLUME_EVENT, listener);
}

function getFromPool(path: string, exclusive: boolean): HTMLAudioElement {
	let pool = audioPools.get(path);
	if (!pool) {
		pool = [];
		audioPools.set(path, pool);
	}
	if (exclusive) {
		// Single-slot mode: always restart the same instance, never layer.
		// Short clips (hit.wav is ~80ms) need an explicit pause() before the
		// seek — Chrome's audio engine sometimes flushes a tail of the old
		// buffer when `currentTime = 0` is set mid-playback, perceived as a
		// doubled/tripled hit at high attack speed.
		if (pool.length === 0) {
			const audio = new Audio(path);
			audio.preload = "auto";
			pool.push(audio);
		}
		const audio = pool[0];
		if (!audio.paused) audio.pause();
		audio.currentTime = 0;
		return audio;
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
	if (globalVolume <= 0) return;
	const audio = getFromPool(`${SFX_BASE}/${path}`, opts.exclusive === true);
	const base = opts.volume ?? 1;
	audio.volume = Math.max(0, Math.min(1, base * globalVolume));
	const variance = opts.pitchVariance ?? 0;
	audio.playbackRate = variance > 0 ? 1 + randSymmetric(variance) : 1;
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

/**
 * Routes a kill's death sfx by rarity. Bosses (`rarity: "unique"`) pull
 * `cinematic.deathSfx` from their BossConfig (e.g. `bosses/gralfordead.wav`);
 * all other rarities go through the regular creature-death lookup.
 * Silent on lookup miss — see playMonsterDeathSfx.
 */
export function playKillSfx(enemy: {
	def: { id: string };
	rarity: MonsterRarity;
}): void {
	if (enemy.rarity === "unique") {
		const boss = findBoss(enemy.def.id as BossId);
		if (boss) {
			playSfx(boss.cinematic.deathSfx, { volume: 0.8 });
			return;
		}
	}
	playMonsterDeathSfx(enemy.def.id);
}

// Player swing hit-sound, derived from the weapon's WEAPON_FX entry. Volume
// + pitch jitter mirror the previous generic hit.wav call so per-weapon
// swap drops in without rebalancing the audio mix.
export function playPlayerSwingSfx(weaponType: WeaponType): void {
	playSfx(WEAPON_FX[weaponType].sound, {
		volume: 0.3,
		pitchVariance: 0.1,
		exclusive: true,
	});
}
