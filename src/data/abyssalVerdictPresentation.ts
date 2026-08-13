/**
 * ABYSSAL VERDICT — Longsword ultimate cinematic presentation controller.
 * Presentation only. Combat math commits in the hub; visual reveal waits for IMPACT.
 *
 * Stable gameplay IDs (do not change): THREEFOLD_BRAND / EVISCERATE.
 * Canonical targeting: SINGLE (primary resolved combatant ID only).
 */

import type { WeaponFamilyId } from '../types/weapon';
import {
  getCombatPresentationSettings,
  scalePresentationMs,
} from './weaponCombatPresentation/presentationSettings';
import { areAbyssalVerdictAssetsAvailable } from './abyssalVerdictArt';

export const ABYSSAL_VERDICT_LONGSWORD_FAMILY: WeaponFamilyId = 'aegis-longsword';
export const ABYSSAL_VERDICT_LEGACY_ABILITY_ID = 'EVISCERATE';
export const ABYSSAL_VERDICT_ULTIMATE_ID = 'THREEFOLD_BRAND';
export const ABYSSAL_VERDICT_DISPLAY_NAME = 'ABYSSAL VERDICT';

/** Canonical ultimate targeting — single primary combatant. */
export const ABYSSAL_VERDICT_TARGET_MODE = 'SINGLE' as const;

export type AbyssalVerdictPhase =
  | 'idle'
  | 'activation'
  | 'charge'
  | 'veil_pull'
  | 'blade_charge'
  | 'edge_flare'
  | 'anticipation'
  | 'release'
  | 'delayed_cut'
  | 'impact'
  | 'recovery'
  | 'done';

export type AbyssalVerdictResolvedResult = {
  presentationId: string;
  /** Primary resolved combatant ID (post-intercept, from finalized hurt). */
  targetId: string;
  /** Successfully affected IDs (hit). Single-target → [targetId] when damage landed. */
  affectedTargetIds: string[];
  /** Evaded / unaffected IDs — no cut, burst, or blood. */
  evadedTargetIds: string[];
  damage: number;
  killed: boolean;
  critical: boolean;
  grade?: string | null;
  replayOnly?: boolean;
  deferredLogLines?: string[];
};

export type AbyssalVerdictPresentationRecipients = {
  primaryTargetId: string;
  /** Cut line + major impact burst. */
  cinematicImpactTargetIds: string[];
  /** Smaller Aegis hit bursts (multi-target only; empty for single-target). */
  secondaryHitTargetIds: string[];
  evadeTargetIds: string[];
};

export type AbyssalVerdictWorldCamera = {
  scale: number;
  translateX: number;
  translateY: number;
};

export type AbyssalVerdictPresentationEvent = {
  presentationId: string;
  /** Monotonic activation token — callbacks must match before mutating UI. */
  activationToken: number;
  phase: AbyssalVerdictPhase;
  result: AbyssalVerdictResolvedResult;
  atMs: number;
  reducedMotion: boolean;
  reducedFlash: boolean;
  screenShakeEnabled: boolean;
  worldCamera: AbyssalVerdictWorldCamera;
  /** Peripheral HUD opacity (ability cards, log, intel, turn, objectives, RESERVE). */
  hudOpacity: number;
  /** Enemy health-bar opacity during cinematic. */
  hpBarOpacity: number;
  /** Opacity for enemies that are not the primary cinematic target. */
  nonTargetEnemyOpacity: number;
};

/**
 * Alpha content bounds of pose PNGs (canvas space) — scale from visible ink, not full canvas.
 * Measured from production RGBA assets. Do not use full PNG canvas for scale decisions.
 */
export const ABYSSAL_VERDICT_POSE_CONTENT = {
  charge: {
    canvasW: 376,
    canvasH: 1024,
    x: 30,
    y: 25,
    w: 326,
    h: 985,
  },
  release: {
    canvasW: 1024,
    canvasH: 749,
    x: 35,
    y: 40,
    w: 980,
    h: 698,
  },
} as const;

/**
 * Prior authored poseScale (pre-cinematic-size pass). Kept for migration notes / tests.
 * Recording showed ~½ idle anatomy at this value → new scale ≈ ×1.83–2.0.
 */
