/**
 * App background music (module singleton — survives screen remounts).
 *
 * Hub: looping HTMLAudioElement.
 * Incursion: Web Audio dual-mix (explore + combat) started together and kept
 * sample-aligned; equal-power crossfade on combat enter/exit. Beds stop only
 * when leaving the incursion entirely.
 *
 * Per-track peak volumes: `BGM_TRACK_VOLUME` defaults + `setBgmTrackVolume(s)`.
 */

import {
  HUB_BGM_SAMPLE,
  RUN_COMBAT_BGM_SAMPLE,
  RUN_EXPLORE_BGM_SAMPLE,
} from './bgmAudioSamples';

export type BgmTrackId = 'hub' | 'run' | 'combat';
export type BgmDesired = BgmTrackId | 'none';

/**
 * Per-track peak volumes (0–1).
 * Hub uses HTMLAudio; in-run beds use Web Audio equal-power crossfade against these peaks.
 */
export const BGM_TRACK_VOLUME = {
  /** main-hub.mp3 */
  hub: 0.1,
  /** in-run-no-drum.m4a (exploration mix) */
  runNoDrum: 0.1,
  /** in-run-drum.m4a (combat mix) */
  runDrum: 0.1,
} as const;

type BgmTrackVolumeKey = keyof typeof BGM_TRACK_VOLUME;

let hubTrackVolume: number = BGM_TRACK_VOLUME.hub;
let runNoDrumTrackVolume: number = BGM_TRACK_VOLUME.runNoDrum;
let runDrumTrackVolume: number = BGM_TRACK_VOLUME.runDrum;

const DEFAULT_FADE_MS = 1400;
const HUB_ENTER_FADE_MS = 700;
/** Explore ↔ combat equal-power crossfade. */
const ADAPTIVE_XFADE_MS = 420;

type AudioEl = {
  src: string;
  loop: boolean;
  volume: number;
  muted: boolean;
  paused: boolean;
  preload: string;
  currentTime: number;
  play: () => Promise<void>;
  pause: () => void;
  load: () => void;
  addEventListener: (type: string, listener: () => void) => void;
};

type AudioCtxLike = {
  state: string;
  currentTime: number;
  destination: unknown;
  resume: () => Promise<void>;
  decodeAudioData: (data: ArrayBuffer) => Promise<AudioBuffer>;
  createGain: () => GainNodeLike;
  createBufferSource: () => BufferSourceLike;
};

type GainNodeLike = {
  gain: {
    value: number;
    setValueAtTime: (v: number, t: number) => void;
    cancelScheduledValues: (t: number) => void;
  };
  connect: (n: unknown) => GainNodeLike;
  disconnect: () => void;
};

type BufferSourceLike = {
  buffer: AudioBuffer | null;
  loop: boolean;
  connect: (n: unknown) => void;
  start: (when?: number) => void;
  stop: (when?: number) => void;
  onended: ((ev: Event) => void) | null;
};

let desired: BgmDesired = 'none';
let lastApplied: BgmDesired | null = null;
let unlocked = false;
let gestureBound = false;

// --- Hub (HTMLAudio) ---
let hubEl: AudioEl | null = null;
let hubGain = 0;
let hubFadeRaf = 0;
let hubWatchdog: ReturnType<typeof setInterval> | null = null;

// --- Incursion dual-mix (Web Audio) ---
let audioCtx: AudioCtxLike | null = null;
let exploreBuffer: AudioBuffer | null = null;
let combatBuffer: AudioBuffer | null = null;
let buffersLoadPromise: Promise<boolean> | null = null;
let exploreSource: BufferSourceLike | null = null;
let combatSource: BufferSourceLike | null = null;
let exploreGainNode: GainNodeLike | null = null;
let combatGainNode: GainNodeLike | null = null;
/** True while both synchronized beds are running. */
let bedsActive = false;
/** 0 = full explore, 1 = full combat mix. */
let mixT = 0;
let mixTarget = 0;
let mixFadeRaf = 0;

function isDev(): boolean {
  try {
    return Boolean((globalThis as { __DEV__?: boolean }).__DEV__);
  } catch {
    return false;
  }
}

function bgmLog(message: string): void {
  if (isDev()) {
    // eslint-disable-next-line no-console
    console.log(`[bgm] ${message}`);
  }
}

