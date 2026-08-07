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

/** Scythe never stacks secondary weapon cues — only attack + delayed impact. */
const SCYTHE_WEAPON_FAMILY: WeaponFamilyId = 'envoy-null-conduit';
const SCYTHE_ALLOWED_CUES = new Set([
  'sfx.scythe.release',
  'sfx.scythe.impact',
  'sfx.scythe.ultimate',
]);

const AEGIS_WEAPON_FAMILIES = new Set<WeaponFamilyId>([
  'aegis-runed-longsword',
  'aegis-claymore-blade',
  'aegis-rift-edge',
]);

function isAegisWeaponFamily(weaponFamilyId: WeaponFamilyId): boolean {
  return AEGIS_WEAPON_FAMILIES.has(weaponFamilyId);
}

function isMissOrEvadeOutcome(outcome: string | undefined): boolean {
  return outcome === 'MISS' || outcome === 'EVADE';
}

/** Attack-like release cues that should become sfx.aegis.miss on evade. */
function isAegisAttackLikeCue(cueId: string): boolean {
  return (
    cueId.includes('.attack')
    || cueId.endsWith('.release')
    || cueId.includes('.ultimate')
    || cueId.includes('.ult')
    || cueId === 'sfx.paired.ult_flurry'
  );
}

function playWeaponFamilyCue(
  weaponFamilyId: WeaponFamilyId,
  cueId: string | undefined,
): void {
  if (!cueId) return;
  if (weaponFamilyId === SCYTHE_WEAPON_FAMILY && !SCYTHE_ALLOWED_CUES.has(cueId)) {
    return;
  }
  playCombatPresentationCue(cueId);
}

/**
 * On Aegis miss/evade, play miss once in place of attack/release cues;
 * suppress contact travel so the attack whoosh never fires.
 */
function playAegisAwareCue(input: {
  weaponFamilyId: WeaponFamilyId;
  cueId: string | undefined;
  stage: string;
  outcome: string | undefined;
  missPlayed: { value: boolean };
}): void {
  const { weaponFamilyId, cueId, stage, outcome, missPlayed } = input;
  if (
    isAegisWeaponFamily(weaponFamilyId)
    && isMissOrEvadeOutcome(outcome)
  ) {
    if (stage === 'CONTACT') {
      return;
    }
    if (cueId && isAegisAttackLikeCue(cueId)) {
      if (!missPlayed.value) {
        missPlayed.value = true;
        playCombatPresentationCue('sfx.aegis.miss');
      }
      return;
    }
    if (stage === 'RELEASE') {
      if (!missPlayed.value) {
        missPlayed.value = true;
        playCombatPresentationCue('sfx.aegis.miss');
      }
      return;
    }
  }
  playWeaponFamilyCue(weaponFamilyId, cueId);
}

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
/** Fires when damaging CONTACT should reveal enemy hit FX / damage numbers. */
export type CombatPresentationContactReveal = {
  targetId: string;
  packetId: string;
  critical: boolean;
  damage: number;
};
type ContactRevealListener = (reveal: CombatPresentationContactReveal) => void;

let visualListener: VisualListener | null = null;
let packetListener: PacketListener | null = null;
let contactRevealListener: ContactRevealListener | null = null;
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

export function registerCombatPresentationContactRevealListener(
  listener: ContactRevealListener | null,
): void {
  contactRevealListener = listener;
}

function emitContactReveal(reveal: CombatPresentationContactReveal): void {
  if (!(reveal.damage > 0) || !reveal.targetId) return;
  try {
    contactRevealListener?.(reveal);
  } catch {
    // Presentation must never throw into combat.
  }
}