export const ABYSSAL_VERDICT_PRIOR_POSE_SCALE = 1.12;

/**
 * Centralized timing / tuning (authored ms @ combatSpeed 1).
 * Full sequence target: ~2.15–2.25 s (deliberate charge → fast release → delayed impact linger).
 */
export const ABYSSAL_VERDICT_TIMELINE_MS = {
  /** 0–140: lock input, dim UI, darken, hide normal actor. */
  activationEnd: 140,
  chargeStart: 140,
  chargeZoomPeak: 360,
  titleStart: 160,
  /** Title readable ~450–550 ms then clear before release. */
  titleHoldEnd: 680,
  titleFadeEnd: 820,
  titleFontSize: 21,
  titleLetterSpacing: 4.2,
  titleTopPct: 22,
  titleLeftPct: 3,
  /** 260–820: veil energy pulled inward. */
  veilPullStart: 260,
  veilPullEnd: 820,
  /** 480–1050: blade charge guard → tip. */
  bladeChargeStart: 480,
  bladeChargeEnd: 1050,
  /** 700–1140: edge flare travels / holds along the full blade. */
  edgeFlareStart: 700,
  edgeFlareEnd: 1140,
  /** 1140–1310: charged anticipation hold. */
  anticipationStart: 1140,
  anticipationEnd: 1310,
  /** 1310: hard swap to release. */
  releaseStart: 1310,
  /** Hard swap / ≤40 ms transition. */
  poseSwapMs: 32,
  /** Slash afterimage — linger longer on the target. */
  slashStart: 1330,
  slashEnd: 1580,
  slashLifetimeMs: 420,
  /** 1400–1560: near-still release (no cut-line streaks). */
  delayedCutStart: 1400,
  /** Canonical single delayed-impact event. */
  impactAt: 1560,
  hitStopMs: 90,
  impactBurstEnd: 2050,
  /** Impact burst / shards linger briefly into UI restore. */
  impactBurstFadeMs: 520,
  /** Soft contact-FX clear after done (overlap with HUD return). */
  contactFxLingerMs: 220,
  /** 1850–2220: recover camera, framing, UI, normal actor. */
  recoveryStart: 1850,
  doneAt: 2220,

  /**
   * Player-only camera (operative + cinematic poses). Enemies stay screen-fixed.
   * Scale-only on the UI thread (Reanimated). One zoom-in, one zoom-out to identity.
   */
  worldZoom: 1.18,
  worldReleaseZoom: 1,
  worldPunchScale: 1,
  worldChargeTranslateX: 0,
  worldChargeTranslateY: 0,
  worldReleaseTranslateX: 0,
  worldReleaseTranslateY: 0,
  worldPunchTranslateX: 0,
  worldPunchTranslateY: 0,
  worldFocusTranslateX: 0,
  worldFocusTranslateY: 0,
  /** Full zoom-in duration (activation → anticipation peak). */
  worldZoomInMs: 1280,
  /**
   * Single pull-back from peak → identity starting at release
   * (covers release through recovery — no second recover kick).
   */
  worldZoomOutMs: 680,
  /** Unused when zoomOut settles to 1; kept for reduced-motion aliases. */
  worldRecoverMs: 0,

  /**
   * Cinematic pose scale vs prior 1.12 authoring (~1.83×).
   * Target: charge head-to-boot ≈ 105–115% of normal idle Aegis.
   */
  poseScale: 2.05,
  /**
   * Shared upright anatomical content height as fraction of actor plane.
   * Release uses releaseAnatomicalScale so crouched stance matches head/torso, not bbox height.
   */
  poseContentHeightFrac: 0.9,
  /** Boost crouched release so head/torso/sword length match upright charge. */
  releaseAnatomicalScale: 1.2,
  poseBaselineOffsetY: 0,
  chargePoseOffsetX: 0,
  chargePoseOffsetY: 0,
  releasePoseOffsetX: 0,
  releasePoseOffsetY: 0,
  /** No lateral lunge — release may only scale with the player camera. */
  releaseDisplacePx: 0,
  releaseLungeMs: 0,

  /**
   * Actor plane — large enough that 2× poses expand from feet without clipping swords.
   * Cinematic overlap of dimmed HUD is acceptable.
   */
  actorPlaneLeftPct: 0,
  actorPlaneBottomPct: 1,
  actorPlaneWidthPct: 56,
  actorPlaneHeightPct: 94,

  /**
   * Charge VFX — pose-local % of the charge pose host (not free screen space).
   * Edge flare sits on the vertical longsword (right hand, tip-up) at full blade length.
   */
  veilPull: {
    leftPct: 18,
    topPct: 40,
    widthPct: 28,
    heightPct: 18,
    scale: 0.48,
    rotateDeg: -8,
    opacity: 0.85,
  },
  bladeCharge: {
    leftPct: 62,
    topPct: 6,
    widthPct: 16,
    heightPct: 54,
    scale: 0.55,
    rotateDeg: 1,
    opacity: 0.55,
  },
  /** Blade-only glow — tip→mid-blade; clip stops above the cross-guard / hilt. */
  edgeFlare: {
    leftPct: 67,
    topPct: 2,
    widthPct: 14,
    heightPct: 34,
    scale: 1.0,
    rotateDeg: 1,
    opacity: 0.92,
  },
  swordTip: {
    leftPct: 74,
    topPct: 4,
  },
  palm: {
    leftPct: 30,
    topPct: 44,
  },
  /** Disable stray inbound wisps (read as floating pink dashes over enemies). */
  wispCount: 0,
  enemySilhouetteFlashMs: 60,
  /** No portrait recoil — enemy stays planted for the whole cinematic. */
  enemyRecoilPx: 0,

  slashScale: 1.95,
  cutLineScale: 0,
  impactBurstScale: 1.12,
  /**
   * Soft stealth-style edge vignette (dark at rim → clear at center).
   * `darkenOpacity` is a faint center wash; `vignetteOpacity` drives the rim fade.
   */
  darkenOpacity: 0.08,
  framingOpacity: 1,
  vignetteOpacity: 0.88,
  /** Fully clear peripheral UI until idle restore. */
  hudOpacity: 0,
  hpBarOpacity: 0,
  /** Non-primary enemies fully hidden for the cinematic. */
  nonTargetEnemyOpacity: 0,
} as const;

