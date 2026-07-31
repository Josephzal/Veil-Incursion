/**
 * Warden's Strike (Longsword STRIKE) staged presentation — presentation only.
 * Combat resolves first; this schedules pose / trail / contact / feedback.
 */

import type { WeaponFamilyId } from '../types/weapon';
import { scalePresentationMs } from '../data/weaponCombatPresentation/presentationSettings';
import { getCombatPresentationSettings } from '../data/weaponCombatPresentation/presentationSettings';
import type { WardenApproachGeometrySnapshot } from './wardenStrikeApproach';

export type WardenStrikeDefenseMaterial = 'NONE' | 'KINETIC_ARMOR' | 'OCCULT_WARD';

export type WardenStrikeOutcome = 'HIT' | 'MISS' | 'EVADE';

export type WardenStrikePresentationPhase =
  | 'idle'
  | 'anticipation'
  | 'release'
  | 'contact'
  | 'hold'
  | 'recovery'
  | 'done';

/** Authoritative resolved result driving truthful VFX variants. */
export type WardenStrikeResolvedResult = {
  presentationId: string;
  /** Stable id for this resolved combat result (ties response callouts). */
  resolvedResultId?: string;
  /** Parent player-intent action that owns this presentation. */
  playerActionId?: string;
  sourceActionKind?: string;
  sourceAbilityId?: string;
  resultSource?: string;
  targetId: string;
  damage: number;
  critical: boolean;
  killed: boolean;
  outcome: WardenStrikeOutcome;
  defenseMaterial: WardenStrikeDefenseMaterial;
  /** True only when this hit applied Fracture gauge / FRACTURED payoff flag. */
  fractureApplied: boolean;
  /** Dev replay — no combat callbacks. */
  replayOnly?: boolean;
  /**
   * Presentation-only translation (art-box local px) aligning blade contact
   * with the selected target. Computed once into approachGeometry.
   */
  approachDelta?: { x: number; y: number };
  /** Immutable approach snapshot — every result branch must reuse this. */
  approachGeometry?: WardenApproachGeometrySnapshot;
};

export type WardenStrikePresentationEvent = {
  presentationId: string;
  phase: WardenStrikePresentationPhase;
  result: WardenStrikeResolvedResult;
  /** ms from presentation start (scaled). */
  atMs: number;
  reducedMotion: boolean;
  reducedFlash: boolean;
};

/**
 * Dev-only layer isolation (Step 2B).
 * Flip individual flags while PLAYER_POSE_ALIGN_DEBUG / replay is active.
 * Production combat ignores these unless a layer explicitly gates on them.
 */
export const WARDEN_STRIKE_VFX_LAYER_TOGGLES = {
  /** Authored swing smear / trail — off for longsword Warden's Strike. */
  swingTrail: false,
  contactFx: true,
  enemyHitEffect: true,
  /** Generic CombatEnemyHitEffect spark driven by hitFlashSeq. */
  hitFlashSeqVisuals: true,
  weaponBusEffects: true,
  damageCritNumbers: true,
  fractureStatus: true,
  enemyRecoil: true,
  /**
   * CombatEnemyCritImpact mustard kinetic slash (#fbbf24).
   * Forced off during Warden presentation regardless — this toggle only
   * re-enables it for isolation A/B while debugging.
   */
  critImpactSlashForceShow: false,
  /** Step 2C/2D authored PNG layers (default on). */
  authoredSwingSmear: false,
  authoredContactBurst: true,
  authoredIncision: true,
  authoredFractureCrack: true,
  /**
   * Magenta primed idle aura (`tintColor #ff00ff` on idle silhouette).
   * Forced off during Warden presentation so it cannot leave a stationary
   * purple idle ghost. Flip true only for isolation A/B with REPLAY WS.
   */
  primedIdleAuraForceShow: false,
  /** Dev comparison — procedural SVG under authored art (default off). */
  proceduralSwingComparison: false,
  proceduralContactComparison: false,
  proceduralSparks: false,
  /**
   * High-contrast contact-image bounds + center cross (dev only).
   * Keep false for normal play / recordings.
   */
  contactBoundsDebug: false,
  /**
   * Slow-motion approach debug overlay (blade tip / anchor / translation).
   * Development recordings only.
   */
  approachGeometryDebug: false,
  /**
   * Smear isolation — attack sprite + authored smear only (disable other FX).
   */
  smearIsolationMode: false,
  /**
   * Recoil isolation — hide player attack after contact; only enemy portrait recoils.
   */
  recoilIsolationMode: false,
  /**
   * Fracture isolation — attack sprite + Fracture crack only (REPLAY WS FX).
   */
  fractureIsolationMode: false,
  /**
   * Force smear opacity 1 with no fade for development proof frames.
   */
  smearProofOpaque: false,
};

