/**
 * App background music — HTMLAudioElement with volume fades.
 * Hub / run loop. Combat plays start once, then loops the combat loop bed.
 * Never throws into game flow. Autoplay unlocks after a user gesture.
 */

import {
  COMBAT_LOOP_BGM_SAMPLE,
  COMBAT_START_BGM_SAMPLE,
  HUB_BGM_SAMPLE,
  RUN_BGM_SAMPLE,
} from './bgmAudioSamples';

export type BgmTrackId = 'hub' | 'run' | 'combat';
export type BgmDesired = BgmTrackId | 'none';

const MASTER_VOLUME = 0.42;
/** Combat bed (start + loop) — independent of hub/run master. */
const COMBAT_VOLUME = 0.075;
const DEFAULT_FADE_MS = 1400;
const HUB_ENTER_FADE_MS = 700;
const COMBAT_ENTER_FADE_MS = 900;

type AudioEl = {
  src: string;
  loop: boolean;
  volume: number;
  muted: boolean;
  paused: boolean;
  preload: string;
  currentTime: number;
  readyState: number;
  play: () => Promise<void>;
  pause: () => void;
  load: () => void;
  addEventListener: (type: string, listener: () => void) => void;
};

let hubEl: AudioEl | null = null;
let runEl: AudioEl | null = null;
let combatStartEl: AudioEl | null = null;
let combatLoopEl: AudioEl | null = null;
let hubGain = 0;
let runGain = 0;
let combatGain = 0;
let desired: BgmDesired = 'none';
let unlocked = false;
let fadeRaf = 0;
let gestureBound = false;
let lastApplied: BgmDesired | null = null;
let hubWatchdog: ReturnType<typeof setInterval> | null = null;
/** Combat bed phase while desired === 'combat'. */
let combatPhase: 'intro' | 'loop' = 'intro';
let combatEndedBound = false;

