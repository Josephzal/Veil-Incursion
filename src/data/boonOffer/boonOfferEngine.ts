/**
 * Phase 3I public offer engine — hard eligibility → soft weight → seeded composition.
 */
import type { ClassType } from '../../types/game';
import type { PostCombatBoonOffer } from '../../types/classBoon';
import type { EnvoyBoonId, HexShotBoonId } from '../../types/classBoon';
import type { LeyLineMutationId } from '../../types/leyLineMutation';
import type { WeaponFamilyId } from '../../types/weapon';
import { ENVOY_BOON_CATALOG } from '../envoyBoons';
import { HEX_SHOT_BOON_CATALOG } from '../hexShotBoons';
import { LEY_LINE_MUTATION_CATALOG } from '../leyLineMutations';
import { buildBoonOfferContext } from './boonOfferContext';
import {
  formatBoonOfferWeightDebug,
  inspectBoonOfferWeight,
  selectSeededBoonOffers,
  buildEligibleWeightedPool,
} from './boonOfferSelection';
import type { BoonOfferContext } from './boonOfferTypes';

export type PrepareWeightedBoonOffersArgs = {
  classId: ClassType;
  weaponFamilyId: WeaponFamilyId;
  equippedAbilityIds: readonly string[];
  ownedAegis: readonly LeyLineMutationId[];
  ownedHex: readonly HexShotBoonId[];
  ownedEnvoy: readonly EnvoyBoonId[];
  seed: string;
  count?: number;
  depthBand?: 1 | 2 | 3;
  isFirstOffer?: boolean;
  acquiredEngineFamilies?: readonly string[];
  /** Equipped ability → graft map (Phase 3J). */
  abilityGrafts?: Readonly<Record<string, string>>;
};

function ownedForClass(
  classId: ClassType,
  ownedAegis: readonly LeyLineMutationId[],
  ownedHex: readonly HexShotBoonId[],
  ownedEnvoy: readonly EnvoyBoonId[],
): readonly string[] {
  if (classId === 'HEX_SHOT') return ownedHex;
  if (classId === 'ENVOY') return ownedEnvoy;
  return ownedAegis;
}

function toOffer(classId: ClassType, id: string): PostCombatBoonOffer {
  if (classId === 'HEX_SHOT') {
    const def = HEX_SHOT_BOON_CATALOG[id as HexShotBoonId];
    return {
      id: def.id,
      classId: 'HEX_SHOT',
      name: def.name,
      tier: def.tier,
      tierLabel: def.tierLabel,
      description: def.description,
      effect: def.effect,
    };
  }
  if (classId === 'ENVOY') {
    const def = ENVOY_BOON_CATALOG[id as EnvoyBoonId];
    return {
      id: def.id,
      classId: 'ENVOY',
      name: def.name,
      tier: def.tier,
      tierLabel: def.tierLabel,
      description: def.description,
      effect: def.effect,
    };
  }
  const def = LEY_LINE_MUTATION_CATALOG[id as LeyLineMutationId];
  return {
    id: def.id,
    classId: 'AEGIS',
    name: def.name,
    tier: def.tier,
    tierLabel: def.tier,
    description: def.description,
    effect: def.effect,
  };
}

export function prepareWeightedBoonOffers(
  args: PrepareWeightedBoonOffersArgs,
): PostCombatBoonOffer[] {
  const owned = ownedForClass(
    args.classId,
    args.ownedAegis,
    args.ownedHex,
    args.ownedEnvoy,
  );
  const ctx = buildBoonOfferContext({
    classId: args.classId,
    weaponFamilyId: args.weaponFamilyId,
    equippedAbilityIds: args.equippedAbilityIds,
    ownedBoonIds: owned,
    acquiredEngineFamilies: args.acquiredEngineFamilies,
    depthBand: args.depthBand,
    isFirstOffer: args.isFirstOffer,
    seed: args.seed,
    offerCount: args.count ?? 3,
    abilityGrafts: args.abilityGrafts,
  });
  return selectSeededBoonOffers(ctx).map((id) => toOffer(args.classId, id));
}

export function buildOfferContextFromArgs(
  args: PrepareWeightedBoonOffersArgs,
): BoonOfferContext {
  return buildBoonOfferContext({
    classId: args.classId,
    weaponFamilyId: args.weaponFamilyId,
    equippedAbilityIds: args.equippedAbilityIds,
    ownedBoonIds: ownedForClass(
      args.classId,
      args.ownedAegis,
      args.ownedHex,
      args.ownedEnvoy,
    ),
    acquiredEngineFamilies: args.acquiredEngineFamilies,
    depthBand: args.depthBand,
    isFirstOffer: args.isFirstOffer,
    seed: args.seed,
    offerCount: args.count ?? 3,
    abilityGrafts: args.abilityGrafts,
  });
}

export {
  formatBoonOfferWeightDebug,
  inspectBoonOfferWeight,
  selectSeededBoonOffers,
  buildEligibleWeightedPool,
  buildBoonOfferContext,
};