/** Authored PNG placement / timing calibration (logical CSS px, not native pixels). */
export const WARDEN_STRIKE_ART_CALIBRATION = {
  swingSmear: {
    sourceWidth: 1008,
    sourceHeight: 917,
    /**
     * Crop away detached far-right strokes (~rightmost 22% of source).
     * Normalized visible source width [0, 1].
     */
    sourceCropRight: 0.78,
    /** Extra offset from the sweep AABB center (actor-box px). */
    offsetX: 2,
    offsetY: -4,
    /**
     * Target smear width as a fraction of registered actor-box width
     * (~280–380px at the normal ~304px development actor).
     */
    actorWidthFraction: 0.92,
    /** Soft clamp — visible curved body ~220–300 CSS px at production zoom. */
    minLogicalWidthPx: 240,
    maxLogicalWidthPx: 300,
    /** Added after facing-derived rotation. */
    rotationDeg: -4,
    mirrorX: false,
    /** ~12% under prior peak so the smear supports the blade instead of dominating. */
    peakOpacity: 0.70,
    reducedFlashPeakOpacity: 0.46,
    /** Mild brightness lift so steel reads on pale arena backgrounds. */
    brightness: 1.22,
    contrast: 1.14,
    /** Source art principal axis: upper-left → lower-right. */
    sourceAxisDeg: 45,
    /** Reveal lifetime before residual fade. */
    revealMs: 90,
  },
  contactBurst: {
    sourceWidth: 673,
    sourceHeight: 693,
    logicalWidthPx: 204,
    peakOpacity: 1,
    reducedFlashPeakOpacity: 0.55,
    sourceAxisDeg: 45,
    offsetX: 0,
    offsetY: 0,
    /**
     * Contact impact linger — tune holdMs / fadeMs to keep the burst on-screen longer.
     * Total visible ≈ popInMs + holdMs + fadeMs (~248 ms default).
     */
    popInMs: 18,
    holdMs: 140,
    fadeMs: 90,
    underlaySizePx: 66,
    underlayPeakOpacity: 0.4,
    underlayFadeMs: 72,
  },
  incision: {
    sourceWidth: 923,
    sourceHeight: 977,
    /** Match contact burst footprint — same place / size on tip at contact. */
    logicalLengthPx: 204,
    peakOpacity: 0.98,
    sourceAxisDeg: 45,
    offsetX: 0,
    offsetY: 0,
    /** Bias slash toward vertical (beyond blade facing). */
    rotationDeg: 35,
    /**
     * Incision linger — tune delayMs (start after contact) and lifetimeMs (how long it stays).
     * Clears at delayMs + lifetimeMs (~38 + 320 = 358 ms default).
     */
    delayMs: 38,
    lifetimeMs: 320,
  },
  fractureCrack: {
    sourceWidth: 501,
    sourceHeight: 666,
    logicalWidthPx: 88,
    peakOpacity: 0.95,
    offsetX: -10,
    offsetY: -16,
    delayMs: 90,
    lifetimeMs: 270,
    scaleFrom: 0.9,
    rotationDeg: 18,
  },
} as const;

/**
 * Literal wrapper motion — pause in attack pose at contact, then return home.
 * hitStop (TIMELINE) is a short freeze at the start of this hold; holdMs is the full pose linger.
 */
export const WARDEN_STRIKE_WRAPPER_MOTION_MS = {
  homeHoldMs: 16,
  outMs: 158,
  /** Pause on the enemy in attack pose before sliding back to idle. */
  holdMs: 500,
  returnMs: 225,
} as const;

export function wardenWrapperMotionTotalMs(): number {
  const m = WARDEN_STRIKE_WRAPPER_MOTION_MS;
  return m.homeHoldMs + m.outMs + m.holdMs + m.returnMs;
}

/** Contact-VFX may outlive movement; clear only after this tail from contact. */
export function wardenContactVfxTailMs(): number {
  const inc = WARDEN_STRIKE_ART_CALIBRATION.incision;
  const fx = WARDEN_STRIKE_ART_CALIBRATION.fractureCrack;
  const burst = WARDEN_STRIKE_ART_CALIBRATION.contactBurst;
  const burstLife = burst.popInMs + burst.holdMs + burst.fadeMs;
  const incisionEnd = (inc.delayMs ?? 0) + inc.lifetimeMs;
  const fractureEnd = fx.delayMs + fx.lifetimeMs;
  return Math.max(burstLife, incisionEnd, fractureEnd) + 32;
}

/**
 * Phase stamps aligned to the wrapper sequence.
 * Contact-VFX lifetimes are independent and may extend past doneAt.
 */
