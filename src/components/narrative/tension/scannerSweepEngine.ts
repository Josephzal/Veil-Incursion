/**
 * Scanner Sweep — 1D "keep the signal inside the moving blind zone" engine
 * for Mechanic_ConcealSlider.
 *
 * The player cursor and a moving BLIND ZONE (mask window) both live on a
 * normalized 0..1 lane. Staying inside the blind zone builds Signal Mask;
 * being outside raises Detection. Hostile sweep pulses periodically narrow,
 * accelerate, or shift the blind zone. Deterministic when seeded. No run-state
 * mutation.
 */

import { hashSeed } from '../../../data/narrative/narrativeAssemblyCore';

export type ScannerSweepDifficulty = 'LOW' | 'MEDIUM' | 'HIGH' | 'APEX';

export type SweepPulseEffect = 'NARROW' | 'ACCELERATE' | 'SHIFT' | 'REVERSE';

export interface ScannerSweepConfig {
  difficulty: ScannerSweepDifficulty;
  /** Base blind zone half-width as a fraction of the lane (0..1). */
  blindHalfWidth: number;
  /** Blind zone drift speed (lane fraction / sec). */
  zoneSpeed: number;
  /** Signal Mask gain /sec while cursor is inside the blind zone. */
  maskGainPerSec: number;
  /** Detection gain /sec while cursor is outside the blind zone. */
  detectionGainPerSec: number;
  /** Detection decay /sec while cursor is inside the blind zone. */
  detectionDecayPerSec: number;
  /** Mask gain multiplier while dampened (< 1). */
  dampMaskMultiplier: number;
  /** Detection gain multiplier while dampened (< 1). */
  dampDetectionMultiplier: number;
  /** Cursor follow-speed multiplier while dampened (< 1, steadier). */
  dampMoveMultiplier: number;
  /** Seconds between sweep pulse events. */
  pulseIntervalSec: number;
  /** Warning lead time before a pulse becomes active. */
  pulseWarningSec: number;
  /** Active pulse duration (also the beam's travel time across the lane). */
  pulseDurationSec: number;
  /** Effects this difficulty may roll for a pulse. */
  pulseEffects: readonly SweepPulseEffect[];
  /** Half-width of the traveling detection beam (lane fraction). */
  beamHalfWidth: number;
  /** Extra detection /sec when the beam catches an exposed cursor. */
  beamDetectionBurstPerSec: number;
}

export interface ScannerZoneState {
  /** Blind zone center on the lane (0..1). */
  center: number;
  /** Current half-width (may shrink during NARROW pulses). */
  halfWidth: number;
  /** Drift direction (+1 / -1). */
  dir: 1 | -1;
  /** Retarget bookkeeping. */
  retargetAtSec: number;
  targetCenter: number;
}

export type SweepPulsePhase = 'IDLE' | 'WARNING' | 'ACTIVE';

export interface SweepPulseState {
  phase: SweepPulsePhase;
  effect: SweepPulseEffect;
  /** When the next phase transition happens (in elapsedSec). */
  phaseUntilSec: number;
  /** Event counter for deterministic rolls. */
  eventIndex: number;
  /** Lane edge the active beam travels from (0 = left, 1 = right). */
  beamFrom: 0 | 1;
}

export interface ScannerSweepTickInput {
  mask: number;
  detection: number;
  cursor: number;
  zone: ScannerZoneState;
  pulse: SweepPulseState;
  elapsedSec: number;
  dtSec: number;
  dampened: boolean;
  config: ScannerSweepConfig;
  seed: string;
}

export interface ScannerSweepTickResult {
  mask: number;
  detection: number;
  zone: ScannerZoneState;
  pulse: SweepPulseState;
  inside: boolean;
  /** True during WARNING or ACTIVE pulse phases (for UI). */
  pulseActive: boolean;
  pulseWarning: boolean;
  /** Beam position on the lane (0..1) while active, else null. */
  beamPos: number | null;
  /** True when the traveling beam is currently catching an exposed cursor. */
  caughtInBeam: boolean;
  failed: boolean;
  succeeded: boolean;
}