function bgmWarn(message: string): void {
  if (isDev()) {
    // eslint-disable-next-line no-console
    console.warn(`[bgm] ${message}`);
  }
}

function resolveSampleUri(source: unknown): string | null {
  if (source == null) return null;
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const uri = (source as { uri?: string; default?: string }).uri
      ?? (source as { default?: string }).default;
    if (typeof uri === 'string' && uri.length > 0) return uri;
  }
  if (typeof source === 'number') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rn = require('react-native') as {
        Image?: {
          resolveAssetSource?: (src: number) => { uri?: string } | undefined;
        };
      };
      const resolved = rn.Image?.resolveAssetSource?.(source);
      if (resolved?.uri) return resolved.uri;
    } catch {
      return null;
    }
  }
  return null;
}

function getAudioContextConstructor(): (new () => AudioCtxLike) | null {
  if (typeof globalThis === 'undefined') return null;
  const g = globalThis as unknown as {
    AudioContext?: new () => AudioCtxLike;
    webkitAudioContext?: new () => AudioCtxLike;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

function ensureAudioContext(): AudioCtxLike | null {
  if (audioCtx) return audioCtx;
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    audioCtx = null;
    return null;
  }
}

async function resumeContext(): Promise<void> {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // ignore
    }
  }
}

async function fetchAndDecode(uri: string): Promise<AudioBuffer | null> {
  const ctx = ensureAudioContext();
  if (!ctx || typeof fetch !== 'function') return null;
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      bgmWarn(`Failed to fetch ${uri} (${response.status})`);
      return null;
    }
    const raw = await response.arrayBuffer();
    return await ctx.decodeAudioData(raw.slice(0));
  } catch (err) {
    bgmWarn(`decode failed for ${uri}: ${String(err)}`);
    return null;
  }
}

/**
 * Preload both adaptive mixes. Safe to call early (hub).
 */
export async function preloadIncursionBeds(): Promise<boolean> {
  if (exploreBuffer && combatBuffer) return true;
  if (buffersLoadPromise) return buffersLoadPromise;

  buffersLoadPromise = (async () => {
    ensureAudioContext();
    const exploreUri = resolveSampleUri(RUN_EXPLORE_BGM_SAMPLE);
    const combatUri = resolveSampleUri(RUN_COMBAT_BGM_SAMPLE);
    if (!exploreUri || !combatUri) {
      bgmWarn('Incursion BGM sample URIs unavailable (Node stub or missing assets).');
      return false;
    }
    const [explore, combat] = await Promise.all([
      fetchAndDecode(exploreUri),
      fetchAndDecode(combatUri),
    ]);
    if (!explore || !combat) {
      bgmWarn('Incursion BGM buffers failed to load — adaptive music disabled.');
      return false;
    }
    const durationDelta = Math.abs(explore.duration - combat.duration);
    if (durationDelta > 0.05) {
      bgmWarn(
        `Adaptive mix duration mismatch: explore=${explore.duration.toFixed(3)}s `
        + `combat=${combat.duration.toFixed(3)}s (Δ=${durationDelta.toFixed(3)}s). `
        + 'Crossfades may drift.',
      );
    } else if (explore.sampleRate !== combat.sampleRate) {
      bgmWarn(
        `Adaptive mix sample-rate mismatch: explore=${explore.sampleRate} `
        + `combat=${combat.sampleRate}`,
      );
    } else {
      bgmLog(
        `Incursion beds ready (${explore.duration.toFixed(2)}s @ ${explore.sampleRate}Hz)`,
      );
    }
    exploreBuffer = explore;
    combatBuffer = combat;
    return true;
  })();

  try {
    return await buffersLoadPromise;
  } finally {
    // Keep promise cached on success; clear on failure so retry is possible.
    if (!exploreBuffer || !combatBuffer) {
      buffersLoadPromise = null;
    }
  }
}