export const WARDEN_STRIKE_TIMELINE_MS = {
  anticipationEnd: 16,
  approachStart: 16,
  approachEnd: 174,
  releaseStart: 0,
  smearStart: 70,
  contactAt: 174,
  /** contactAt + holdMs (500) */
  holdEnd: 674,
  returnStart: 674,
  /** holdEnd + returnMs (225) */
  returnEnd: 899,
  recoveryStart: 899,
  /** returnEnd + homeSettle (~16) */
  doneAt: 916,
  trailLifetime: 190,
  trailFadeAfterContactMs: 80,
  contactFxLifetime: 400,
  contactFlashMs: 32,
  incisionLifetimeMs: 320,
  sparkLifetimeMs: 100,
  /** Short freeze at contact start; recoil begins on release. Hold continues to holdEnd. */
  hitStop: 70,
  enemyRecoilPx: 24,
  enemyRecoilOutMs: 50,
  enemyRecoilReturnMs: 105,
  enemyRecoilDeg: 0.75,
  reducedMotionRecoilPx: 6,
  enemyHitBrightMs: 30,
  anticipationOffsetPx: 0,
  anticipationRotateDeg: 0,
  /** Restrained 2–3 px impulse; skipped when reducedMotion. */
  cameraImpulsePx: 2.5,
} as const;

export const WARDEN_STRIKE_COLORS = {
  /** Leading edge — pale steel, capped opacity in the trail renderer. */
  steelLead: 'rgba(236, 240, 242, 0.74)',
  /** Distressed ribbon body. */
  steelBody: 'rgba(210, 218, 222, 0.32)',
  mintEdge: 'rgba(140, 185, 175, 0.26)',
  spark: 'rgba(228, 232, 236, 0.88)',
  incision: 'rgba(220, 226, 230, 0.78)',
  fractureMint: 'rgba(110, 185, 168, 0.55)',
  contactFlash: 'rgba(245, 248, 250, 0.62)',
} as const;

export const WARDEN_STRIKE_SIZES = {
  trailLeadWidthPx: 1.5,
  trailBodyWidthPx: 10,
  trailMintWidthPx: 1.5,
  contactFlashPx: 15,
  sparkTravelPx: 18,
  sparkCount: 2,
  incisionLengthPx: 36,
  incisionWidthPx: 1.75,
  fractureCrackLengthPx: 24,
} as const;

export type Point2 = { x: number; y: number };

export type BladeSampleLike = {
  hilt: Point2;
  tip: Point2;
};

export type SwingSmearPlacement = {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  rotationDeg: number;
  sampleBounds: { minX: number; minY: number; maxX: number; maxY: number };
  bladeAngleDeg: number;
  /** Image draw width before right-crop clip (may exceed `width`). */
  imageWidth: number;
};

/** Blade facing angle in degrees (y-down screen space). */
export function bladeFacingAngleDeg(facingX: number, facingY: number): number {
  return (Math.atan2(facingY, facingX) * 180) / Math.PI;
}

/**
 * Place the authored swing smear from swept-blade samples without fitting the
 * full source (incl. detached right fragments) to the entire AABB.
 * Size tracks the registered actor box; crop excludes far-right strokes.
 */