/** Shortened reduced-motion beat sheet — same recipient model, single impact. */
export const ABYSSAL_VERDICT_REDUCED_TIMELINE_MS = {
  ...ABYSSAL_VERDICT_TIMELINE_MS,
  activationEnd: 80,
  chargeStart: 80,
  chargeZoomPeak: 180,
  titleStart: 90,
  titleHoldEnd: 320,
  titleFadeEnd: 400,
  veilPullStart: 120,
  veilPullEnd: 420,
  bladeChargeStart: 220,
  bladeChargeEnd: 520,
  edgeFlareStart: 440,
  edgeFlareEnd: 560,
  anticipationStart: 560,
  anticipationEnd: 640,
  releaseStart: 640,
  poseSwapMs: 28,
  slashStart: 650,
  slashEnd: 780,
  slashLifetimeMs: 220,
  delayedCutStart: 700,
  impactAt: 780,
  impactBurstEnd: 1080,
  impactBurstFadeMs: 280,
  contactFxLingerMs: 120,
  recoveryStart: 960,
  doneAt: 1180,
  hitStopMs: 40,
  worldZoom: 1.06,
  worldReleaseZoom: 1,
  worldPunchScale: 1,
  worldZoomInMs: 580,
  worldZoomOutMs: 360,
  worldRecoverMs: 0,
  releaseDisplacePx: 0,
  releaseLungeMs: 0,
  poseScale: 1.85,
  wispCount: 3,
  framingOpacity: 0.4,
  vignetteOpacity: 0.35,
  slashScale: 1.55,
} as const;

export type AbyssalVerdictTimeline = {
  [K in keyof typeof ABYSSAL_VERDICT_TIMELINE_MS]:
    (typeof ABYSSAL_VERDICT_TIMELINE_MS)[K] extends number
      ? number
      : (typeof ABYSSAL_VERDICT_TIMELINE_MS)[K];
};