function canUseDomAudio(): boolean {
  return typeof Audio !== 'undefined';
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

function makeAudioEl(uri: string, loop: boolean): AudioEl | null {
  if (!canUseDomAudio()) return null;
  try {
    const el = new Audio(uri) as unknown as AudioEl;
    el.loop = loop;
    el.preload = 'auto';
    el.volume = 0;
    el.muted = false;
    el.load();
    return el;
  } catch {
    return null;
  }
}

function bindLoopFallback(el: AudioEl, track: 'hub' | 'run' | 'combatLoop'): void {
  el.addEventListener('ended', () => {
    if (track === 'hub' && desired !== 'hub') return;
    if (track === 'run' && desired !== 'run') return;
    if (track === 'combatLoop' && (desired !== 'combat' || combatPhase !== 'loop')) return;
    try {
      el.currentTime = 0;
    } catch {
      // ignore
    }
    void tryPlay(el);
  });
}

function bindCombatIntroEnded(): void {
  if (!combatStartEl || combatEndedBound) return;
  combatEndedBound = true;
  combatStartEl.addEventListener('ended', () => {
    if (desired !== 'combat') return;
    combatPhase = 'loop';
    try {
      combatStartEl!.pause();
    } catch {
      // ignore
    }
    if (combatLoopEl) {
      try {
        combatLoopEl.currentTime = 0;
      } catch {
        // ignore
      }
      applyVolumes();
      void tryPlay(combatLoopEl);
    }
  });
}

function ensureElements(): void {
  if (!hubEl) {
    const uri = resolveSampleUri(HUB_BGM_SAMPLE);
    if (uri) {
      hubEl = makeAudioEl(uri, true);
      if (hubEl) bindLoopFallback(hubEl, 'hub');
    }
  }
  if (!runEl) {
    const uri = resolveSampleUri(RUN_BGM_SAMPLE);
    if (uri) {
      runEl = makeAudioEl(uri, true);
      if (runEl) bindLoopFallback(runEl, 'run');
    }
  }
  if (!combatStartEl) {
    const uri = resolveSampleUri(COMBAT_START_BGM_SAMPLE);
    if (uri) {
      combatStartEl = makeAudioEl(uri, false);
      bindCombatIntroEnded();
    }
  }
  if (!combatLoopEl) {
    const uri = resolveSampleUri(COMBAT_LOOP_BGM_SAMPLE);
    if (uri) {
      combatLoopEl = makeAudioEl(uri, true);
      if (combatLoopEl) bindLoopFallback(combatLoopEl, 'combatLoop');
    }
  }
}

function applyVolumes(): void {
  if (hubEl) hubEl.volume = Math.max(0, Math.min(1, hubGain * MASTER_VOLUME));
  if (runEl) runEl.volume = Math.max(0, Math.min(1, runGain * MASTER_VOLUME));
  const combatVol = Math.max(0, Math.min(1, combatGain * COMBAT_VOLUME));
  if (combatStartEl) combatStartEl.volume = combatVol;
  if (combatLoopEl) combatLoopEl.volume = combatVol;
}

function stopFade(): void {
  if (fadeRaf && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(fadeRaf);
  }
  fadeRaf = 0;
}

async function tryPlay(el: AudioEl | null): Promise<boolean> {
  if (!el) return false;
  if (!el.paused) return true;
  try {
    await el.play();
    unlocked = true;
    return true;
  } catch {
    return false;
  }
}

function pauseIfSilent(el: AudioEl | null, gain: number): void {
  if (!el) return;
  if (gain <= 0.001 && !el.paused) {
    try {
      el.pause();
    } catch {
      // ignore
    }
  }
}

function pauseCombatBeds(): void {
  pauseIfSilent(combatStartEl, 0);
  pauseIfSilent(combatLoopEl, 0);
  try {
    if (combatStartEl) combatStartEl.currentTime = 0;
    if (combatLoopEl) combatLoopEl.currentTime = 0;
  } catch {
    // ignore
  }
}

function startCombatIntroPlayback(): void {
  combatPhase = 'intro';
  try {
    if (combatLoopEl) {
      combatLoopEl.pause();
      combatLoopEl.currentTime = 0;
    }
    if (combatStartEl) {
      combatStartEl.currentTime = 0;
    }
  } catch {
    // ignore
  }
  void tryPlay(combatStartEl);
}

function animateGains(
  targetHub: number,
  targetRun: number,
  targetCombat: number,
  fadeMs: number,
): void {
  stopFade();
  const startHub = hubGain;
  const startRun = runGain;
  const startCombat = combatGain;
  const duration = Math.max(80, fadeMs);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  if (targetHub > 0) void tryPlay(hubEl);
  if (targetRun > 0) void tryPlay(runEl);
  if (targetCombat > 0) {
    if (combatPhase === 'intro') void tryPlay(combatStartEl);
    else void tryPlay(combatLoopEl);
  }

  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const e = t * t * (3 - 2 * t);
    hubGain = startHub + (targetHub - startHub) * e;
    runGain = startRun + (targetRun - startRun) * e;
    combatGain = startCombat + (targetCombat - startCombat) * e;
    applyVolumes();
    if (t < 1) {
      fadeRaf = requestAnimationFrame(step);
      return;
    }
    hubGain = targetHub;
    runGain = targetRun;
    combatGain = targetCombat;
    applyVolumes();
    pauseIfSilent(hubEl, hubGain);
    pauseIfSilent(runEl, runGain);
    if (combatGain <= 0.001) {
      pauseCombatBeds();
    } else if (combatPhase === 'intro') {
      void tryPlay(combatStartEl);
      pauseIfSilent(combatLoopEl, 0);
    } else {
      void tryPlay(combatLoopEl);
      pauseIfSilent(combatStartEl, 0);
    }
    fadeRaf = 0;
    if (targetHub > 0) void tryPlay(hubEl);
    if (targetRun > 0) void tryPlay(runEl);
  };

  if (typeof requestAnimationFrame === 'function') {
    fadeRaf = requestAnimationFrame(step);
  } else {
    hubGain = targetHub;
    runGain = targetRun;
    combatGain = targetCombat;
    applyVolumes();
    pauseIfSilent(hubEl, hubGain);
    pauseIfSilent(runEl, runGain);
    if (combatGain <= 0.001) pauseCombatBeds();
  }
}