export function computeSwingSmearPlacement(
  samples: readonly BladeSampleLike[],
  facingX: number,
  facingY: number,
  calibration: typeof WARDEN_STRIKE_ART_CALIBRATION.swingSmear = WARDEN_STRIKE_ART_CALIBRATION.swingSmear,
  actorBoxWidthPx?: number,
): SwingSmearPlacement | null {
  if (samples.length < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let tipMaxX = -Infinity;
  for (const s of samples) {
    tipMaxX = Math.max(tipMaxX, s.tip.x);
    for (const p of [s.hilt, s.tip]) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  const pad = 6;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const crop = Math.max(0.5, Math.min(1, calibration.sourceCropRight));
  const fullAspect = calibration.sourceWidth / calibration.sourceHeight;
  const croppedAspect = fullAspect * crop;
  const actorW = actorBoxWidthPx ?? Math.max(24, maxX - minX);
  let width = actorW * calibration.actorWidthFraction;
  width = Math.max(calibration.minLogicalWidthPx, Math.min(calibration.maxLogicalWidthPx, width));
  // Display height from cropped aspect (visible arc only).
  let height = width / croppedAspect;
  const imageWidth = width / crop;
  // Anchor along the sweep: center of hilt→mid-sweep, clamped so the smear
  // does not extend past the attack tip / blade contact region.
  const centerX = (minX + tipMaxX) / 2 + calibration.offsetX;
  const centerY = (minY + maxY) / 2 + calibration.offsetY;
  let left = centerX - width / 2;
  const rightLimit = tipMaxX + 4;
  if (left + width > rightLimit) {
    left = rightLimit - width;
  }
  const bladeAngleDeg = bladeFacingAngleDeg(facingX, facingY);
  const rotationDeg = bladeAngleDeg - calibration.sourceAxisDeg + calibration.rotationDeg;
  return {
    left,
    top: centerY - height / 2,
    width,
    height,
    centerX: left + width / 2,
    centerY,
    rotationDeg,
    sampleBounds: { minX, minY, maxX, maxY },
    bladeAngleDeg,
    imageWidth,
  };
}

/** Rotation to align an authored slash (sourceAxisDeg) with the blade facing. */
export function authoredSlashRotationDeg(
  facingX: number,
  facingY: number,
  sourceAxisDeg: number,
  extraDeg = 0,
): number {
  return bladeFacingAngleDeg(facingX, facingY) - sourceAxisDeg + extraDeg;
}

const LONGSWORD: WeaponFamilyId = 'aegis-runed-longsword';

let generation = 0;
let activePresentationId: string | null = null;
let activeTargetId: string | null = null;
let activePlayerActionId: string | null = null;
let activeResolvedResultId: string | null = null;
let activeMutableResult: WardenStrikeResolvedResult | null = null;
let activeApproachGeometry: WardenApproachGeometrySnapshot | null = null;
let inputGuardUntil = 0;
let presentationInstancesForAction = 0;
let presentationStartAtMs = 0;
let lastCountedPlayerActionId: string | null = null;
const timers = new Set<ReturnType<typeof setTimeout>>();
const listeners = new Set<(event: WardenStrikePresentationEvent) => void>();
const contactListeners = new Set<(result: WardenStrikeResolvedResult) => void>();
const ownershipListeners = new Set<(report: WardenPresentationOwnershipReport) => void>();

export type WardenPresentationOwnershipReport = {
  presentationInstanceId: string;
  playerActionId: string;
  sourceActionKind: string;
  sourceAbilityId: string;
  resultSource: string;
  targetId: string;
  resolvedResultId: string;
  startingPlayerTransform: { x: number; y: number; width: number; height: number } | null;
  calculatedApproachTranslation: { x: number; y: number } | null;
  registeredHilt: { x: number; y: number } | null;
  registeredTip: { x: number; y: number } | null;
  bladeContact: { x: number; y: number } | null;
  targetContact: { x: number; y: number } | null;
  presentationStartAtMs: number;
  presentationCompleteAtMs: number | null;
  instancesForPlayerAction: number;
};

function isDevPresentationReportingEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function emitOwnershipReport(report: WardenPresentationOwnershipReport): void {
  if (!isDevPresentationReportingEnabled()) return;
  // eslint-disable-next-line no-console
  console.info('[WARDEN OWNERSHIP]', report);
  ownershipListeners.forEach((fn) => {
    try {
      fn(report);
    } catch {
      // ignore
    }
  });
}

export function subscribeWardenOwnershipReports(
  listener: (report: WardenPresentationOwnershipReport) => void,
): () => void {
  ownershipListeners.add(listener);
  return () => {
    ownershipListeners.delete(listener);
  };
}

export function isWardenStrikePresentationWeapon(
  weaponFamilyId: WeaponFamilyId | null | undefined,
): boolean {
  return weaponFamilyId === LONGSWORD;
}

export function isWardenStrikePresentationActive(): boolean {
  return activePresentationId != null;
}

export function getWardenStrikeActiveTargetId(): string | null {
  return activeTargetId;
}

export function getWardenStrikeActivePresentationId(): string | null {
  return activePresentationId;
}

export function getWardenStrikeActivePlayerActionId(): string | null {
  return activePlayerActionId;
}

export function getWardenStrikeActiveResolvedResultId(): string | null {
  return activeResolvedResultId;
}

export function getWardenStrikeActiveApproachGeometry(): WardenApproachGeometrySnapshot | null {
  return activeApproachGeometry;
}

export function getWardenPresentationInstanceCountForAction(): number {
  return presentationInstancesForAction;
}

export function isWardenStrikeInputGuarded(): boolean {
  return Date.now() < inputGuardUntil || activePresentationId != null;
}

/**
 * Secondary damage (Riposte cash-out riders, Runed Longsword effects, etc.)
 * publishes into the owning contact — never starts another approach.
 */
export function contributeWardenStrikeContactDamage(input: {
  playerActionId?: string | null;
  damage: number;
  critical?: boolean;
  killed?: boolean;
  fractureApplied?: boolean;
  defenseMaterial?: WardenStrikeDefenseMaterial;
}): boolean {
  if (!activeMutableResult || !activePresentationId) return false;
  if (
    input.playerActionId
    && activePlayerActionId
    && input.playerActionId !== activePlayerActionId
  ) {
    return false;
  }
  activeMutableResult.damage += Math.max(0, input.damage);
  if (input.critical && input.damage > 0) activeMutableResult.critical = true;
  if (input.killed) activeMutableResult.killed = true;
  if (input.fractureApplied) activeMutableResult.fractureApplied = true;
  if (input.defenseMaterial && input.defenseMaterial !== 'NONE') {
    activeMutableResult.defenseMaterial = input.defenseMaterial;
  }
  return true;
}

/**
 * Lock approach geometry once for the owning presentation.
 * Subsequent result branches must reuse this snapshot — never accumulate.
 */
export function lockWardenApproachGeometry(
  snapshot: WardenApproachGeometrySnapshot,
): WardenApproachGeometrySnapshot {
  if (activeApproachGeometry) return activeApproachGeometry;
  activeApproachGeometry = snapshot;
  if (activeMutableResult) {
    activeMutableResult.approachGeometry = snapshot;
    activeMutableResult.approachDelta = snapshot.translationLocal;
  }
  return snapshot;
}

/**
 * Mustard/yellow horizontal streak source: CombatEnemyCritImpact (KINETIC #fbbf24).
 * Suppressed for Warden's Strike so steel contact remains readable.
 * Other attacks keep the crit slash unchanged.
 */
export function shouldSuppressWardenCritImpactSlash(): boolean {
  if (!isWardenStrikePresentationActive()) return false;
  if (WARDEN_STRIKE_VFX_LAYER_TOGGLES.critImpactSlashForceShow) return false;
  return true;
}

/**
 * Magenta primed idle aura — suppressed during Warden so the idle silhouette
 * cannot read as a second stationary player behind the approach.
 */
export function shouldSuppressWardenPrimedIdleAura(): boolean {
  if (!isWardenStrikePresentationActive()) return false;
  if (WARDEN_STRIKE_VFX_LAYER_TOGGLES.primedIdleAuraForceShow) return false;
  return true;
}

export function subscribeWardenStrikePresentation(
  listener: (event: WardenStrikePresentationEvent) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fires once at contact — hub uses this for deferred hitFlash / HP reveal. */
export function subscribeWardenStrikeContact(
  listener: (result: WardenStrikeResolvedResult) => void,
): () => void {
  contactListeners.add(listener);
  return () => {
    contactListeners.delete(listener);
  };
}

function clearTimers(): void {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
}

function schedule(ms: number, fn: () => void): void {
  const handle = setTimeout(() => {
    timers.delete(handle);
    try {
      fn();
    } catch {
      // Presentation must never throw into combat.
    }
  }, ms);
  timers.add(handle);
}

function emit(event: WardenStrikePresentationEvent): void {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch {
      // ignore listener errors
    }
  });
}

export function cancelWardenStrikePresentation(): void {
  const hadActive = activePresentationId != null;
  const priorId = activePresentationId ?? 'cancelled';
  const priorAction = activePlayerActionId ?? '';
  const priorResult = activeMutableResult;
  const priorGeo = activeApproachGeometry;
  const startAt = presentationStartAtMs;
  generation += 1;
  activePresentationId = null;
  activeTargetId = null;
  activePlayerActionId = null;
  activeResolvedResultId = null;
  activeMutableResult = null;
  activeApproachGeometry = null;
  inputGuardUntil = 0;
  clearTimers();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const calloutMod = require('./wardenCalloutOwnership') as {
      clearWardenCalloutReports: () => void;
    };
    calloutMod.clearWardenCalloutReports();
  } catch {
    // optional in test environments without the module graph
  }
  if (hadActive) {
    emitOwnershipReport({
      presentationInstanceId: priorId,
      playerActionId: priorAction,
      sourceActionKind: priorResult?.sourceActionKind ?? '',
      sourceAbilityId: priorResult?.sourceAbilityId ?? '',
      resultSource: priorResult?.resultSource ?? 'cancel',
      targetId: priorResult?.targetId ?? '',
      resolvedResultId: priorResult?.resolvedResultId ?? '',
      startingPlayerTransform: priorGeo?.playerStartWindow ?? null,
      calculatedApproachTranslation: priorGeo?.translationLocal ?? null,
      registeredHilt: priorGeo?.hiltLocal ?? null,
      registeredTip: priorGeo?.tipLocal ?? null,
      bladeContact: priorGeo?.bladeContactLocal ?? null,
      targetContact: priorGeo?.targetContactWindow ?? null,
      presentationStartAtMs: startAt,
      presentationCompleteAtMs: Date.now(),
      instancesForPlayerAction: presentationInstancesForAction,
    });
    emit({
      presentationId: priorId,
      phase: 'done',
      atMs: 0,
      result: {
        presentationId: priorId,
        resolvedResultId: priorResult?.resolvedResultId ?? priorId,
        playerActionId: priorAction,
        sourceActionKind: priorResult?.sourceActionKind ?? 'CANCEL',
        sourceAbilityId: priorResult?.sourceAbilityId ?? '',
        resultSource: 'cancel',
        targetId: '',
        damage: 0,
        critical: false,
        killed: false,
        outcome: 'MISS',
        defenseMaterial: 'NONE',
        fractureApplied: false,
        replayOnly: true,
      },
      reducedMotion: getCombatPresentationSettings().reducedMotion,
      reducedFlash: getCombatPresentationSettings().reducedFlash,
    });
  }
}