type Listener = (event: AbyssalVerdictPresentationEvent) => void;
type ImpactListener = (result: AbyssalVerdictResolvedResult) => void;
type DoneListener = (result: AbyssalVerdictResolvedResult) => void;

const listeners = new Set<Listener>();
const impactListeners = new Set<ImpactListener>();
const doneListeners = new Set<DoneListener>();
const timers = new Set<ReturnType<typeof setTimeout>>();

/** Monotonic activation token. Bumped before any state reset so stale callbacks no-op. */
let activationToken = 0;
let activePresentationId: string | null = null;
let activeTargetId: string | null = null;
let activeResult: AbyssalVerdictResolvedResult | null = null;
let currentPhase: AbyssalVerdictPhase = 'idle';
let inputGuardUntil = 0;
let impactFired = false;
/** Consumed presentation IDs — cannot be restarted by turn transitions. */
const consumedPresentationIds = new Set<string>();

function clearTimers(): void {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
}

function schedule(token: number, ms: number, fn: () => void): void {
  const handle = setTimeout(() => {
    timers.delete(handle);
    if (token !== activationToken) return;
    try {
      fn();
    } catch {
      // Presentation must never throw into combat.
    }
  }, ms);
  timers.add(handle);
}

/** Test/introspection — pending timeline timeouts. */
export function getAbyssalVerdictPendingTimerCount(): number {
  return timers.size;
}

export function getAbyssalVerdictActivationToken(): number {
  return activationToken;
}

export function getAbyssalVerdictCurrentPhase(): AbyssalVerdictPhase {
  return currentPhase;
}

export function isAbyssalVerdictPresentationConsumed(presentationId: string): boolean {
  return consumedPresentationIds.has(presentationId);
}

function normalizeResult(result: AbyssalVerdictResolvedResult): AbyssalVerdictResolvedResult {
  const primary = result.targetId;
  const affected = result.affectedTargetIds?.length
    ? [...result.affectedTargetIds]
    : (result.damage > 0 && primary ? [primary] : []);
  const evaded = result.evadedTargetIds?.length ? [...result.evadedTargetIds] : [];
  return {
    ...result,
    targetId: primary,
    affectedTargetIds: affected,
    evadedTargetIds: evaded,
  };
}

/**
 * Derive who receives cut / major burst / secondary hits from finalized result IDs.
 * Never uses DOM order or display position.
 */
export function resolveAbyssalVerdictPresentationRecipients(
  result: AbyssalVerdictResolvedResult,
): AbyssalVerdictPresentationRecipients {
  const normalized = normalizeResult(result);
  const primary = normalized.targetId;
  const evadeSet = new Set(normalized.evadedTargetIds);
  const hitIds = normalized.affectedTargetIds.filter((id) => id && !evadeSet.has(id));
  const primaryHit = hitIds.includes(primary) ? primary : (hitIds[0] ?? '');
  const cinematicImpactTargetIds = primaryHit ? [primaryHit] : [];
  const secondaryHitTargetIds = hitIds.filter((id) => id !== primaryHit);
  return {
    primaryTargetId: primary,
    cinematicImpactTargetIds,
    secondaryHitTargetIds,
    evadeTargetIds: [...evadeSet],
  };
}

export function abyssalVerdictTargetReceivesCinematicImpact(
  result: AbyssalVerdictResolvedResult,
  unitId: string,
): boolean {
  return resolveAbyssalVerdictPresentationRecipients(result).cinematicImpactTargetIds.includes(unitId);
}

export function abyssalVerdictTargetReceivesHitBurst(
  result: AbyssalVerdictResolvedResult,
  unitId: string,
): boolean {
  const rec = resolveAbyssalVerdictPresentationRecipients(result);
  return (
    rec.cinematicImpactTargetIds.includes(unitId)
    || rec.secondaryHitTargetIds.includes(unitId)
  );
}

