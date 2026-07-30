/**
 * Phase 3M — presentation bus.
 * Combat resolves first; this only schedules audiovisual playback.
 */

import type { CombatJuiceFeedbackEvent } from '../types/combatJuiceFeedback';
import type { WeaponFamilyId } from '../types/weapon';
import type {
  WeaponCombatFeedbackPacket,
  WeaponCombatPresentationProfile,
} from '../types/weaponCombatPresentation';
import {
  HIT_STOP_MS,
  SHAKE_TO_JUICE,
} from '../types/weaponCombatPresentation';
import { getWeaponCombatPresentationProfile } from '../data/weaponCombatPresentation/profiles';
import {
  getCombatPresentationSettings,
  scalePresentationMs,
} from '../data/weaponCombatPresentation/presentationSettings';
import {
  playCombatPresentationCue,
  unlockCombatPresentationAudio,
} from './combatPresentationAudio';

type JuiceApi = {
  triggerHitstop: (ms: number) => void;
  triggerShake: (intensity: 'micro' | 'light' | 'heavy') => void;
  triggerHaptic: (type: 'impactLight' | 'impactHeavy' | 'notificationError') => Promise<void>;
};

function getJuice(): JuiceApi {
  try {
    // Lazy load so Node/tsx tests do not require expo-haptics native bindings.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./combatJuice') as JuiceApi;
  } catch {
    return {
      triggerHitstop: () => undefined,
      triggerShake: () => undefined,
      triggerHaptic: async () => undefined,
    };
  }
}

export type CombatPresentationVisualEvent = {
  id: string;
  weaponFamilyId: WeaponFamilyId;
  primitive: string;
  palette: string;
  stage: string;
  targetId?: string;
  reducedMotion: boolean;
  reducedFlash: boolean;
  durationMs: number;
  createdAt: number;
};

type VisualListener = (event: CombatPresentationVisualEvent) => void;
type PacketListener = (packet: WeaponCombatFeedbackPacket) => void;

let visualListener: VisualListener | null = null;
let packetListener: PacketListener | null = null;
const activeTimers = new Set<ReturnType<typeof setTimeout>>();
let burstHitStopAccumMs = 0;
let burstHitStopWindowUntil = 0;
let inputGuardUntil = 0;
let mounted = false;

export function registerCombatPresentationVisualListener(listener: VisualListener | null): void {
  visualListener = listener;
}

export function registerCombatPresentationPacketListener(listener: PacketListener | null): void {
  packetListener = listener;
}

export function setCombatPresentationMounted(next: boolean): void {
  mounted = next;
  if (!next) {
    clearCombatPresentationTimers();
    inputGuardUntil = 0;
  }
}

export function clearCombatPresentationTimers(): void {
  activeTimers.forEach((t) => clearTimeout(t));
  activeTimers.clear();
}

function schedule(ms: number, fn: () => void): void {
  const handle = setTimeout(() => {
    activeTimers.delete(handle);
    if (!mounted && !fn) return;
    try {
      fn();
    } catch {
      // Presentation failures must never throw into combat.
    }
  }, ms);
  activeTimers.add(handle);
}

export function isCombatPresentationInputGuarded(): boolean {
  return Date.now() < inputGuardUntil;
}

function armInputGuard(ms: number): void {
  inputGuardUntil = Math.max(inputGuardUntil, Date.now() + ms);
}

function applyHitStop(classKey: keyof typeof HIT_STOP_MS): void {
  const settings = getCombatPresentationSettings();
  if (settings.reducedMotion) return;
  const now = Date.now();
  if (now > burstHitStopWindowUntil) {
    burstHitStopAccumMs = 0;
    burstHitStopWindowUntil = now + 420;
  }
  const base = scalePresentationMs(HIT_STOP_MS[classKey]);
  const remainingCap = Math.max(0, 160 - burstHitStopAccumMs);
  const applied = Math.min(base, remainingCap);
  if (applied <= 0) return;
  burstHitStopAccumMs += applied;
  getJuice().triggerHitstop(applied);
}