/**
 * Begin staged Warden's Strike presentation from an already-resolved result.
 * Returns false if a presentation is already guarding input (duplicate suppressed).
 */
export function beginWardenStrikePresentation(
  result: WardenStrikeResolvedResult,
): boolean {
  if (!result.replayOnly && isWardenStrikeInputGuarded()) {
    if (isDevPresentationReportingEnabled()) {
      // eslint-disable-next-line no-console
      console.info('[WARDEN OWNERSHIP] suppressed duplicate begin', {
        playerActionId: result.playerActionId,
        activePresentationId,
        presentationInstancesForAction,
      });
    }
    return false;
  }
  cancelWardenStrikePresentation();
  const gen = generation;
  const settings = getCombatPresentationSettings();
  // Never accelerate Warden below authored feel — measured attack→idle must stay ~470–520 ms.
  const motionSpeed = Math.min(1, settings.combatSpeed);
  const t = (ms: number) => scalePresentationMs(ms, motionSpeed);
  const timeline = {
    anticipationEnd: t(WARDEN_STRIKE_TIMELINE_MS.anticipationEnd),
    releaseStart: t(WARDEN_STRIKE_TIMELINE_MS.releaseStart),
    smearStart: t(WARDEN_STRIKE_TIMELINE_MS.smearStart),
    contactAt: t(WARDEN_STRIKE_TIMELINE_MS.contactAt),
    holdEnd: t(WARDEN_STRIKE_TIMELINE_MS.holdEnd),
    recoveryStart: t(WARDEN_STRIKE_TIMELINE_MS.recoveryStart),
    doneAt: t(WARDEN_STRIKE_TIMELINE_MS.doneAt),
  };

  const resolvedResultId = result.resolvedResultId || `rr-${result.presentationId}`;
  const playerActionId = result.playerActionId || `pa-${result.presentationId}`;
  if (lastCountedPlayerActionId === playerActionId) {
    presentationInstancesForAction += 1;
  } else {
    lastCountedPlayerActionId = playerActionId;
    presentationInstancesForAction = 1;
  }

  const approachGeometry = result.approachGeometry ?? null;
  const approachDelta = result.approachDelta
    ?? approachGeometry?.translationLocal
    ?? undefined;
  const sourceActionKind = result.sourceActionKind || 'STRIKE';
  const sourceAbilityId = result.sourceAbilityId || 'STRIKE';
  const resultSource = result.resultSource || 'player-action';
  const owned: WardenStrikeResolvedResult = {
    ...result,
    presentationId: result.presentationId,
    resolvedResultId,
    playerActionId,
    sourceActionKind,
    sourceAbilityId,
    resultSource,
    approachGeometry: approachGeometry ?? undefined,
    approachDelta,
  };

  activePresentationId = owned.presentationId;
  activeTargetId = owned.replayOnly ? null : owned.targetId;
  activePlayerActionId = playerActionId;
  activeResolvedResultId = resolvedResultId;
  activeMutableResult = owned;
  activeApproachGeometry = approachGeometry;
  presentationStartAtMs = Date.now();
  inputGuardUntil = Date.now() + timeline.doneAt + 50;

  emitOwnershipReport({
    presentationInstanceId: owned.presentationId,
    playerActionId,
    sourceActionKind,
    sourceAbilityId,
    resultSource,
    targetId: owned.targetId,
    resolvedResultId,
    startingPlayerTransform: approachGeometry?.playerStartWindow ?? null,
    calculatedApproachTranslation: approachGeometry?.translationLocal
      ?? approachDelta
      ?? null,
    registeredHilt: approachGeometry?.hiltLocal ?? null,
    registeredTip: approachGeometry?.tipLocal ?? null,
    bladeContact: approachGeometry?.bladeContactLocal ?? null,
    targetContact: approachGeometry?.targetContactWindow ?? null,
    presentationStartAtMs,
    presentationCompleteAtMs: null,
    instancesForPlayerAction: presentationInstancesForAction,
  });

  const base = {
    presentationId: owned.presentationId,
    result: owned,
    reducedMotion: settings.reducedMotion,
    reducedFlash: settings.reducedFlash,
  };

  emit({ ...base, phase: 'anticipation', atMs: 0 });

  schedule(timeline.releaseStart, () => {
    if (gen !== generation) return;
    emit({ ...base, phase: 'release', atMs: timeline.releaseStart });
  });

  schedule(timeline.contactAt, () => {
    if (gen !== generation) return;
    const contactResult = activeMutableResult ?? owned;
    emit({ ...base, result: contactResult, phase: 'contact', atMs: timeline.contactAt });
    contactListeners.forEach((fn) => {
      try {
        fn(contactResult);
      } catch {
        // ignore
      }
    });
  });

  schedule(timeline.holdEnd, () => {
    if (gen !== generation) return;
    emit({ ...base, result: activeMutableResult ?? owned, phase: 'hold', atMs: timeline.holdEnd });
  });

  schedule(timeline.recoveryStart, () => {
    if (gen !== generation) return;
    emit({
      ...base,
      result: activeMutableResult ?? owned,
      phase: 'recovery',
      atMs: timeline.recoveryStart,
    });
  });

  schedule(timeline.doneAt, () => {
    if (gen !== generation) return;
    const finalResult = activeMutableResult ?? owned;
    emit({ ...base, result: finalResult, phase: 'done', atMs: timeline.doneAt });
    emitOwnershipReport({
      presentationInstanceId: owned.presentationId,
      playerActionId,
      sourceActionKind: finalResult.sourceActionKind ?? sourceActionKind,
      sourceAbilityId: finalResult.sourceAbilityId ?? sourceAbilityId,
      resultSource: finalResult.resultSource ?? resultSource,
      targetId: finalResult.targetId,
      resolvedResultId,
      startingPlayerTransform: approachGeometry?.playerStartWindow ?? null,
      calculatedApproachTranslation: approachGeometry?.translationLocal
        ?? approachDelta
        ?? null,
      registeredHilt: approachGeometry?.hiltLocal ?? null,
      registeredTip: approachGeometry?.tipLocal ?? null,
      bladeContact: approachGeometry?.bladeContactLocal ?? null,
      targetContact: approachGeometry?.targetContactWindow ?? null,
      presentationStartAtMs,
      presentationCompleteAtMs: Date.now(),
      instancesForPlayerAction: presentationInstancesForAction,
    });
    if (activePresentationId === owned.presentationId) {
      activePresentationId = null;
      activeTargetId = null;
      activePlayerActionId = null;
      activeResolvedResultId = null;
      activeMutableResult = null;
      activeApproachGeometry = null;
    }
  });

  return true;
}