/** Primary target receives pass-through streak FX when the result is EVADE/MISS. */
export function abyssalVerdictTargetReceivesEvadePass(
  result: AbyssalVerdictResolvedResult,
  unitId: string,
): boolean {
  const rec = resolveAbyssalVerdictPresentationRecipients(result);
  return rec.evadeTargetIds.includes(unitId) || (
    rec.primaryTargetId === unitId
    && rec.cinematicImpactTargetIds.length === 0
    && result.damage <= 0
  );
}

/** Image layout % of actor plane — feet-anchored, content-bounds normalized. */
export function computeAbyssalVerdictPoseLayouts(timeline: AbyssalVerdictTimeline): {
  charge: { widthPct: number; heightPct: number };
  release: { widthPct: number; heightPct: number };
} {
  // poseScale 2.05 ≈ ×1.83 vs prior 1.12; content height fills the enlarged plane at that authoring point.
  const contentH = timeline.poseContentHeightFrac * 100 * (timeline.poseScale / 2.05);
  const chargeFill = ABYSSAL_VERDICT_POSE_CONTENT.charge.h / ABYSSAL_VERDICT_POSE_CONTENT.charge.canvasH;
  const releaseFill = ABYSSAL_VERDICT_POSE_CONTENT.release.h / ABYSSAL_VERDICT_POSE_CONTENT.release.canvasH;
  const chargeH = contentH / chargeFill;
  const releaseH = (contentH * timeline.releaseAnatomicalScale) / releaseFill;
  const chargeAspect = ABYSSAL_VERDICT_POSE_CONTENT.charge.w / ABYSSAL_VERDICT_POSE_CONTENT.charge.h;
  const releaseAspect = ABYSSAL_VERDICT_POSE_CONTENT.release.w / ABYSSAL_VERDICT_POSE_CONTENT.release.h;
  const planeAspect = timeline.actorPlaneWidthPct / Math.max(1, timeline.actorPlaneHeightPct);
  const chargeW = chargeH * chargeAspect / planeAspect;
  const releaseW = releaseH * releaseAspect / planeAspect;
  return {
    charge: {
      // Allow slight overflow so sword tip is not crushed by clamps.
      widthPct: Math.min(110, Math.max(48, chargeW)),
      heightPct: Math.min(112, Math.max(58, chargeH)),
    },
    release: {
      widthPct: Math.min(168, Math.max(64, releaseW)),
      heightPct: Math.min(108, Math.max(52, releaseH)),
    },
  };
}

export function getAbyssalVerdictWorldCameraForPhase(
  phase: AbyssalVerdictPhase,
  timeline: AbyssalVerdictTimeline,
  reducedMotion: boolean,
): AbyssalVerdictWorldCamera {
  const idle = { scale: 1, translateX: 0, translateY: 0 };
  if (
    phase === 'idle'
    || phase === 'done'
    || phase === 'recovery'
    || phase === 'release'
    || phase === 'delayed_cut'
    || phase === 'impact'
  ) {
    return idle;
  }

  const chargeZoom = reducedMotion ? Math.min(timeline.worldZoom, 1.08) : timeline.worldZoom;
  // Charge ramp — arena animates once to this peak (not stepped per phase).
  return { scale: chargeZoom, translateX: 0, translateY: 0 };
}

/** Camera motion segment — keeps zoom continuous instead of restarting every phase stamp. */
export type AbyssalVerdictCameraSegment = 'idle' | 'zoomIn' | 'zoomOut';

export function getAbyssalVerdictCameraSegment(
  phase: AbyssalVerdictPhase,
): AbyssalVerdictCameraSegment {
  if (phase === 'idle' || phase === 'done') return 'idle';
  // One continuous settle from peak → 1 through release / impact / recovery.
  if (
    phase === 'release'
    || phase === 'delayed_cut'
    || phase === 'impact'
    || phase === 'recovery'
  ) {
    return 'zoomOut';
  }
  return 'zoomIn';
}

export function getAbyssalVerdictHudOpacityForPhase(
  phase: AbyssalVerdictPhase,
  timeline: AbyssalVerdictTimeline,
): number {
  // Keep normal UI fully suppressed until idle/done (player back to idle pose).
  if (phase === 'idle' || phase === 'done') return 1;
  return timeline.hudOpacity;
}

