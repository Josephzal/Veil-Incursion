/**
 * Combat Refactor Phase 5 — juice feedback event builder + config scaling.
 */

import type {
  CombatJuiceFeedbackConfig,
  CombatJuiceFeedbackEvent,
  CombatJuiceFeedbackEventType,
  CombatJuiceIntensity,
} from '../types/combatJuiceFeedback';
import {
  COMBAT_JUICE_DEFAULTS,
  COMBAT_JUICE_FEEDBACK_CONFIG,
} from './balance/combatDirectorBalanceConfig';

let juiceSeq = 0;

export function getCombatJuiceFeedbackConfig(): CombatJuiceFeedbackConfig {
  return {
    enableScreenShake: COMBAT_JUICE_FEEDBACK_CONFIG.enableScreenShake,
    enableHitStop: COMBAT_JUICE_FEEDBACK_CONFIG.enableHitStop,
    reduceFlashing: COMBAT_JUICE_FEEDBACK_CONFIG.reduceFlashing,
    combatFeedbackIntensity: COMBAT_JUICE_FEEDBACK_CONFIG.combatFeedbackIntensity,
  };
}

function defaultIntensity(type: CombatJuiceFeedbackEventType): CombatJuiceIntensity {
  if (
    type === 'ELITE_KILL'
    || type === 'PERFECT_PARRY'
    || type === 'OBJECTIVE_FAILED'
  ) return 'HIGH';
  if (
    type === 'ARMOR_BREAK'
    || type === 'WARD_BREAK'
    || type === 'FRACTURE_APPLIED'
    || type === 'FRACTURE_EXPLOITED'
    || type === 'INTENT_COUNTERED'
    || type === 'RIPOSTE'
    || type === 'KILL'
    || type === 'DIRTY_EXTRACTION_SURVIVED'
    || type === 'OBJECTIVE_COMPLETED'
  ) return 'MEDIUM';
  if (type === 'DANGER_PULSE') return 'HIGH';
  return 'LOW';
}

export function buildCombatJuiceEvent(
  type: CombatJuiceFeedbackEventType,
  opts?: {
    sourceCombatantId?: string;
    targetCombatantIds?: string[];
    text?: string;
    intensity?: CombatJuiceIntensity;
    metadata?: Record<string, unknown>;
    config?: CombatJuiceFeedbackConfig;
  },
): CombatJuiceFeedbackEvent {
  juiceSeq += 1;
  const config = opts?.config ?? getCombatJuiceFeedbackConfig();
  const defaults = COMBAT_JUICE_DEFAULTS[type] ?? COMBAT_JUICE_DEFAULTS.DAMAGE_LIGHT!;
  const scale = Math.max(0, Math.min(1, config.combatFeedbackIntensity));
  const reduce = config.reduceFlashing;

  let hitStopMs = config.enableHitStop
    ? Math.round((defaults.hitStopMs ?? 0) * scale)
    : 0;
  if (reduce) hitStopMs = Math.min(hitStopMs, 40);

  const shakeOn = config.enableScreenShake && (defaults.shakeIntensity ?? 0) > 0 && !reduce;
  const screenShake = shakeOn
    ? {
        intensity: (defaults.shakeIntensity ?? 0) * scale,
        durationMs: Math.round((defaults.shakeDurationMs ?? 0) * scale),
      }
    : undefined;

  return {
    id: `juice-${juiceSeq}-${type}`,
    type,
    sourceCombatantId: opts?.sourceCombatantId,
    targetCombatantIds: opts?.targetCombatantIds,
    intensity: opts?.intensity ?? defaultIntensity(type),
    text: opts?.text,
    hitStopMs: hitStopMs > 0 ? hitStopMs : undefined,
    screenShake,
    cameraFocus: reduce ? false : defaults.cameraFocus,
    soundCueId: `sfx.${type.toLowerCase()}`,
    vfxCueId: `vfx.${type.toLowerCase()}`,
    animationCueId: `anim.${type.toLowerCase()}`,
    uiPulse: defaults.uiPulse && !reduce,
    metadata: opts?.metadata,
  };
}

export function createEmptyJuiceTelemetry(): {
  eventsByType: Partial<Record<CombatJuiceFeedbackEventType, number>>;
  highIntensityCount: number;
  totalHitStopMs: number;
  screenShakeCount: number;
} {
  return {
    eventsByType: {},
    highIntensityCount: 0,
    totalHitStopMs: 0,
    screenShakeCount: 0,
  };
}

export type CombatJuiceTelemetry = ReturnType<typeof createEmptyJuiceTelemetry>;

export function recordJuiceEvent(
  telemetry: CombatJuiceTelemetry,
  event: CombatJuiceFeedbackEvent,
): void {
  telemetry.eventsByType[event.type] = (telemetry.eventsByType[event.type] ?? 0) + 1;
  if (event.intensity === 'HIGH' || event.intensity === 'CRITICAL') {
    telemetry.highIntensityCount += 1;
  }
  telemetry.totalHitStopMs += event.hitStopMs ?? 0;
  if (event.screenShake) telemetry.screenShakeCount += 1;
}

export function formatJuiceEventStream(
  events: readonly CombatJuiceFeedbackEvent[],
): string {
  if (events.length === 0) return 'No juice events.';
  return events
    .map((e) => `  [${e.intensity}] ${e.type} hitStop=${e.hitStopMs ?? 0}ms shake=${e.screenShake?.intensity ?? 0}`)
    .join('\n');
}