/** Development replay — presentation only, no combat mutation. */
export function replayWardenStrikePresentation(
  partial?: Partial<WardenStrikeResolvedResult>,
): boolean {
  const presentationId = `warden-replay-${Date.now()}`;
  const playerActionId = partial?.playerActionId ?? `pa-${presentationId}`;
  return beginWardenStrikePresentation({
    targetId: partial?.targetId ?? 'replay-target',
    damage: partial?.damage ?? 12,
    critical: partial?.critical ?? false,
    killed: partial?.killed ?? false,
    outcome: partial?.outcome ?? 'HIT',
    defenseMaterial: partial?.defenseMaterial ?? 'NONE',
    fractureApplied: partial?.fractureApplied ?? false,
    sourceActionKind: partial?.sourceActionKind ?? 'STRIKE',
    sourceAbilityId: partial?.sourceAbilityId ?? 'STRIKE',
    resultSource: partial?.resultSource ?? 'replay',
    resolvedResultId: partial?.resolvedResultId ?? `rr-${presentationId}`,
    playerActionId,
    ...partial,
    presentationId,
    replayOnly: true,
  });
}

/** Immutable no-damage replay fixtures for acceptance isolation. */
export const WARDEN_STRIKE_REPLAY_FIXTURES = {
  cleanHit: {
    outcome: 'HIT' as const,
    damage: 16,
    critical: false,
    fractureApplied: false,
    defenseMaterial: 'NONE' as const,
  },
  criticalHit: {
    outcome: 'HIT' as const,
    damage: 24,
    critical: true,
    fractureApplied: false,
    defenseMaterial: 'NONE' as const,
  },
  fractureHit: {
    outcome: 'HIT' as const,
    damage: 16,
    critical: false,
    fractureApplied: true,
    defenseMaterial: 'NONE' as const,
  },
  armorBreakWithDamage: {
    outcome: 'HIT' as const,
    damage: 16,
    critical: false,
    fractureApplied: false,
    defenseMaterial: 'KINETIC_ARMOR' as const,
  },
  wardResponse: {
    outcome: 'HIT' as const,
    damage: 0,
    critical: false,
    fractureApplied: false,
    defenseMaterial: 'OCCULT_WARD' as const,
  },
  armorBreakNoDamage: {
    outcome: 'HIT' as const,
    damage: 0,
    critical: false,
    fractureApplied: false,
    defenseMaterial: 'KINETIC_ARMOR' as const,
  },
  wardResponseWithDamage: {
    outcome: 'HIT' as const,
    damage: 12,
    critical: false,
    fractureApplied: false,
    defenseMaterial: 'OCCULT_WARD' as const,
  },
  miss: {
    outcome: 'MISS' as const,
    damage: 0,
    critical: false,
    fractureApplied: false,
    defenseMaterial: 'NONE' as const,
  },
  nearTarget: {
    outcome: 'HIT' as const,
    damage: 16,
    critical: false,
    fractureApplied: false,
    defenseMaterial: 'NONE' as const,
    targetId: 'replay-near',
    approachDelta: { x: 72, y: -4 },
  },
  farTarget: {
    outcome: 'HIT' as const,
    damage: 16,
    critical: false,
    fractureApplied: false,
    defenseMaterial: 'NONE' as const,
    targetId: 'replay-far',
    approachDelta: { x: 210, y: -10 },
  },
  riposteCashOut: {
    outcome: 'HIT' as const,
    damage: 28,
    critical: false,
    fractureApplied: false,
    defenseMaterial: 'NONE' as const,
    sourceActionKind: 'STRIKE',
    resultSource: 'warden-with-riposte',
  },
  smearIsolation: {
    outcome: 'HIT' as const,
    damage: 16,
    critical: false,
    fractureApplied: false,
    defenseMaterial: 'NONE' as const,
    resultSource: 'smear-isolation',
  },
  recoilIsolation: {
    outcome: 'HIT' as const,
    damage: 16,
    critical: false,
    fractureApplied: false,
    defenseMaterial: 'NONE' as const,
    resultSource: 'recoil-isolation',
  },
} as const;