function clampVolume(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** User music × master mix (from audio prefs). Track peaks stay authored. */
let musicUserMix = 1;
let masterUserMix = 1;

function userMusicScale(): number {
  return musicUserMix * masterUserMix;
}

function applyMixGains(): void {
  const ctx = audioCtx;
  if (!ctx || !exploreGainNode || !combatGainNode) return;
  const scale = userMusicScale();
  // Equal-power: never both at full — scaled by each bed's track volume × user mix.
  const explore = Math.cos(mixT * Math.PI / 2) * runNoDrumTrackVolume * scale;
  const combat = Math.sin(mixT * Math.PI / 2) * runDrumTrackVolume * scale;
  const now = ctx.currentTime;
  try {
    exploreGainNode.gain.cancelScheduledValues(now);
    combatGainNode.gain.cancelScheduledValues(now);
    exploreGainNode.gain.setValueAtTime(Math.max(0, explore), now);
    combatGainNode.gain.setValueAtTime(Math.max(0, combat), now);
  } catch {
    exploreGainNode.gain.value = Math.max(0, explore);
    combatGainNode.gain.value = Math.max(0, combat);
  }
}

function stopMixFade(): void {
  if (mixFadeRaf && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(mixFadeRaf);
  }
  mixFadeRaf = 0;
}

function setAdaptiveMixTarget(target: 0 | 1, fadeMs: number = ADAPTIVE_XFADE_MS): void {
  mixTarget = target;
  stopMixFade();
  if (!bedsActive) return;

  const start = mixT;
  if (Math.abs(start - target) < 0.001) {
    mixT = target;
    applyMixGains();
    return;
  }

  const duration = Math.max(80, fadeMs);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  bgmLog(target === 1 ? 'transition → combat mix' : 'transition → exploration mix');

  const step = (now: number) => {
    // If target redirected mid-fade, continue toward current mixTarget from latest mixT.
    const goal = mixTarget;
    const t = Math.min(1, (now - t0) / duration);
    const e = t * t * (3 - 2 * t);
    // Re-base each frame from original start only works for one target.
    // For redirects: restart fade from current mixT when setAdaptiveMixTarget is called again.
    mixT = start + (goal - start) * e;
    applyMixGains();
    if (t < 1 && Math.abs(mixT - goal) > 0.001) {
      mixFadeRaf = requestAnimationFrame(step);
      return;
    }
    mixT = goal;
    applyMixGains();
    mixFadeRaf = 0;
  };

  if (typeof requestAnimationFrame === 'function') {
    mixFadeRaf = requestAnimationFrame(step);
  } else {
    mixT = target;
    applyMixGains();
  }
}

function stopIncursionBeds(): void {
  stopMixFade();
  try {
    exploreSource?.stop();
  } catch {
    // ignore
  }
  try {
    combatSource?.stop();
  } catch {
    // ignore
  }
  try {
    exploreGainNode?.disconnect();
  } catch {
    // ignore
  }
  try {
    combatGainNode?.disconnect();
  } catch {
    // ignore
  }
  exploreSource = null;
  combatSource = null;
  exploreGainNode = null;
  combatGainNode = null;
  if (bedsActive) {
    bgmLog('incursion beds stopped/reset');
  }
  bedsActive = false;
  mixT = 0;
  mixTarget = 0;
}

async function startIncursionBeds(initialMix: 0 | 1): Promise<boolean> {
  if (bedsActive) return true;
  const ok = await preloadIncursionBeds();
  if (!ok || !exploreBuffer || !combatBuffer) return false;

  await resumeContext();
  const ctx = ensureAudioContext();
  if (!ctx) {
    bgmWarn('No AudioContext — cannot start incursion beds.');
    return false;
  }

  stopIncursionBeds();

  exploreGainNode = ctx.createGain();
  combatGainNode = ctx.createGain();
  exploreGainNode.connect(ctx.destination);
  combatGainNode.connect(ctx.destination);

  exploreSource = ctx.createBufferSource();
  combatSource = ctx.createBufferSource();
  exploreSource.buffer = exploreBuffer;
  combatSource.buffer = combatBuffer;
  exploreSource.loop = true;
  combatSource.loop = true;
  exploreSource.connect(exploreGainNode);
  combatSource.connect(combatGainNode);

  mixT = initialMix;
  mixTarget = initialMix;
  applyMixGains();

  const when = ctx.currentTime + 0.03;
  try {
    exploreSource.start(when);
    combatSource.start(when);
  } catch (err) {
    bgmWarn(`Failed to start synchronized beds: ${String(err)}`);
    stopIncursionBeds();
    return false;
  }

  bedsActive = true;
  bgmLog(
    initialMix === 1
      ? 'incursion start (combat mix audible)'
      : 'incursion start (exploration mix audible)',
  );
  return true;
}

// --- Hub HTMLAudio ---

function ensureHubElement(): void {
  if (hubEl) return;
  const uri = resolveSampleUri(HUB_BGM_SAMPLE);
  if (!uri || typeof Audio === 'undefined') return;
  try {
    const el = new Audio(uri) as unknown as AudioEl;
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    el.load();
    el.addEventListener('ended', () => {
      if (desired !== 'hub') return;
      try {
        el.currentTime = 0;
      } catch {
        // ignore
      }
      void tryPlayHub();
    });
    hubEl = el;
  } catch {
    hubEl = null;
  }
}

function applyHubVolume(): void {
  if (hubEl) hubEl.volume = clampVolume(hubGain * hubTrackVolume * userMusicScale());
}

async function tryPlayHub(): Promise<boolean> {
  if (!hubEl) return false;
  if (!hubEl.paused) return true;
  try {
    await hubEl.play();
    unlocked = true;
    return true;
  } catch {
    return false;
  }
}

function pauseHubIfSilent(): void {
  if (!hubEl) return;
  if (hubGain <= 0.001 && !hubEl.paused) {
    try {
      hubEl.pause();
    } catch {
      // ignore
    }
  }
}

function stopHubFade(): void {
  if (hubFadeRaf && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(hubFadeRaf);
  }
  hubFadeRaf = 0;
}

function animateHubGain(target: number, fadeMs: number): void {
  stopHubFade();
  const start = hubGain;
  const duration = Math.max(80, fadeMs);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (target > 0) void tryPlayHub();

  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const e = t * t * (3 - 2 * t);
    hubGain = start + (target - start) * e;
    applyHubVolume();
    if (t < 1) {
      hubFadeRaf = requestAnimationFrame(step);
      return;
    }
    hubGain = target;
    applyHubVolume();
    pauseHubIfSilent();
    hubFadeRaf = 0;
    if (target > 0) void tryPlayHub();
  };

  if (typeof requestAnimationFrame === 'function') {
    hubFadeRaf = requestAnimationFrame(step);
  } else {
    hubGain = target;
    applyHubVolume();
    pauseHubIfSilent();
  }
}

