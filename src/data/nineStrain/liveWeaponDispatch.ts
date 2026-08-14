import type { CanonicalWeaponFamilyId } from '../weaponFamilyIdNormalize';
import type { EnemyCombatProfile } from '../../types/run';
import { resolveWeaponState } from '../weaponProgressionEngine';
import { createDefaultWeaponRuntime } from '../weaponRunState';
import {
  resolveAegisStrikeBasic,
  resolveEnvoySplinterBasic,
  resolveHexBasicShot,
} from '../weaponBasicEngine';
import { classIdForWeaponFamily } from './classWeaponAdapter';
import type { NineStrainCombatBridge } from './combatBridge';
import { getWeaponIdentityProfile } from '../weaponIdentityProfiles';
import { inspectWeaponBasicTagLayers } from '../weaponTagResolutionEngine';

function stubEnemy(
  unitId: string,
  gridSlot: 'FL_0' | 'FL_1' | 'FL_2',
  kineticArmor: number,
): EnemyCombatProfile {
  return {
    unitId,
    designation: unitId,
    currentHp: 80,
    maxHp: 80,
    gridSlot,
    kineticArmor,
  } as unknown as EnemyCombatProfile;
}

export function makeLiveDispatchSquad(): EnemyCombatProfile[] {
  return [
    stubEnemy('e1', 'FL_1', 1),
    stubEnemy('e2', 'FL_0', 1),
    stubEnemy('e3', 'FL_2', 0),
  ];
}

export interface LiveFamilyDispatchResult {
  familyId: CanonicalWeaponFamilyId;
  actionId: string;
  delivery?: string;
  innateArmorPressureLayers: number;
  hitCount: number;
  uniqueTargets: number;
}

/**
 * Feeds a representative live weapon-basic through the same Hub combat bridge.
 */
export function dispatchLiveWeaponFamilyBasic(
  bridge: NineStrainCombatBridge,
  familyId: CanonicalWeaponFamilyId,
  squad: EnemyCombatProfile[] = makeLiveDispatchSquad(),
  options: { commit?: boolean } = {},
): LiveFamilyDispatchResult {
  const commit = options.commit !== false;
  const classId = classIdForWeaponFamily(familyId);
  const weapon = resolveWeaponState(familyId);
  const runtime = createDefaultWeaponRuntime();
  const tags = inspectWeaponBasicTagLayers({
    familyId,
    basicActionRuntimeTags: getWeaponIdentityProfile(familyId).mechanicalTags,
    graft: null,
  }).finalTransformedTags;

  if (classId === 'AEGIS') {
    const plan = resolveAegisStrikeBasic({
      weapon,
      runtime,
      targetFractured: false,
    });
    const actionId = 'STRIKE';
    bridge.beginRootAttempt({
      actionId,
      classId,
      weaponFamilyId: familyId,
      finalMechanicalTags: plan.mechanicalTags.length ? plan.mechanicalTags : tags,
      authoredCosts: { stamina: plan.staminaCost, ap: 1 },
    });
    if (!commit) {
      bridge.cancelOpenAttempt();
      return { familyId, actionId, hitCount: 0, uniqueTargets: 0, innateArmorPressureLayers: 0 };
    }
    bridge.markCommitted({
      actualCostsPaid: { stamina: plan.staminaCost, ap: 1 },
      lockedTargetIds: ['e1'],
      targetPattern: 'SINGLE',
    });
    bridge.recordNativeHit({ targetId: 'e1', damage: plan.kineticDamage + plan.occultRiderDamage });
    bridge.finishRootAttempt();
    if (plan.reserveGain > 0) {
      bridge.noteCurrent({ classId, ordinaryGain: true });
    }
    return {
      familyId,
      actionId,
      hitCount: 1,
      uniqueTargets: 1,
      innateArmorPressureLayers: 0,
    };
  }

  if (classId === 'HEX_SHOT') {
    const plan = resolveHexBasicShot({
      weapon,
      squad,
      primaryTargetId: 'e1',
      catalogBaseDamage: 10,
    });
    const actionId = 'SILVER_CORE_SIDEARM';
    const uniqueTargets = [...new Set(plan.hits.map((hit) => hit.targetId))];
    bridge.beginRootAttempt({
      actionId,
      classId,
      weaponFamilyId: familyId,
      finalMechanicalTags: plan.mechanicalTags,
      authoredCosts: { ammo: plan.ammoCost, stamina: plan.staminaCost, ap: 1 },
    });
    if (!commit || plan.hits.length === 0) {
      bridge.cancelOpenAttempt();
      return {
        familyId,
        actionId,
        delivery: plan.delivery,
        hitCount: 0,
        uniqueTargets: 0,
        innateArmorPressureLayers: plan.innateArmorPressureLayers,
      };
    }
    bridge.markCommitted({
      actualCostsPaid: { ammo: plan.ammoCost, stamina: plan.staminaCost, ap: 1 },
      lockedTargetIds: uniqueTargets,
      targetPattern: plan.delivery === 'SPREAD' ? 'SPREAD' : 'SINGLE',
    });
    for (const hit of plan.hits) {
      bridge.recordNativeHit({ targetId: hit.targetId, damage: hit.damage });
    }
    bridge.finishRootAttempt();
    if (plan.ammoCost > 0) {
      bridge.noteCurrent({
        classId,
        ammoSpent: true,
        magazineEmptyOrFull: false,
      });
    }
    return {
      familyId,
      actionId,
      delivery: plan.delivery,
      hitCount: plan.hits.length,
      uniqueTargets: uniqueTargets.length,
      innateArmorPressureLayers: plan.innateArmorPressureLayers,
    };
  }

  const plan = resolveEnvoySplinterBasic({
    weapon,
    catalogDamage: 10,
    catalogFluxCost: 5,
    veilFlux: 40,
    operativeHp: 80,
    maxHp: 80,
    previousCatalyst: null,
  });
  const actionId = 'VEIL_SPLINTER';
  bridge.beginRootAttempt({
    actionId,
    classId,
    weaponFamilyId: familyId,
    finalMechanicalTags: plan.mechanicalTags,
    authoredCosts: { flux: plan.fluxCost, hp: plan.hpSacrifice, ap: 1 },
  });
  if (!commit) {
    bridge.cancelOpenAttempt();
    return { familyId, actionId, hitCount: 0, uniqueTargets: 0, innateArmorPressureLayers: 0 };
  }
  bridge.markCommitted({
    actualCostsPaid: { flux: plan.fluxCost, hp: plan.hpSacrifice, ap: 1 },
    lockedTargetIds: ['e1'],
    targetPattern: 'SINGLE',
  });
    bridge.recordNativeHit({ targetId: 'e1', damage: plan.occultDamage });
  bridge.finishRootAttempt();
  if (plan.fluxCost > 0) {
    bridge.noteCurrent({ classId, ordinarySpend: true });
  }
  if (plan.hpSacrifice > 0) {
    bridge.noteEvent('HP_LOSS_VOLUNTARY', { paid: plan.hpSacrifice, classId });
  }
  return {
    familyId,
    actionId,
    hitCount: 1,
    uniqueTargets: 1,
    innateArmorPressureLayers: 0,
  };
}