export type WardenStrikeReplayFixtureId = keyof typeof WARDEN_STRIKE_REPLAY_FIXTURES;

function resetWardenIsolationToggles(): void {
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.smearIsolationMode = false;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.smearProofOpaque = false;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.recoilIsolationMode = false;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.fractureIsolationMode = false;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredSwingSmear = true;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredContactBurst = true;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredIncision = true;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredFractureCrack = true;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.contactFx = true;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.enemyHitEffect = true;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.hitFlashSeqVisuals = true;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.damageCritNumbers = true;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.fractureStatus = true;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.enemyRecoil = true;
  WARDEN_STRIKE_VFX_LAYER_TOGGLES.primedIdleAuraForceShow = false;
}

export function replayWardenStrikeFixture(id: WardenStrikeReplayFixtureId): boolean {
  const isolating = WARDEN_STRIKE_VFX_LAYER_TOGGLES.smearIsolationMode
    || WARDEN_STRIKE_VFX_LAYER_TOGGLES.smearProofOpaque
    || WARDEN_STRIKE_VFX_LAYER_TOGGLES.recoilIsolationMode
    || WARDEN_STRIKE_VFX_LAYER_TOGGLES.fractureIsolationMode;
  if (isolating) {
    resetWardenIsolationToggles();
  }

  if (id === 'smearIsolation') {
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.smearIsolationMode = true;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.smearProofOpaque = true;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredSwingSmear = true;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredContactBurst = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredIncision = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredFractureCrack = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.contactFx = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.enemyHitEffect = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.hitFlashSeqVisuals = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.damageCritNumbers = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.fractureStatus = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.enemyRecoil = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.primedIdleAuraForceShow = false;
  } else if (id === 'fractureHit') {
    // REPLAY WS FX — attack sprite + Fracture crack only.
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.fractureIsolationMode = true;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredContactBurst = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredIncision = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredFractureCrack = true;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.contactFx = true;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.damageCritNumbers = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.enemyHitEffect = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.hitFlashSeqVisuals = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.enemyRecoil = false;
  } else if (id === 'recoilIsolation') {
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.recoilIsolationMode = true;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredContactBurst = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredIncision = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredFractureCrack = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.contactFx = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.damageCritNumbers = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.enemyHitEffect = false;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.hitFlashSeqVisuals = true;
    WARDEN_STRIKE_VFX_LAYER_TOGGLES.enemyRecoil = true;
  }

  return replayWardenStrikePresentation({
    ...WARDEN_STRIKE_REPLAY_FIXTURES[id],
    resultSource: `fixture:${id}`,
  });
}