function startHubWatchdog(): void {
  if (hubWatchdog != null) return;
  hubWatchdog = setInterval(() => {
    if (desired !== 'hub') return;
    ensureHubElement();
    if (hubEl?.paused) void tryPlayHub();
    if (hubGain < 0.2 && hubFadeRaf === 0) {
      lastApplied = null;
      setBgmDesired('hub', HUB_ENTER_FADE_MS);
    }
  }, 800);
}

function stopHubWatchdog(): void {
  if (hubWatchdog == null) return;
  clearInterval(hubWatchdog);
  hubWatchdog = null;
}

function bindGestureUnlock(): void {
  if (gestureBound || typeof document === 'undefined') return;
  gestureBound = true;
  const unlock = () => {
    unlockBgm();
  };
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('touchstart', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', unlock, { capture: true });
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => {
      void resumeContext();
      if (desired === 'hub') void tryPlayHub();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void resumeContext();
        if (desired === 'hub') void tryPlayHub();
      }
    });
  }
}

/**
 * Unlock autoplay / resume AudioContext. Preloads adaptive beds.
 */
export function unlockBgm(): void {
  unlocked = true;
  bindGestureUnlock();
  ensureHubElement();
  void resumeContext();
  void preloadIncursionBeds();
  if (desired === 'hub') void tryPlayHub();
  if (bedsActive) applyMixGains();
}

/**
 * Request hub / run (explore) / combat (drums) / silence.
 * run ↔ combat only crossfades adaptive beds; hub/none stops and resets them.
 */
