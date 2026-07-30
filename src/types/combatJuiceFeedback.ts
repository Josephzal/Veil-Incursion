/**
 * Combat Refactor Phase 5 — combat juice / VFX / SFX feedback hooks.
 * Phase 3M wires these events into audible/visual presentation via combatPresentationBus.
 */

export type CombatJuiceIntensity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CombatJuiceFeedbackEventType =
  | 'DAMAGE_LIGHT'
  | 'DAMAGE_HEAVY'
  | 'CRITICAL_HIT'
  | 'KILL'
  | 'ELITE_KILL'
  | 'BOSS_HIT'
  | 'ARMOR_HIT'
  | 'ARMOR_BREAK'
  | 'WARD_HIT'
  | 'WARD_BREAK'
  | 'FRACTURE_APPLIED'
  | 'FRACTURE_EXPLOITED'
  | 'INTENT_STARTED'
  | 'INTENT_COUNTERED'
  | 'INTENT_RESOLVED'
  | 'PERFECT_PARRY'
  | 'RIPOSTE'
  | 'HEX_CORRECT_ROUND'
  | 'ENVOY_CATALYST_RESONANCE'
  | 'OBJECTIVE_STARTED'
  | 'OBJECTIVE_COMPLETED'
  | 'OBJECTIVE_FAILED'
  | 'TIMELINE_EVENT_TRIGGERED'
  | 'CARGO_DAMAGED'
  | 'DIRTY_EXTRACTION_SURVIVED'
  | 'DANGER_PULSE';

export interface CombatJuiceScreenShake {
  intensity: number;
  durationMs: number;
}

export interface CombatJuiceFeedbackEvent {
  id: string;
  type: CombatJuiceFeedbackEventType;
  sourceCombatantId?: string;
  targetCombatantIds?: string[];
  intensity: CombatJuiceIntensity;
  text?: string;
  hitStopMs?: number;
  screenShake?: CombatJuiceScreenShake;
  cameraFocus?: boolean;
  slowMotionMs?: number;
  soundCueId?: string;
  vfxCueId?: string;
  animationCueId?: string;
  uiPulse?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CombatJuiceFeedbackConfig {
  enableScreenShake: boolean;
  enableHitStop: boolean;
  reduceFlashing: boolean;
  /** 0–1 scale applied to shake/hit-stop. */
  combatFeedbackIntensity: number;
}