/** Immediate contact reveal for multi-hit burst follow-ups (no scheduled CONTACT). */
export function revealWeaponCombatContact(reveal: CombatPresentationContactReveal): void {
  emitContactReveal(reveal);
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
  // Requires an explicit zero — default packet ammo is 1 for normal hits.
  if (
    packet.weaponFamilyId === 'hex-void-cannon'
    && packet.ammoRoundsConsumed === 0
    && packet.actionKind === 'ANCHOR'
    && !packet.labForced
  ) {
    playCombatPresentationCue(profile.cues.reloadOrSacrifice ?? profile.cues.resourceLoop);
    packetListener?.(packet);
    return;
  }

  // Reload-only: play reload cue, never run the attack/release sequence.
  if (packet.actionKind === 'RELOAD' || packet.reloadOccurred) {
    playWeaponFamilyCue(packet.weaponFamilyId, profile.cues.reloadOrSacrifice ?? profile.cues.resourceLoop);
    packetListener?.(packet);
    return;
  }

  // Heart's Due sacrifice: once per action.
  if (packet.sacrificeOccurred) {
    playWeaponFamilyCue(packet.weaponFamilyId, profile.cues.reloadOrSacrifice ?? profile.cues.resourceLoop);
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
  const aegisMissPlayed = { value: false };
  const critStingPlayed = { value: false };
  const contactRevealed = { value: false };

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
        // Scythe: release-only — skip armor/ward/crit/kill contact accents.
        if (packet.weaponFamilyId !== SCYTHE_WEAPON_FAMILY) {
          if (firstHit.outcome === 'MISS' || firstHit.outcome === 'EVADE') {
            playAegisAwareCue({
              weaponFamilyId: packet.weaponFamilyId,
              cueId: profile.cues.travel,
              stage: step.stage,
              outcome: firstHit.outcome,
              missPlayed: aegisMissPlayed,
            });
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
            playWeaponFamilyCue(packet.weaponFamilyId, profile.cues.kineticArmor);
          } else if (firstHit.defenseMaterial === 'OCCULT_WARD') {
            playWeaponFamilyCue(packet.weaponFamilyId, profile.cues.occultWard);
          } else if (firstHit.damage > 0) {
            playWeaponFamilyCue(packet.weaponFamilyId, step.cueId ?? profile.cues.fleshContact);
          } else {
            playWeaponFamilyCue(packet.weaponFamilyId, profile.cues.travel);
          }
          if (firstHit.fullArmorBreak || firstHit.fullWardBreak) {
            playWeaponFamilyCue(packet.weaponFamilyId, profile.cues.defenseBreak);
          }
          if (firstHit.fractureApplied || firstHit.fractureExploited) {
            playWeaponFamilyCue(packet.weaponFamilyId, profile.cues.fracture);
          }
          if (firstHit.killed) {
            playWeaponFamilyCue(packet.weaponFamilyId, profile.cues.killConfirm);
          }
        } else if (firstHit.outcome === 'MISS' || firstHit.outcome === 'EVADE') {
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
        // Crit sting once per packet (including Scythe release-only contact).
        // Miss/evade already returned above — remaining CONTACT is a real hit path.
        if (
          !critStingPlayed.value
          && firstHit.critical
          && firstHit.damage > 0
        ) {
          critStingPlayed.value = true;
          playCombatPresentationCue('sfx.critical_hit');
        }
        // Damage numbers / hitFlash flush on the same beat as CONTACT VFX.
        if (!contactRevealed.value && firstHit.damage > 0) {
          contactRevealed.value = true;
          emitContactReveal({
            targetId: firstHit.targetId,
            packetId: packet.id,
            critical: firstHit.critical === true,
            damage: firstHit.damage,
          });
        }
      } else if (step.cueId) {
        playAegisAwareCue({
          weaponFamilyId: packet.weaponFamilyId,
          cueId: step.cueId,
          stage: step.stage,
          outcome: firstHit?.outcome,
          missPlayed: aegisMissPlayed,
        });
      } else if (step.stage === 'RELEASE') {
        playAegisAwareCue({
          weaponFamilyId: packet.weaponFamilyId,
          cueId: profile.cues.release,
          stage: step.stage,
          outcome: firstHit?.outcome,
          missPlayed: aegisMissPlayed,
        });
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
      if (packet.weaponFamilyId !== SCYTHE_WEAPON_FAMILY) {
        if (hit.defenseMaterial === 'KINETIC_ARMOR') {
          playWeaponFamilyCue(packet.weaponFamilyId, profile.cues.kineticArmor);
        } else if (hit.defenseMaterial === 'OCCULT_WARD') {
          playWeaponFamilyCue(packet.weaponFamilyId, profile.cues.occultWard);
        } else if (hit.damage > 0) {
          playWeaponFamilyCue(packet.weaponFamilyId, profile.cues.fleshContact);
        }
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
      if (hit.damage > 0) {
        emitContactReveal({
          targetId: hit.targetId,
          packetId: `${packet.id}-extra-${hit.order}`,
          critical: hit.critical === true,
          damage: hit.damage,
        });
      }
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