function targetsFor(next: BgmDesired): { hub: number; run: number; combat: number } {
  if (next === 'hub') return { hub: 1, run: 0, combat: 0 };
  if (next === 'run') return { hub: 0, run: 1, combat: 0 };
  if (next === 'combat') return { hub: 0, run: 0, combat: 1 };
  return { hub: 0, run: 0, combat: 0 };
}

function syncActivePlayback(): void {
  ensureElements();
  const t = targetsFor(desired);
  applyVolumes();
  if (t.hub > 0) void tryPlay(hubEl);
  if (t.run > 0) void tryPlay(runEl);
  if (t.combat > 0) {
    if (combatPhase === 'intro') void tryPlay(combatStartEl);
    else void tryPlay(combatLoopEl);
  }
}

function startHubWatchdog(): void {
  if (hubWatchdog != null) return;
  hubWatchdog = setInterval(() => {
    if (desired !== 'hub') return;
    if (!hubEl) ensureElements();
    if (hubEl?.paused) void tryPlay(hubEl);
    if (hubGain < 0.2 && fadeRaf === 0) {
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

/**
 * Mark audio as user-unlocked and resume whatever track is desired.
 */
export function unlockBgm(): void {
  unlocked = true;
  ensureElements();
  syncActivePlayback();
  if (desired === 'hub' && (hubEl?.paused || hubGain < 0.15) && fadeRaf === 0) {
    lastApplied = null;
    setBgmDesired('hub', HUB_ENTER_FADE_MS);
  }
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
    window.addEventListener('focus', syncActivePlayback);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncActivePlayback();
    });
  }
}

/**
 * Request hub / run / combat / silence with a crossfade.
 */
export function setBgmDesired(next: BgmDesired, fadeMs: number = DEFAULT_FADE_MS): void {
  bindGestureUnlock();
  ensureElements();
  const enteringCombat = next === 'combat' && lastApplied !== 'combat';
  desired = next;
  if (next === 'hub') startHubWatchdog();
  else stopHubWatchdog();

  if (enteringCombat) {
    startCombatIntroPlayback();
  }

  if (lastApplied === next && fadeRaf === 0) {
    syncActivePlayback();
    if (next === 'hub' && hubGain < 0.15) {
      animateGains(1, 0, 0, Math.min(fadeMs, HUB_ENTER_FADE_MS));
    }
    return;
  }
  lastApplied = next;
  const t = targetsFor(next);
  const ms = next === 'combat' && enteringCombat
    ? Math.min(fadeMs, COMBAT_ENTER_FADE_MS)
    : fadeMs;
  animateGains(t.hub, t.run, t.combat, ms);
}

/**
 * Veil Front visible — force hub loop on.
 */
export function ensureHubBgmPlaying(fadeMs: number = HUB_ENTER_FADE_MS): void {
  bindGestureUnlock();
  ensureElements();
  unlocked = true;
  desired = 'hub';
  startHubWatchdog();
  if (hubEl?.paused || hubGain < 0.85 || lastApplied !== 'hub') {
    lastApplied = null;
    setBgmDesired('hub', fadeMs);
    return;
  }
  applyVolumes();
  void tryPlay(hubEl);
}

export function getBgmDesired(): BgmDesired {
  return desired;
}

export function silenceBgm(fadeMs: number = DEFAULT_FADE_MS): void {
  setBgmDesired('none', fadeMs);
}