export function getAbyssalVerdictHpBarOpacityForPhase(
  phase: AbyssalVerdictPhase,
  timeline: AbyssalVerdictTimeline,
): number {
  if (phase === 'idle' || phase === 'done') return 1;
  return timeline.hpBarOpacity;
}

export function getAbyssalVerdictNonTargetEnemyOpacityForPhase(
  phase: AbyssalVerdictPhase,
  timeline: AbyssalVerdictTimeline,
): number {
  // Non-targets stay hidden through recovery; only restore with idle.
  if (phase === 'idle' || phase === 'done') return 1;
  return timeline.nonTargetEnemyOpacity;
}

function emit(event: AbyssalVerdictPresentationEvent): void {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch {
      // ignore
    }
  });
}

export function subscribeAbyssalVerdictPresentation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeAbyssalVerdictImpact(listener: ImpactListener): () => void {
  impactListeners.add(listener);
  return () => {
    impactListeners.delete(listener);
  };
}

export function subscribeAbyssalVerdictDone(listener: DoneListener): () => void {
  doneListeners.add(listener);
  return () => {
    doneListeners.delete(listener);
  };
}

export function isAbyssalVerdictPresentationActive(): boolean {
  return activePresentationId != null;
}

export function isAbyssalVerdictInputGuarded(): boolean {
  return Date.now() < inputGuardUntil || activePresentationId != null;
}

export function getAbyssalVerdictActiveTargetId(): string | null {
  return activeTargetId;
}

export function shouldUseAbyssalVerdictPresentation(input: {
  weaponFamilyId?: WeaponFamilyId | null;
  abilityId?: string | null;
  actionKind?: string | null;
  operativeClass?: string | null;
}): boolean {
  if (input.operativeClass != null && input.operativeClass !== 'AEGIS') return false;
  if (input.weaponFamilyId !== ABYSSAL_VERDICT_LONGSWORD_FAMILY) return false;
  if (input.abilityId !== ABYSSAL_VERDICT_LEGACY_ABILITY_ID) return false;
  if (input.actionKind != null && input.actionKind !== 'ULTIMATE' && input.actionKind !== 'EVISCERATE') {
    return false;
  }
  if (!areAbyssalVerdictAssetsAvailable()) return false;
  return true;
}

export function getAbyssalVerdictTimeline(reducedMotion: boolean): AbyssalVerdictTimeline {
  return (reducedMotion
    ? ABYSSAL_VERDICT_REDUCED_TIMELINE_MS
    : ABYSSAL_VERDICT_TIMELINE_MS) as AbyssalVerdictTimeline;
}

function buildEvent(
  phase: AbyssalVerdictPhase,
  atMs: number,
  result: AbyssalVerdictResolvedResult,
  settings: ReturnType<typeof getCombatPresentationSettings>,
  token: number,
): AbyssalVerdictPresentationEvent {
  const timeline = getAbyssalVerdictTimeline(settings.reducedMotion);
  return {
    presentationId: result.presentationId,
    activationToken: token,
    phase,
    result,
    atMs,
    reducedMotion: settings.reducedMotion,
    reducedFlash: settings.reducedFlash,
    screenShakeEnabled: settings.screenShakeEnabled,
    worldCamera: getAbyssalVerdictWorldCameraForPhase(phase, timeline, settings.reducedMotion),
    hudOpacity: getAbyssalVerdictHudOpacityForPhase(phase, timeline),
    hpBarOpacity: getAbyssalVerdictHpBarOpacityForPhase(phase, timeline),
    nonTargetEnemyOpacity: getAbyssalVerdictNonTargetEnemyOpacityForPhase(phase, timeline),
  };
}

/**
 * Invalidate the current instance before resetting state.
 * Stale timeouts / animation callbacks matching the old token become no-ops.
 */
function invalidateActiveInstance(): number {
  activationToken += 1;
  clearTimers();
  activePresentationId = null;
  activeTargetId = null;
  activeResult = null;
  inputGuardUntil = 0;
  currentPhase = 'idle';
  return activationToken;
}

