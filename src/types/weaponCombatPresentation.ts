/**
 * Phase 3M — weapon combat presentation (feel / VFX / SFX).
 * Presentation-only. Never mutates combat resolution.
 */

import type { WeaponFamilyId } from './weapon';
import type { WeaponAnchorAttackId } from '../data/weaponAnchorAttackRegistry';
import type { WeaponUltimateId } from '../data/weaponUltimateRegistry';

export type PresentationMotionFamily =
  | 'DIRECTIONAL_SLASH'
  | 'MIRRORED_SLASH'
  | 'HEAVY_VERTICAL'
  | 'PROJECTILE_TRACER'
  | 'BURST_TRACER'
  | 'BREACH_RINGS'
  | 'CRESCENT_ARC'
  | 'THREAD_KNOT'
  | 'CIRCUIT_NODE'
  | 'POLYGON_REFRACTION';

export type PresentationPaletteId =
  | 'PALE_STEEL_MINT'
  | 'CYAN_VEIL'
  | 'HEAVY_IRON'
  | 'SILVER_SEAL'
  | 'CINDER_ASH'
  | 'NULL_BREACH'
  | 'CURSE_VIOLET'
  | 'NULL_CYAN'
  | 'CRIMSON_GLASS';

export type PresentationHitStopClass = 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'ULTIMATE';
export type PresentationShakeClass = 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'ULTIMATE' | 'NONE';
export type PresentationHapticClass = 'LIGHT' | 'HEAVY' | 'NONE';

export type PresentationOutcomeKind =
  | 'HIT'
  | 'MISS'
  | 'EVADE'
  | 'BLOCKED'
  | 'IMMUNE'
  | 'ZERO_DAMAGE'
  | 'MITIGATED';

export type PresentationDefenseMaterial = 'NONE' | 'KINETIC_ARMOR' | 'OCCULT_WARD';

export type PresentationPrimitiveId =
  | 'directional_slash'
  | 'mirrored_slash'
  | 'heavy_vertical'
  | 'projectile_tracer'
  | 'burst_tracer_group'
  | 'muzzle_flash'
  | 'concentric_breach_rings'
  | 'arc_crescent'
  | 'thread_connection'
  | 'knot_tension'
  | 'circuit_node_connection'
  | 'polygonal_refraction'
  | 'radial_chamber'
  | 'impact_spark'
  | 'ka_plate_pulse'
  | 'ow_glyph_flare'
  | 'fracture_crack'
  | 'defense_break_float'
  | 'resource_pulse'
  | 'hit_stop'
  | 'screen_shake'
  | 'pose_swap'
  | 'audio_one_shot'
  | 'outline_pulse';

export type PresentationStage = 'ANTICIPATION' | 'RELEASE' | 'CONTACT' | 'AFTERMATH';

export interface PresentationCueIds {
  release: string;
  travel: string;
  fleshContact: string;
  kineticArmor: string;
  occultWard: string;
  fracture: string;
  defenseBreak: string;
  killConfirm: string;
  resourceLoop: string;
  reloadOrSacrifice?: string;
}

export interface PresentationSequenceStep {
  stage: PresentationStage;
  primitive: PresentationPrimitiveId;
  cueId?: string;
  delayMs: number;
  durationMs: number;
}

export interface WeaponCombatPresentationProfile {
  weaponFamilyId: WeaponFamilyId;
  /** Display-safe name from weapon registry — never used as a lookup key. */
  displayName: string;
  motionFamily: PresentationMotionFamily;
  palette: PresentationPaletteId;
  trailShape: string;
  cues: PresentationCueIds;
  anchorId: WeaponAnchorAttackId;
  ultimateId: WeaponUltimateId;
  anchorSequence: readonly PresentationSequenceStep[];
  ultimateSequence: readonly PresentationSequenceStep[];
  hitStopClass: PresentationHitStopClass;
  shakeClass: PresentationShakeClass;
  hapticClass: PresentationHapticClass;
  /** Pose asset keys — resolved via combatPlayerPortrait (permanent weapon ID). */
  idlePoseKey: WeaponFamilyId;
  attackPoseKey: WeaponFamilyId;
  artFallback: 'TRANSFORM_IMPULSE';
  reducedMotionPrimitive: PresentationPrimitiveId;
  reducedFlashPrimitive: PresentationPrimitiveId;
}

export interface WeaponCombatFeedbackHit {
  targetId: string;
  order: number;
  damage: number;
  channel: 'KINETIC' | 'OCCULT' | 'TRUE' | 'BALLISTIC' | 'UNKNOWN';
  outcome: PresentationOutcomeKind;
  critical: boolean;
  defenseMaterial: PresentationDefenseMaterial;
  armorStacksStripped: number;
  wardStacksStripped: number;
  fullArmorBreak: boolean;
  fullWardBreak: boolean;
  fractureApplied: boolean;
  fractureExploited: boolean;
  killed: boolean;
}

export interface WeaponCombatFeedbackPacket {
  id: string;
  actingEntity: 'PLAYER';
  weaponFamilyId: WeaponFamilyId;
  actionKind: 'ANCHOR' | 'ULTIMATE' | 'ABILITY' | 'RELOAD' | 'RESOURCE' | 'GENERIC';
  actionId: string;
  displayActionName: string;
  hits: readonly WeaponCombatFeedbackHit[];
  intensity: PresentationHitStopClass;
  ultimateGrade?: string | null;
  reloadOccurred: boolean;
  ammoRoundsConsumed: number;
  sacrificeOccurred: boolean;
  resourceTransitions: readonly string[];
  tempoArmed: boolean;
  tempoSpent: boolean;
  presentationOnly: true;
  cueOverrides?: Partial<PresentationCueIds>;
  labForced?: boolean;
}

export interface CombatPresentationSettings {
  sfxMuted: boolean;
  /** 0–1 */
  sfxVolume: number;
  screenShakeEnabled: boolean;
  reducedMotion: boolean;
  reducedFlash: boolean;
  hapticsEnabled: boolean;
  /** 1 = normal; higher compresses presentation timing */
  combatSpeed: number;
}

export const DEFAULT_COMBAT_PRESENTATION_SETTINGS: CombatPresentationSettings = {
  sfxMuted: false,
  sfxVolume: 0.7,
  screenShakeEnabled: true,
  reducedMotion: false,
  reducedFlash: false,
  hapticsEnabled: true,
  combatSpeed: 1,
};

export const HIT_STOP_MS: Record<PresentationHitStopClass, number> = {
  LIGHT: 42,
  MEDIUM: 72,
  HEAVY: 110,
  ULTIMATE: 148,
};

export const SHAKE_TO_JUICE: Record<PresentationShakeClass, 'micro' | 'light' | 'heavy' | null> = {
  NONE: null,
  LIGHT: 'micro',
  MEDIUM: 'light',
  HEAVY: 'heavy',
  ULTIMATE: 'heavy',
};
