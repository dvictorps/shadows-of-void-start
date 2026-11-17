import { getBossConfig } from "#/game/bosses";
import { WEAPON_FX } from "#/game/combat/weapon-fx";
import type { WeaponType } from "#/game/items/types/base";
import type { MonsterRarity } from "#/game/monsters/types";

import { randSymmetric } from "./rng";

type SfxOptions = {
	volume?: number;
	pitchVariance?: number;
	exclusive?: boolean;
};

const POOL_SIZE = 4;
const SFX_BASE = "/assets/sounds/sfx";

const audioPools = new Map<string, HTMLAudioElement[]>();

const VOLUME_STORAGE_KEY = "sfx.globalVolume";
const VOLUME_EVENT = "sfx:volume";

function readStoredVolume(): number {
	if (globalThis.window === undefined) return 1;
	const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
	if (raw === null) return 1;
	const n = Number(raw);
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
	if (globalThis.window !== undefined) {
		window.localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
		window.dispatchEvent(new CustomEvent(VOLUME_EVENT));
	}
}

export function subscribeGlobalSfxVolume(listener: () => void): () => void {
	if (globalThis.window === undefined) return () => {};
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

export function playSfx(path: string, opts: SfxOptions = {}): void {
	if (globalThis.window === undefined) return;
	if (globalVolume <= 0) return;
	const audio = getFromPool(`${SFX_BASE}/${path}`, opts.exclusive === true);
	const base = opts.volume ?? 1;
	audio.volume = Math.max(0, Math.min(1, base * globalVolume));
	const variance = opts.pitchVariance ?? 0;
	audio.playbackRate = variance > 0 ? 1 + randSymmetric(variance) : 1;
	audio.play().catch(() => {});
}

const MONSTER_DEATH_SOUNDS = new Map([
	["morcego", "bat.wav"],
	["olho_do_vazio", "eyeball.wav"],
	["goblin", "goblin.wav"],
	["macaco", "gorilla.wav"],
	["esqueleto", "skeleton.wav"],
	["esqueleto_armadurado", "skeleton.wav"],
	["esqueleto_lanca", "skeleton.wav"],
	["serpente", "snake.wav"],
	["vampiro", "vampire.wav"],
	["criatura_do_vazio", "voidcreature.wav"],
	["zumbi", "zombie.wav"],
]);

export function playMonsterDeathSfx(monsterId: string): void {
	const file = MONSTER_DEATH_SOUNDS.get(monsterId);
	if (!file) return;
	playSfx(`creatures/${file}`, { volume: 0.5 });
}

export function playKillSfx(enemy: {
	def: { id: string };
	rarity: MonsterRarity;
}): void {
	const boss = getBossConfig(enemy);
	if (boss) {
		playSfx(boss.cinematic.deathSfx, { volume: 0.8 });
		return;
	}
	playMonsterDeathSfx(enemy.def.id);
}

export function playPlayerSwingSfx(weaponType: WeaponType): void {
	playSfx(WEAPON_FX[weaponType].sound, {
		volume: 0.3,
		pitchVariance: 0.1,
		exclusive: true,
	});
}
