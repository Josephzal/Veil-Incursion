/**
 * Phase 3M — helpers to emit presentation from already-resolved combat outcomes.
 */

import type { WeaponFamilyId } from '../../types/weapon';
import type { WeaponCombatFeedbackPacket } from '../../types/weaponCombatPresentation';
import {
  buildWeaponCombatFeedbackHit,
  buildWeaponCombatFeedbackPacket,
} from './feedbackPacket';
import { getWeaponCombatPresentationProfile } from './profiles';
import { WEAPON_ANCHOR_ATTACK_BY_FAMILY } from '../weaponAnchorAttackRegistry';
import { WEAPON_ULTIMATE_BY_FAMILY } from '../weaponUltimateRegistry';
import { isWeaponUltimateActionId } from '../weaponUltimateSurfaceEngine';
import {
  dispatchWeaponCombatPresentation,
  revealWeaponCombatContact,
} from '../../utils/combatPresentationBus';
import { playCombatPresentationCue } from '../../utils/combatPresentationAudio';

let lastCastKey = '';
let lastCastAt = 0;

export function presentResolvedWeaponHit(input: {
  weaponFamilyId: WeaponFamilyId;
  abilityId?: string | null;
  targetId: string;
  damage: number;
  critical: boolean;
  killed: boolean;
  evaded?: boolean;
  channel?: 'KINETIC' | 'OCCULT' | 'TRUE' | 'BALLISTIC' | 'UNKNOWN';
  defenseMaterial?: 'NONE' | 'KINETIC_ARMOR' | 'OCCULT_WARD';
  fullArmorBreak?: boolean;
  fullWardBreak?: boolean;
  fractureApplied?: boolean;
  fractureExploited?: boolean;
  actionKind?: WeaponCombatFeedbackPacket['actionKind'];
  displayActionName?: string;
  ammoRoundsConsumed?: number;
  reloadOccurred?: boolean;
  sacrificeOccurred?: boolean;
  tempoArmed?: boolean;
  tempoSpent?: boolean;
  ultimateGrade?: string | null;
  resourceTransitions?: readonly string[];
}): void {
  const profile = getWeaponCombatPresentationProfile(input.weaponFamilyId);
  const anchor = WEAPON_ANCHOR_ATTACK_BY_FAMILY[input.weaponFamilyId];
  const ultimate = WEAPON_ULTIMATE_BY_FAMILY[input.weaponFamilyId];
  const actionKind = input.actionKind
    ?? (isWeaponUltimateActionId(input.abilityId) ? 'ULTIMATE' : 'ANCHOR');
  const actionId = input.abilityId
    ?? (actionKind === 'ULTIMATE' ? ultimate.id : anchor.id);
  const displayActionName = input.displayActionName
    ?? (actionKind === 'ULTIMATE' ? ultimate.displayName : anchor.displayName);

  const castKey = `${input.weaponFamilyId}:${actionId}`;
  const now = Date.now();
  const inBurst = castKey === lastCastKey && now - lastCastAt < 90;
  lastCastKey = castKey;
  lastCastAt = now;

  // Multi-hit burst: keep one release envelope; only contact accents afterward.
  if (inBurst && !input.evaded) {
    // Scythe stays release-only for contact accents — still play crit sting.
    if (input.weaponFamilyId !== 'envoy-scythe') {
      if (input.defenseMaterial === 'KINETIC_ARMOR') {
        playCombatPresentationCue(profile.cues.kineticArmor);
      } else if (input.defenseMaterial === 'OCCULT_WARD') {
        playCombatPresentationCue(profile.cues.occultWard);
      } else if (input.damage > 0) {
        playCombatPresentationCue(profile.cues.fleshContact);
      }
      if (input.killed) playCombatPresentationCue(profile.cues.killConfirm);
    }
    if (input.critical && input.damage > 0) {
      playCombatPresentationCue('sfx.critical_hit');
    }
    // No scheduled CONTACT step on burst follow-ups — reveal hit FX immediately.
    if (input.damage > 0) {
      revealWeaponCombatContact({
        targetId: input.targetId,
        packetId: `burst-${castKey}-${now}`,
        critical: input.critical === true,
        damage: input.damage,
      });
    }
    return;
  }

  const hit = buildWeaponCombatFeedbackHit({
    targetId: input.targetId,
    order: 0,
    damage: input.evaded ? 0 : input.damage,
    channel: input.channel,
    outcome: input.evaded ? 'EVADE' : undefined,
    critical: input.critical && !input.evaded,
    defenseMaterial: input.defenseMaterial,
    fullArmorBreak: input.fullArmorBreak,
    fullWardBreak: input.fullWardBreak,
    fractureApplied: input.fractureApplied,
    fractureExploited: input.fractureExploited,
    killed: input.killed && !input.evaded,
  });

  const packet = buildWeaponCombatFeedbackPacket({
    weaponFamilyId: input.weaponFamilyId,
    actionKind,
    actionId: String(actionId),
    displayActionName,
    hits: [hit],
    ammoRoundsConsumed: input.ammoRoundsConsumed,
    reloadOccurred: input.reloadOccurred,
    sacrificeOccurred: input.sacrificeOccurred,
    tempoArmed: input.tempoArmed,
    tempoSpent: input.tempoSpent,
    ultimateGrade: input.ultimateGrade,
    resourceTransitions: input.resourceTransitions,
  });

  dispatchWeaponCombatPresentation(packet);
}