/**
 * Route presentation ownership from the player-intent action.
 * Nested hurtEnemy / standalone Riposte must not start Warden.
 */
export function shouldUseWardenStrikePresentation(input: {
  weaponFamilyId?: WeaponFamilyId | null;
  abilityId?: string | null;
  actionKind?: string | null;
  /** Card the player clicked — owns presentation routing. */
  playerActionKind?: string | null;
  /** Nested secondary damage inside an already-owned action. */
  nestedPresentation?: boolean;
}): boolean {
  if (!isWardenStrikePresentationWeapon(input.weaponFamilyId)) return false;
  if (input.actionKind === 'ULTIMATE' || input.playerActionKind === 'ULTIMATE') return false;
  if (input.nestedPresentation) return false;
  // Standalone Riposte (player intent is Riposte, not Strike) never owns Warden.
  if (input.playerActionKind === 'RIPOSTE') return false;
  if (input.actionKind === 'RIPOSTE' && input.playerActionKind != null && input.playerActionKind !== 'STRIKE') {
    return false;
  }
  const id = input.abilityId ?? '';
  // Player-intent Strike owns Warden even when Riposte cash-out tags actionKind RIPOSTE.
  if (input.playerActionKind === 'STRIKE' || input.playerActionKind == null) {
    return id === 'STRIKE' || id === 'WARDENS_STRIKE' || id === 'WARDENS_CUT';
  }
  return false;
}
