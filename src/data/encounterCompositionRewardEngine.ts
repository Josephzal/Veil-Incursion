import type { EncounterRewardTier, EncounterCompositionTemplateId } from '../types/encounterComposition';
import type { ResourceItemId } from '../types/resourceItem';
import type { VeilBiome } from '../types/encounterSpawn';

/** Credit multiplier applied after depth scaling — small, not a rebalance. */
export function compositionCreditMultiplier(tier: EncounterRewardTier | null | undefined): number {
  switch (tier) {
    case 'BASELINE':
      return 1.0;
    case 'IMPROVED':
      return 1.12;
    case 'HIGH_VALUE':
      return 1.22;
    case 'RARE':
      return 1.35;
    case 'APEX_CHANCE':
      return 1.45;
    default:
      return 1.0;
  }
}

export function applyCompositionCreditScaling(
  baseCredits: number,
  tier: EncounterRewardTier | null | undefined,
): number {
  if (baseCredits <= 0) return 0;
  return Math.floor(baseCredits * compositionCreditMultiplier(tier));
}

/** Extra salvage roll chance % baked into combat reward context. */
export function compositionRareLootBonusPct(tier: EncounterRewardTier | null | undefined): number {
  switch (tier) {
    case 'IMPROVED':
      return 8;
    case 'HIGH_VALUE':
      return 16;
    case 'RARE':
      return 28;
    case 'APEX_CHANCE':
      return 40;
    default:
      return 0;
  }
}

/** Bonus common staples for swarm-style tiers (tempo fights). */
export function compositionCommonMaterialBonusCount(
  tier: EncounterRewardTier | null | undefined,
  templateId?: EncounterCompositionTemplateId | null,
): number {
  if (templateId === 'SWARM_PRESSURE') {
    return tier === 'BASELINE' ? 1 : 2;
  }
  if (tier === 'BASELINE') return 0;
  if (tier === 'IMPROVED') return 0;
  return 1;
}

/** Sector-flavored tech/material bias for artillery / industrial fights. */
export function sectorTechBiasPool(veilBiome: VeilBiome | null | undefined): ResourceItemId[] {
  switch (veilBiome) {
    case 'SLAG_WORKS':
      return ['combustion-cylinder', 'legion-blood-iron', 'encrypted-grid-drive'];
    case 'BLACKLINE_TERMINUS':
      return ['encrypted-grid-drive', 'combustion-cylinder'];
    case 'ASHEN_WASTE':
      return ['legion-blood-iron', 'combustion-cylinder', 'veil-ash-canister'];
    case 'NULL_ZONE':
      return ['encrypted-grid-drive', 'echo-glass-shard'];
    case 'ABYSSAL_SINK':
      return ['echo-glass-shard', 'ossified-ley-knot', 'sanguine-ampoule'];
    default:
      return ['ley-slag', 'echo-glass-shard'];
  }
}

export function compositionExtraLootIds(args: {
  tier: EncounterRewardTier | null | undefined;
  templateId?: EncounterCompositionTemplateId | null;
  veilBiome?: VeilBiome | null;
  highValue?: boolean;
  echoSignal?: boolean;
  anchorSignal?: boolean;
}): ResourceItemId[] {
  const extras: ResourceItemId[] = [];
  const biomePool = sectorTechBiasPool(args.veilBiome);

  if (args.templateId === 'ARTILLERY_KILLBOX' || args.templateId === 'ELITE_NEST') {
    extras.push(biomePool[0]!);
  }
  if (args.templateId === 'ECHO_CONTAMINATED' || args.echoSignal) {
    extras.push('echo-glass-shard');
  }
  if (args.templateId === 'RESOURCE_GUARD' || args.highValue) {
    extras.push('ley-slag');
  }
  if (args.templateId === 'HIGH_RISK_CARGO_GUARD' && (args.tier === 'RARE' || args.tier === 'APEX_CHANCE')) {
    if (args.tier === 'APEX_CHANCE') {
      extras.push('anomalous-core');
    } else {
      extras.push('smugglers-ledger');
    }
  }
  if (args.anchorSignal && (args.tier === 'HIGH_VALUE' || args.tier === 'RARE' || args.tier === 'APEX_CHANCE')) {
    extras.push(biomePool[1] ?? 'ley-slag');
  }

  const commonBonus = compositionCommonMaterialBonusCount(args.tier, args.templateId);
  for (let i = 0; i < commonBonus; i += 1) {
    extras.push(i % 2 === 0 ? 'ley-slag' : 'echo-glass-shard');
  }

  return extras;
}

export function formatCompositionRewardPayoutLog(
  tier: EncounterRewardTier | null | undefined,
  creditReward: number,
): string | null {
  if (!tier || tier === 'BASELINE') return null;
  return `>> REWARD TIER ${tier.replace(/_/g, ' ')} — credits adjusted (${creditReward} CR).`;
}
