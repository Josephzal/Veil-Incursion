/**
 * Phase 3M — feedback packets derived from already-resolved combat outcomes.
 * Never recalculates damage, crit, strip, or kill.
 */

import type { WeaponFamilyId } from '../../types/weapon';
import type {
  PresentationDefenseMaterial,
  PresentationHitStopClass,
  PresentationOutcomeKind,
  WeaponCombatFeedbackHit,
  WeaponCombatFeedbackPacket,
} from '../../types/weaponCombatPresentation';
import { getWeaponCombatPresentationProfile } from './profiles';

let packetSeq = 0;

export interface BuildWeaponFeedbackPacketInput {
  weaponFamilyId: WeaponFamilyId;
  actionKind: WeaponCombatFeedbackPacket['actionKind'];
  actionId: string;
  displayActionName: string;
  hits: readonly WeaponCombatFeedbackHit[];
  ultimateGrade?: string | null;
  reloadOccurred?: boolean;
  ammoRoundsConsumed?: number;
  sacrificeOccurred?: boolean;
  resourceTransitions?: readonly string[];
  tempoArmed?: boolean;
  tempoSpent?: boolean;
  intensityOverride?: PresentationHitStopClass;
  labForced?: boolean;
}

export function buildWeaponCombatFeedbackHit(input: {
  targetId: string;
  order: number;
  damage: number;
  channel?: WeaponCombatFeedbackHit['channel'];
  outcome?: PresentationOutcomeKind;
  critical?: boolean;
  defenseMaterial?: PresentationDefenseMaterial;
  armorStacksStripped?: number;
  wardStacksStripped?: number;
  fullArmorBreak?: boolean;
  fullWardBreak?: boolean;
  fractureApplied?: boolean;
  fractureExploited?: boolean;
  killed?: boolean;
}): WeaponCombatFeedbackHit {
  const damage = Math.max(0, input.damage);
  const outcome = input.outcome
    ?? (damage <= 0 ? 'ZERO_DAMAGE' : 'HIT');
  return {
    targetId: input.targetId,
    order: input.order,
    damage,
    channel: input.channel ?? 'UNKNOWN',
    outcome,
    critical: Boolean(input.critical),
    defenseMaterial: input.defenseMaterial ?? 'NONE',
    armorStacksStripped: input.armorStacksStripped ?? 0,
    wardStacksStripped: input.wardStacksStripped ?? 0,
    fullArmorBreak: Boolean(input.fullArmorBreak),
    fullWardBreak: Boolean(input.fullWardBreak),
    fractureApplied: Boolean(input.fractureApplied),
    fractureExploited: Boolean(input.fractureExploited),
    killed: Boolean(input.killed),
  };
}

export function buildWeaponCombatFeedbackPacket(
  input: BuildWeaponFeedbackPacketInput,
): WeaponCombatFeedbackPacket {
  packetSeq += 1;
  const profile = getWeaponCombatPresentationProfile(input.weaponFamilyId);
  const intensity = input.intensityOverride
    ?? (input.actionKind === 'ULTIMATE' ? 'ULTIMATE' : profile.hitStopClass);
  return {
    id: `wpn-fx-${packetSeq}`,
    actingEntity: 'PLAYER',
    weaponFamilyId: input.weaponFamilyId,
    actionKind: input.actionKind,
    actionId: input.actionId,
    displayActionName: input.displayActionName,
    hits: input.hits,
    intensity,
    ultimateGrade: input.ultimateGrade ?? null,
    reloadOccurred: Boolean(input.reloadOccurred),
    ammoRoundsConsumed: Math.max(0, input.ammoRoundsConsumed ?? 0),
    sacrificeOccurred: Boolean(input.sacrificeOccurred),
    resourceTransitions: input.resourceTransitions ?? [],
    tempoArmed: Boolean(input.tempoArmed),
    tempoSpent: Boolean(input.tempoSpent),
    presentationOnly: true,
    labForced: Boolean(input.labForced),
  };
}

/** True when contact should play damaging flesh impact (not miss/evade). */
export function shouldPlayDamagingImpact(hit: WeaponCombatFeedbackHit): boolean {
  if (hit.outcome === 'MISS' || hit.outcome === 'EVADE' || hit.outcome === 'IMMUNE') {
    return false;
  }
  return hit.damage > 0 || hit.outcome === 'MITIGATED' || hit.outcome === 'ZERO_DAMAGE';
}

export function shouldPlayFleshCue(hit: WeaponCombatFeedbackHit): boolean {
  return hit.outcome === 'HIT' && hit.damage > 0 && hit.defenseMaterial === 'NONE';
}