function applyShake(classKey: keyof typeof SHAKE_TO_JUICE): void {
  const settings = getCombatPresentationSettings();
  if (settings.reducedMotion || !settings.screenShakeEnabled) return;
  const mapped = SHAKE_TO_JUICE[classKey];
  if (mapped) getJuice().triggerShake(mapped);
}

function applyHaptic(profile: WeaponCombatPresentationProfile): void {
  const settings = getCombatPresentationSettings();
  if (!settings.hapticsEnabled || settings.reducedMotion) return;
  if (profile.hapticClass === 'HEAVY') void getJuice().triggerHaptic('impactHeavy');
  else if (profile.hapticClass === 'LIGHT') void getJuice().triggerHaptic('impactLight');
}

export function dispatchWeaponCombatPresentation(packet: WeaponCombatFeedbackPacket): void {
  unlockCombatPresentationAudio();
  const settings = getCombatPresentationSettings();
  const profile = getWeaponCombatPresentationProfile(packet.weaponFamilyId);

  // Black Door: never play loaded release at zero rounds (non-lab).
  if (
    packet.weaponFamilyId === 'hex-void-cannon'
    && packet.ammoRoundsConsumed <= 0
    && packet.actionKind === 'ANCHOR'
    && !packet.labForced
  ) {
    playCombatPresentationCue(profile.cues.reloadOrSacrifice ?? profile.cues.resourceLoop);
    packetListener?.(packet);
    return;
  }

  // Revolver reload: once per reload event.
  if (packet.reloadOccurred) {
    playCombatPresentationCue(profile.cues.reloadOrSacrifice ?? profile.cues.resourceLoop);
  }

  // Heart's Due sacrifice: once per action.
  if (packet.sacrificeOccurred) {
    playCombatPresentationCue(profile.cues.reloadOrSacrifice ?? profile.cues.resourceLoop);
  }

  const sequence = packet.actionKind === 'ULTIMATE'
    ? profile.ultimateSequence
    : profile.anchorSequence;

  const totalMs = sequence.reduce(
    (max, step) => Math.max(max, step.delayMs + step.durationMs),
    180,
  );
  armInputGuard(scalePresentationMs(Math.min(totalMs, 420)));

  applyHitStop(packet.intensity);
  applyShake(packet.actionKind === 'ULTIMATE' ? 'ULTIMATE' : profile.shakeClass);
  applyHaptic(profile);

  packetListener?.(packet);

  const orderedHits = [...packet.hits].sort((a, b) => a.order - b.order);
  const firstHit = orderedHits[0];

  for (const step of sequence) {
    const delay = scalePresentationMs(step.delayMs);
    const duration = scalePresentationMs(step.durationMs);
    schedule(delay, () => {
      if (settings.reducedMotion && (step.primitive === 'screen_shake' || step.primitive === 'hit_stop')) {
        return;
      }
      const primitive = settings.reducedMotion
        ? profile.reducedMotionPrimitive
        : settings.reducedFlash
          ? profile.reducedFlashPrimitive
          : step.primitive;

      // Outcome truth: no damaging flesh on miss/evade.
      if (step.stage === 'CONTACT' && firstHit) {
        if (firstHit.outcome === 'MISS' || firstHit.outcome === 'EVADE') {
          playCombatPresentationCue(profile.cues.travel);
          visualListener?.({
            id: `${packet.id}-${step.stage}-miss`,
            weaponFamilyId: packet.weaponFamilyId,
            primitive: 'outline_pulse',
            palette: profile.palette,
            stage: step.stage,
            targetId: firstHit.targetId,
            reducedMotion: settings.reducedMotion,
            reducedFlash: settings.reducedFlash,
            durationMs: duration,
            createdAt: Date.now(),
          });
          return;
        }
        if (firstHit.defenseMaterial === 'KINETIC_ARMOR') {
          playCombatPresentationCue(profile.cues.kineticArmor);
        } else if (firstHit.defenseMaterial === 'OCCULT_WARD') {
          playCombatPresentationCue(profile.cues.occultWard);
        } else if (firstHit.damage > 0) {
          playCombatPresentationCue(step.cueId ?? profile.cues.fleshContact);
        } else {
          playCombatPresentationCue(profile.cues.travel);
        }
        if (firstHit.fullArmorBreak || firstHit.fullWardBreak) {
          playCombatPresentationCue(profile.cues.defenseBreak);
        }
        if (firstHit.fractureApplied || firstHit.fractureExploited) {
          playCombatPresentationCue(profile.cues.fracture);
        }
        if (firstHit.killed) {
          playCombatPresentationCue(profile.cues.killConfirm);
        }
        if (firstHit.critical) {
          playCombatPresentationCue('sfx.critical_hit');
        }
      } else if (step.cueId) {
        playCombatPresentationCue(step.cueId);
      } else if (step.stage === 'RELEASE') {
        playCombatPresentationCue(profile.cues.release);
      }

      visualListener?.({
        id: `${packet.id}-${step.stage}-${step.primitive}`,
        weaponFamilyId: packet.weaponFamilyId,
        primitive,
        palette: profile.palette,
        stage: step.stage,
        targetId: firstHit?.targetId,
        reducedMotion: settings.reducedMotion,
        reducedFlash: settings.reducedFlash,
        durationMs: duration,
        createdAt: Date.now(),
      });
    });
  }

  // Multi-target contacts (Funeral Knot / Cinder Sweep) — local aftermath only.
  for (const hit of orderedHits.slice(1)) {
    const delay = scalePresentationMs(120 + hit.order * 45);
    schedule(delay, () => {
      if (hit.outcome === 'MISS' || hit.outcome === 'EVADE') return;
      if (hit.defenseMaterial === 'KINETIC_ARMOR') {
        playCombatPresentationCue(profile.cues.kineticArmor);
      } else if (hit.defenseMaterial === 'OCCULT_WARD') {
        playCombatPresentationCue(profile.cues.occultWard);
      } else if (hit.damage > 0) {
        playCombatPresentationCue(profile.cues.fleshContact);
      }
      visualListener?.({
        id: `${packet.id}-extra-${hit.order}`,
        weaponFamilyId: packet.weaponFamilyId,
        primitive: settings.reducedMotion ? 'outline_pulse' : 'impact_spark',
        palette: profile.palette,
        stage: 'CONTACT',
        targetId: hit.targetId,
        reducedMotion: settings.reducedMotion,
        reducedFlash: settings.reducedFlash,
        durationMs: scalePresentationMs(70),
        createdAt: Date.now(),
      });
    });
  }
}

