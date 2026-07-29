/**
 * Phase 3J — read-only graft runtime inspection for debug.
 */
import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import { buildGraftCastPlan as buildVeilPlan } from '../veilGraftEngine';
import { buildClassGraftCastPlan, getClassGraftDefinition } from '../classGraftEngine';
import type { AegisAbilityId } from '../../types/aegisCombat';
import { getWeaponIdentityProfile } from '../weaponIdentityProfiles';
import { buildLoadoutTagLayers, resolveReachableInteractionHooks } from '../boonOffer/boonOfferContext';
import { getWeaponGraftRecommendationProfile } from './weaponGraftRecommendationProfiles';
import { evaluateGraftCompatibility } from './graftCompatibilityEngine';
import { getGraftSocketAccessForClassRank } from './graftCapacityEngine';

export function inspectEquippedGraftBuild(args: {
  classId: ClassType;
  weaponFamilyId: WeaponFamilyId;
  equippedAbilityIds: readonly string[];
  abilityGrafts: Readonly<Record<string, string>>;
  classRank: number;
}): string {
  const access = getGraftSocketAccessForClassRank(args.classRank);
  const layers = buildLoadoutTagLayers({
    classId: args.classId,
    weaponFamilyId: args.weaponFamilyId,
    equippedAbilityIds: args.equippedAbilityIds,
    abilityGrafts: args.abilityGrafts,
  });
  const hooks = resolveReachableInteractionHooks({
    classId: args.classId,
    weaponFamilyId: args.weaponFamilyId,
    equippedAbilityIds: args.equippedAbilityIds,
    abilityGrafts: args.abilityGrafts,
  });
  const affinity = getWeaponIdentityProfile(args.weaponFamilyId).affinityTags;
  const lines = [
    `weapon=${args.weaponFamilyId}`,
    `rank=${args.classRank} capacity=${access.capacity} used=${Object.keys(args.abilityGrafts).length}`,
    `allowBasic=${access.allowFixedBasic} allowUlt=${access.allowUltimate} allowApex=${access.allowApexMasterwork}`,
    `baseTags=[${layers.baseActionTags.join(',')}]`,
    `runtimeBasic=[${layers.runtimeBasicTags.join(',')}]`,
    `graftAdded=[${layers.graftAddedTags.join(',')}]`,
    `graftRemoved=[${layers.graftRemovedTags.join(',')}]`,
    `finalTags=[${layers.finalTransformedTags.join(',')}]`,
    `reachableHooks=[${hooks.join(',')}]`,
    `affinitySoft=[${affinity.join(',')}]`,
  ];
  Object.entries(args.abilityGrafts).forEach(([abilityId, graftId]) => {
    const compat = evaluateGraftCompatibility({
      classId: args.classId,
      abilityId,
      graftId,
      classRank: args.classRank,
      equippedMap: args.abilityGrafts,
      graftAvailable: true,
    });
    const def = getClassGraftDefinition(args.classId, graftId);
    lines.push(
      `assign ${abilityId}←${graftId} ok=${compat.ok} rej=[${compat.rejections.join(',')}] cost=${def.cost}`,
    );
    const rec = getWeaponGraftRecommendationProfile(args.weaponFamilyId);
    const anti = rec.antiSynergies.find((a) => a.abilityId === abilityId && a.graftId === graftId);
    const syn = rec.applications.find((a) => a.abilityId === abilityId && a.graftId === graftId);
    if (syn) lines.push(`  role=${syn.role} drawbackGuard=${syn.phase3GDrawbackGuard}`);
    if (anti) lines.push(`  advisoryAnti=${anti.playerFacingReason}`);
  });
  return lines.join('\n');
}

/** Prove cast-plan transform exists for an assignment. */
export function inspectGraftCastPlanTransform(
  classId: ClassType,
  abilityId: string,
  graftId: string,
): string {
  if (classId === 'AEGIS') {
    const plan = buildVeilPlan(abilityId as AegisAbilityId, graftId as never);
    return `aegis plan tags=[${plan.effectiveTags.join(',')}] ap=${plan.apCost} dmg×${plan.damageMultiplier}`;
  }
  const plan = buildClassGraftCastPlan(classId, abilityId, graftId as never);
  return `class plan tags=[${plan.effectiveTags.join(',')}] ap=${plan.apCost} ammo=${plan.ammoCost} flux=${plan.fluxCost}`;
}