function emitIdle(
  prior: AbyssalVerdictResolvedResult | null,
  settings: ReturnType<typeof getCombatPresentationSettings>,
  token: number,
): void {
  const placeholder: AbyssalVerdictResolvedResult = prior ?? {
    presentationId: 'idle',
    targetId: '',
    affectedTargetIds: [],
    evadedTargetIds: [],
    damage: 0,
    killed: false,
    critical: false,
  };
  currentPhase = 'idle';
  emit(buildEvent('idle', 0, placeholder, settings, token));
}

function completePresentation(
  prior: AbyssalVerdictResolvedResult,
  options: { revealImpactIfNeeded: boolean },
): void {
  const settings = getCombatPresentationSettings();
  const shouldRevealImpact = options.revealImpactIfNeeded && !impactFired;
  consumedPresentationIds.add(prior.presentationId);
  // Invalidate first so no scheduled callback can restore charge/release.
  const token = invalidateActiveInstance();
  impactFired = false;
  if (shouldRevealImpact) {
    impactFired = true;
    impactListeners.forEach((fn) => {
      try {
        fn(prior);
      } catch {
        // ignore
      }
    });
  }
  emitIdle(prior, settings, token);
  doneListeners.forEach((fn) => {
    try {
      fn(prior);
    } catch {
      // ignore
    }
  });
  impactFired = false;
}

export function cancelAbyssalVerdictPresentation(): void {
  const hadActive = activePresentationId != null;
  const prior = activeResult;
  if (!hadActive || !prior) {
    // Idle reset — still invalidate stray timers.
    const settings = getCombatPresentationSettings();
    const token = invalidateActiveInstance();
    impactFired = false;
    emitIdle(null, settings, token);
    return;
  }
  completePresentation(prior, { revealImpactIfNeeded: true });
}

function fireImpact(token: number, result: AbyssalVerdictResolvedResult): void {
  if (token !== activationToken || impactFired) return;
  impactFired = true;
  impactListeners.forEach((fn) => {
    try {
      fn(result);
    } catch {
      // ignore
    }
  });
}

export function beginAbyssalVerdictPresentation(
  result: AbyssalVerdictResolvedResult,
): boolean {
  if (activePresentationId != null) return false;
  if (!areAbyssalVerdictAssetsAvailable() && !result.replayOnly) return false;
  if (consumedPresentationIds.has(result.presentationId)) return false;

  // Drop any stray timers without treating this as a completed cinematic.
  invalidateActiveInstance();
  const token = activationToken;
  const settings = getCombatPresentationSettings();
  const reducedMotion = settings.reducedMotion;
  const timeline = getAbyssalVerdictTimeline(reducedMotion);
  const motionSpeed = Math.min(1, settings.combatSpeed);
  const t = (ms: number) => scalePresentationMs(ms, motionSpeed);
  const normalized = normalizeResult(result);

  activePresentationId = normalized.presentationId;
  activeTargetId = normalized.targetId;
  activeResult = normalized;
  impactFired = false;
  currentPhase = 'activation';
  inputGuardUntil = Date.now() + t(timeline.doneAt) + 80;

  const stamp = (phase: AbyssalVerdictPhase, at: number) => {
    schedule(token, t(at), () => {
      if (token !== activationToken) return;
      if (phase === 'done') {
        // Terminal beat — invalidate before listeners/UI can race.
        completePresentation(activeResult ?? normalized, { revealImpactIfNeeded: false });
        return;
      }
      currentPhase = phase;
      emit(buildEvent(phase, t(at), activeResult ?? normalized, settings, token));
      if (phase === 'impact') {
        fireImpact(token, activeResult ?? normalized);
      }
    });
  };

  emit(buildEvent('activation', 0, normalized, settings, token));
  stamp('charge', timeline.chargeStart);
  stamp('veil_pull', timeline.veilPullStart);
  stamp('blade_charge', timeline.bladeChargeStart);
  stamp('edge_flare', timeline.edgeFlareStart);
  stamp('anticipation', timeline.anticipationStart);
  stamp('release', timeline.releaseStart);
  stamp('delayed_cut', timeline.delayedCutStart);
  stamp('impact', timeline.impactAt);
  stamp('recovery', timeline.recoveryStart);
  stamp('done', timeline.doneAt);

  return true;
}