interface DifficultyPreset {
  blindHalfWidth: number;
  zoneSpeed: number;
  maskGainPerSec: number;
  detectionGainPerSec: number;
  detectionDecayPerSec: number;
  pulseIntervalSec: number;
  pulseDurationSec: number;
  pulseEffects: readonly SweepPulseEffect[];
  beamHalfWidth: number;
  beamDetectionBurstPerSec: number;
}

const SHARED = {
  dampMaskMultiplier: 0.6,
  dampDetectionMultiplier: 0.5,
  dampMoveMultiplier: 0.45,
  pulseWarningSec: 1.1,
};

const DIFFICULTY_PRESETS: Record<ScannerSweepDifficulty, DifficultyPreset> = {
  LOW: {
    blindHalfWidth: 0.19,
    zoneSpeed: 0.12,
    maskGainPerSec: 0.24,
    detectionGainPerSec: 0.16,
    detectionDecayPerSec: 0.2,
    pulseIntervalSec: 5,
    pulseDurationSec: 1.4,
    pulseEffects: ['NARROW'],
    beamHalfWidth: 0.09,
    beamDetectionBurstPerSec: 0.5,
  },
  MEDIUM: {
    blindHalfWidth: 0.145,
    zoneSpeed: 0.19,
    maskGainPerSec: 0.21,
    detectionGainPerSec: 0.22,
    detectionDecayPerSec: 0.17,
    pulseIntervalSec: 4.2,
    pulseDurationSec: 1.5,
    pulseEffects: ['NARROW', 'SHIFT'],
    beamHalfWidth: 0.08,
    beamDetectionBurstPerSec: 0.72,
  },
  HIGH: {
    blindHalfWidth: 0.11,
    zoneSpeed: 0.27,
    maskGainPerSec: 0.185,
    detectionGainPerSec: 0.3,
    detectionDecayPerSec: 0.14,
    pulseIntervalSec: 3.4,
    pulseDurationSec: 1.5,
    pulseEffects: ['NARROW', 'ACCELERATE', 'SHIFT'],
    beamHalfWidth: 0.07,
    beamDetectionBurstPerSec: 0.92,
  },
  APEX: {
    blindHalfWidth: 0.095,
    zoneSpeed: 0.33,
    maskGainPerSec: 0.165,
    detectionGainPerSec: 0.36,
    detectionDecayPerSec: 0.12,
    pulseIntervalSec: 2.8,
    pulseDurationSec: 1.6,
    pulseEffects: ['NARROW', 'ACCELERATE', 'SHIFT', 'REVERSE'],
    beamHalfWidth: 0.07,
    beamDetectionBurstPerSec: 1.12,
  },
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function unitRand(seed: string, salt: string): number {
  return (hashSeed(`${seed}:${salt}`) % 10000) / 10000;
}

export function buildScannerSweepConfig(
  difficulty: ScannerSweepDifficulty = 'MEDIUM',
  seed = 'scanner-sweep:default',
): ScannerSweepConfig {
  void seed;
  const preset = DIFFICULTY_PRESETS[difficulty];
  return {
    difficulty,
    blindHalfWidth: preset.blindHalfWidth,
    zoneSpeed: preset.zoneSpeed,
    maskGainPerSec: preset.maskGainPerSec,
    detectionGainPerSec: preset.detectionGainPerSec,
    detectionDecayPerSec: preset.detectionDecayPerSec,
    dampMaskMultiplier: SHARED.dampMaskMultiplier,
    dampDetectionMultiplier: SHARED.dampDetectionMultiplier,
    dampMoveMultiplier: SHARED.dampMoveMultiplier,
    pulseIntervalSec: preset.pulseIntervalSec,
    pulseWarningSec: SHARED.pulseWarningSec,
    pulseDurationSec: preset.pulseDurationSec,
    pulseEffects: preset.pulseEffects,
    beamHalfWidth: preset.beamHalfWidth,
    beamDetectionBurstPerSec: preset.beamDetectionBurstPerSec,
  };
}

export function createInitialZone(config: ScannerSweepConfig, seed: string): ScannerZoneState {
  const hw = config.blindHalfWidth;
  const center = 0.5;
  const target = clamp(0.25 + unitRand(seed, 'zone:t0') * 0.5, hw, 1 - hw);
  return {
    center,
    halfWidth: hw,
    dir: unitRand(seed, 'zone:d0') < 0.5 ? -1 : 1,
    retargetAtSec: 0,
    targetCenter: target,
  };
}

export function createInitialPulse(config: ScannerSweepConfig): SweepPulseState {
  return {
    phase: 'IDLE',
    effect: 'NARROW',
    phaseUntilSec: config.pulseIntervalSec,
    eventIndex: 0,
    beamFrom: 0,
  };
}

/**
 * Beam position on the lane while the pulse is ACTIVE, else null. The beam
 * travels from `beamFrom` edge to the opposite edge over pulseDurationSec.
 */
export function beamPosition(
  pulse: SweepPulseState,
  config: ScannerSweepConfig,
  elapsedSec: number,
): number | null {
  if (pulse.phase !== 'ACTIVE') return null;
  const remaining = pulse.phaseUntilSec - elapsedSec;
  const progress = clamp(1 - remaining / config.pulseDurationSec, 0, 1);
  return pulse.beamFrom === 0 ? progress : 1 - progress;
}

function rollPulseEffect(
  config: ScannerSweepConfig,
  seed: string,
  eventIndex: number,
): SweepPulseEffect {
  const effects = config.pulseEffects;
  const idx = hashSeed(`${seed}:pulse:effect:${eventIndex}`) % effects.length;
  return effects[idx]!;
}

/** Advance the sweep pulse state machine: IDLE → WARNING → ACTIVE → IDLE. */
function advancePulse(
  pulse: SweepPulseState,
  config: ScannerSweepConfig,
  seed: string,
  elapsedSec: number,
): SweepPulseState {
  if (elapsedSec < pulse.phaseUntilSec) return pulse;

  switch (pulse.phase) {
    case 'IDLE': {
      const eventIndex = pulse.eventIndex + 1;
      return {
        phase: 'WARNING',
        effect: rollPulseEffect(config, seed, eventIndex),
        phaseUntilSec: elapsedSec + config.pulseWarningSec,
        eventIndex,
        beamFrom: (hashSeed(`${seed}:beam:${eventIndex}`) % 2) as 0 | 1,
      };
    }
    case 'WARNING':
      return {
        ...pulse,
        phase: 'ACTIVE',
        phaseUntilSec: elapsedSec + config.pulseDurationSec,
      };
    case 'ACTIVE':
    default:
      return {
        ...pulse,
        phase: 'IDLE',
        phaseUntilSec: elapsedSec + config.pulseIntervalSec,
      };
  }
}

function advanceZone(
  zone: ScannerZoneState,
  config: ScannerSweepConfig,
  pulse: SweepPulseState,
  seed: string,
  elapsedSec: number,
  dtSec: number,
): ScannerZoneState {
  let { center, dir, targetCenter, retargetAtSec } = zone;
  let halfWidth = config.blindHalfWidth;
  let speedMult = 1;

  const pulseActive = pulse.phase === 'ACTIVE';
  if (pulseActive) {
    if (pulse.effect === 'NARROW') halfWidth = config.blindHalfWidth * 0.55;
    if (pulse.effect === 'ACCELERATE') speedMult = 1.9;
    if (pulse.effect === 'REVERSE') speedMult = 2.1;
  }

  // Retarget: pick a new drift target periodically or when reached.
  const reached = Math.abs(center - targetCenter) < 0.02;
  if (elapsedSec >= retargetAtSec || reached) {
    const r = unitRand(seed, `zone:target:${Math.floor(elapsedSec * 3)}`);
    targetCenter = clamp(0.18 + r * 0.64, halfWidth, 1 - halfWidth);
    retargetAtSec = elapsedSec + 0.8 + unitRand(seed, `zone:hold:${Math.floor(elapsedSec * 3)}`) * 1.2;
  }

  // On a pulse becoming active, SHIFT/REVERSE snap the drift behavior once.
  if (pulseActive && pulse.effect === 'SHIFT') {
    const jump = unitRand(seed, `zone:shift:${pulse.eventIndex}`);
    targetCenter = clamp(0.18 + jump * 0.64, halfWidth, 1 - halfWidth);
  }
  if (pulseActive && pulse.effect === 'REVERSE') {
    dir = (dir === 1 ? -1 : 1);
  }

  const step = config.zoneSpeed * speedMult * dtSec;
  if (center < targetCenter) {
    center = Math.min(targetCenter, center + step);
    dir = 1;
  } else if (center > targetCenter) {
    center = Math.max(targetCenter, center - step);
    dir = -1;
  }

  center = clamp(center, halfWidth, 1 - halfWidth);

  return { center, halfWidth, dir, targetCenter, retargetAtSec };
}

export function stepScannerSweep(input: ScannerSweepTickInput): ScannerSweepTickResult {
  const { config, seed } = input;

  const pulse = advancePulse(input.pulse, config, seed, input.elapsedSec);
  const zone = advanceZone(zoneFrom(input.zone), config, pulse, seed, input.elapsedSec, input.dtSec);

  const inside = Math.abs(input.cursor - zone.center) <= zone.halfWidth;

  let mask = input.mask;
  let detection = input.detection;

  if (inside) {
    const gain = config.maskGainPerSec
      * (input.dampened ? config.dampMaskMultiplier : 1)
      * input.dtSec;
    mask = clamp(mask + gain, 0, 1);
    detection = clamp(detection - config.detectionDecayPerSec * input.dtSec, 0, 1);
  } else {
    const gain = config.detectionGainPerSec
      * (input.dampened ? config.dampDetectionMultiplier : 1)
      * input.dtSec;
    detection = clamp(detection + gain, 0, 1);
  }

  // Traveling detection beam: passing over an exposed (outside-blind-zone)
  // cursor spikes detection hard. Inside the blind zone the beam sweeps over
  // "empty air" and does nothing.
  const beamPos = beamPosition(pulse, config, input.elapsedSec);
  let caughtInBeam = false;
  if (beamPos != null && !inside && Math.abs(input.cursor - beamPos) <= config.beamHalfWidth) {
    caughtInBeam = true;
    const burst = config.beamDetectionBurstPerSec
      * (input.dampened ? config.dampDetectionMultiplier : 1)
      * input.dtSec;
    detection = clamp(detection + burst, 0, 1);
  }

  const failed = detection >= 1;
  const succeeded = !failed && mask >= 1;

  return {
    mask,
    detection,
    zone,
    pulse,
    inside,
    pulseActive: pulse.phase === 'ACTIVE',
    pulseWarning: pulse.phase === 'WARNING',
    beamPos,
    caughtInBeam,
    failed,
    succeeded,
  };
}

// Guard: keep zone.halfWidth in sync with config default when not mid-pulse.
function zoneFrom(zone: ScannerZoneState): ScannerZoneState {
  return { ...zone };
}

export function scannerDifficultyFromDepth(depth: number | null | undefined): ScannerSweepDifficulty {
  if (depth == null || !Number.isFinite(depth)) return 'MEDIUM';
  if (depth <= 1) return 'LOW';
  if (depth === 2) return 'MEDIUM';
  if (depth === 3) return 'HIGH';
  return 'APEX';
}