/** Bridge Phase 5 juice telemetry events into audible/visual presentation. */
export function dispatchCombatPresentationFromJuice(event: CombatJuiceFeedbackEvent): void {
  unlockCombatPresentationAudio();
  const settings = getCombatPresentationSettings();
  if (event.soundCueId) {
    playCombatPresentationCue(event.soundCueId);
  }
  if (event.hitStopMs && event.hitStopMs > 0 && !settings.reducedMotion) {
    getJuice().triggerHitstop(scalePresentationMs(event.hitStopMs));
  }
  if (event.screenShake && settings.screenShakeEnabled && !settings.reducedMotion) {
    const intensity = event.screenShake.intensity;
    getJuice().triggerShake(intensity >= 0.75 ? 'heavy' : intensity >= 0.4 ? 'light' : 'micro');
  }
  visualListener?.({
    id: event.id,
    weaponFamilyId: 'aegis-runed-longsword',
    primitive: settings.reducedFlash ? 'outline_pulse' : 'impact_spark',
    palette: 'PALE_STEEL_MINT',
    stage: 'CONTACT',
    targetId: event.targetCombatantIds?.[0],
    reducedMotion: settings.reducedMotion,
    reducedFlash: settings.reducedFlash,
    durationMs: scalePresentationMs(90),
    createdAt: Date.now(),
  });
}
