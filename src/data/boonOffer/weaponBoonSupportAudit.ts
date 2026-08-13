/**
 * Nine-weapon boon support audit (Phase 3I) — live catalog only.
 */
import type { WeaponFamilyId } from '../../types/weapon';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from '../weaponRegistry';
import { getWeaponLoadoutRecommendationProfile } from '../weaponLoadoutRecommendationProfiles';
import { buildBoonOfferContext } from './boonOfferContext';
import { buildEligibleWeightedPool } from './boonOfferSelection';
import { listLiveBoonsForClass } from './boonSynergyInventory';

export type WeaponBoonSupportMap = {
  weaponFamilyId: WeaponFamilyId;
  directBasicSupport: string[];
  classMeterSupport: string[];
  strengthAmplification: string[];
  weaknessCompensation: string[];
  alternateDirections: string[];
  engineOrKeystoneRoutes: string[];
  explicitConflicts: string[];
  supportGaps: string[];
};

export function auditWeaponBoonSupport(weaponFamilyId: WeaponFamilyId): WeaponBoonSupportMap {
  const def = getWeaponFamily(weaponFamilyId);
  const sample = getWeaponLoadoutRecommendationProfile(weaponFamilyId).sampleLoadouts[0].slots;
  const ctx = buildBoonOfferContext({
    classId: def.classId,
    weaponFamilyId,
    equippedAbilityIds: sample as unknown as string[],
    ownedBoonIds: [],
    seed: `audit-${weaponFamilyId}`,
    isFirstOffer: true,
  });
  const pool = buildEligibleWeightedPool(ctx);
  const catalog = listLiveBoonsForClass(def.classId);

  const directBasicSupport = pool.filter((c) => c.isDirect).map((c) => c.boonId);
  const classMeterSupport = catalog
    .filter((e) => e.classification === 'CLASS_METER_SUPPORT')
    .map((e) => e.id);
  const strengthAmplification = catalog
    .filter((e) => e.classification === 'STRENGTH_AMPLIFICATION')
    .map((e) => e.id);
  const weaknessCompensation = catalog
    .filter((e) => e.classification === 'WEAKNESS_COMPENSATION')
    .map((e) => e.id);
  const alternateDirections = pool.filter((c) => !c.isConflict).map((c) => c.boonId).slice(0, 8);
  const engineOrKeystoneRoutes = catalog
    .filter((e) => e.category === 'ENGINE' || e.category === 'KEYSTONE')
    .map((e) => e.id);
  const explicitConflicts = pool.filter((c) => c.isConflict).map((c) => c.boonId);

  const supportGaps: string[] = [];
  if (directBasicSupport.length < 1) {
    supportGaps.push('No direct live-boon interaction for equipped basic/loadout');
  }
  // Identity-specific thin routes flagged for design — no new boon IDs invented here.
  if (weaponFamilyId === 'aegis-paired-blades' && !ctx.reachableHooks.includes('RIFT_EDGE_TEMPO')) {
    supportGaps.push('Veil Edge tempo hook unreachable');
  }
  if (weaponFamilyId === 'envoy-vambrace' && !ctx.reachableHooks.includes('ROT_SETUP')) {
    supportGaps.push('Lantern Rot setup unreachable');
  }

  return {
    weaponFamilyId,
    directBasicSupport: directBasicSupport.slice(0, 12),
    classMeterSupport: classMeterSupport.slice(0, 12),
    strengthAmplification: strengthAmplification.slice(0, 12),
    weaknessCompensation,
    alternateDirections,
    engineOrKeystoneRoutes: engineOrKeystoneRoutes.slice(0, 12),
    explicitConflicts,
    supportGaps,
  };
}

export function auditAllWeaponBoonSupport(): WeaponBoonSupportMap[] {
  return ALL_WEAPON_FAMILY_IDS.map(auditWeaponBoonSupport);
}