export function setBgmDesired(next: BgmDesired, fadeMs: number = DEFAULT_FADE_MS): void {
  bindGestureUnlock();
  ensureHubElement();
  void resumeContext();
  void preloadIncursionBeds();

  const prev = lastApplied;
  desired = next;

  if (next === 'hub') startHubWatchdog();
  else stopHubWatchdog();

  const stayingOnSame = prev === next && hubFadeRaf === 0 && mixFadeRaf === 0;
  if (stayingOnSame) {
    if (next === 'hub') {
      void tryPlayHub();
      if (hubGain < 0.15) animateHubGain(1, Math.min(fadeMs, HUB_ENTER_FADE_MS));
    } else if (next === 'run' || next === 'combat') {
      if (!bedsActive) {
        void startIncursionBeds(next === 'combat' ? 1 : 0);
      } else {
        applyMixGains();
      }
    }
    return;
  }

  lastApplied = next;

  if (next === 'hub') {
    stopIncursionBeds();
    animateHubGain(1, Math.min(fadeMs, HUB_ENTER_FADE_MS));
    return;
  }

  if (next === 'none') {
    stopIncursionBeds();
    animateHubGain(0, fadeMs);
    return;
  }

  // Incursion: run (explore) or combat (drums).
  animateHubGain(0, Math.min(fadeMs, 600));
  const wantCombat = next === 'combat';

  if (!bedsActive) {
    void startIncursionBeds(wantCombat ? 1 : 0).then((started) => {
      if (!started) return;
      // If desired flipped while loading, honor latest.
      if (desired === 'combat') setAdaptiveMixTarget(1, ADAPTIVE_XFADE_MS);
      else if (desired === 'run') setAdaptiveMixTarget(0, ADAPTIVE_XFADE_MS);
      else stopIncursionBeds();
    });
    return;
  }

  setAdaptiveMixTarget(wantCombat ? 1 : 0, ADAPTIVE_XFADE_MS);
}

/**
 * Veil Front visible — force hub loop on.
 */
export function ensureHubBgmPlaying(fadeMs: number = HUB_ENTER_FADE_MS): void {
  unlockBgm();
  desired = 'hub';
  startHubWatchdog();
  if (hubEl?.paused || hubGain < 0.85 || lastApplied !== 'hub' || bedsActive) {
    lastApplied = null;
    setBgmDesired('hub', fadeMs);
    return;
  }
  applyHubVolume();
  void tryPlayHub();
}

export function getBgmDesired(): BgmDesired {
  return desired;
}

export function silenceBgm(fadeMs: number = DEFAULT_FADE_MS): void {
  setBgmDesired('none', fadeMs);
}

/** Current peak volumes for each music track. */
export function getBgmTrackVolumes(): {
  hub: number;
  runNoDrum: number;
  runDrum: number;
} {
  return {
    hub: hubTrackVolume,
    runNoDrum: runNoDrumTrackVolume,
    runDrum: runDrumTrackVolume,
  };
}

/**
 * Set peak volume for one track (0–1). Applies immediately to active playback.
 * - hub → main hub loop
 * - runNoDrum → in-run exploration bed
 * - runDrum → in-run combat/drums bed
 */
export function setBgmTrackVolume(track: BgmTrackVolumeKey, volume: number): void {
  const next = clampVolume(volume);
  if (track === 'hub') {
    hubTrackVolume = next;
    applyHubVolume();
    return;
  }
  if (track === 'runNoDrum') {
    runNoDrumTrackVolume = next;
    if (bedsActive) applyMixGains();
    return;
  }
  runDrumTrackVolume = next;
  if (bedsActive) applyMixGains();
}

/** Set any subset of track volumes at once. */
export function setBgmTrackVolumes(partial: Partial<{
  hub: number;
  runNoDrum: number;
  runDrum: number;
}>): void {
  if (partial.hub != null) hubTrackVolume = clampVolume(partial.hub);
  if (partial.runNoDrum != null) runNoDrumTrackVolume = clampVolume(partial.runNoDrum);
  if (partial.runDrum != null) runDrumTrackVolume = clampVolume(partial.runDrum);
  applyHubVolume();
  if (bedsActive) applyMixGains();
}

/**
 * User-facing music / master mix (0–1). Multiplies authored track peaks.
 * Does not overwrite BGM_TRACK_VOLUME / setBgmTrackVolume peaks.
 */
export function setBgmUserMix(partial: { music?: number; master?: number }): void {
  if (partial.music != null) musicUserMix = clampVolume(partial.music);
  if (partial.master != null) masterUserMix = clampVolume(partial.master);
  applyHubVolume();
  if (bedsActive) applyMixGains();
}

export function getBgmUserMix(): { music: number; master: number } {
  return { music: musicUserMix, master: masterUserMix };
}
