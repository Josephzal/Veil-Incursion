import type { ResourceItemId } from './resourceItem';

/** Unstable resources with v1 carried effects — one effect per unique item type. */
export type UnstableCargoEffectId =
  | 'anomalous-core'
  | 'veil-ash-canister'
  | 'ossified-ley-knot';

export const UNSTABLE_CARRIED_EFFECT_IDS: readonly UnstableCargoEffectId[] = [
  'anomalous-core',
  'veil-ash-canister',
  'ossified-ley-knot',
];

export type CarriedEffectDisplayKind = 'upside' | 'downside';

export interface CarriedEffectDisplayLine {
  kind: CarriedEffectDisplayKind;
  text: string;
}

export interface UnstableCarriedEffectModifiers {
  rareLootBonusPct?: number;
  occultRewardBonusPct?: number;
  healReceivedMultiplier?: number;
  /** Reserved for Phase 2+ scanner lazy rolls. */
  eliteWeightDelta?: number;
  anchorSignalMultiplier?: number;
  anomalyWeightDelta?: number;
}

export interface UnstableCarriedEffectDefinition {
  resourceId: UnstableCargoEffectId;
  itemName: string;
  warningText: string;
  displayLines: readonly CarriedEffectDisplayLine[];
  modifiers: UnstableCarriedEffectModifiers;
}

export interface AggregatedCarriedCargoModifiers {
  rareLootBonusPct: number;
  occultRewardBonusPct: number;
  healReceivedMultiplier: number;
  eliteWeightDelta: number;
  anchorSignalMultiplier: number;
  anomalyWeightDelta: number;
}

/** Scanner context-roll bias from carried unstable cargo (Phase 2 lazy rolls). */
export interface CarriedCargoContextRollBias {
  anchorSignalChanceMultiplier: number;
  highValueResourceChanceMultiplier: number;
  highRiskRollBonus: number;
  occultRewardChanceBonus: number;
}

export interface ActiveCarriedCargoSnapshot {
  activeEffects: readonly UnstableCarriedEffectDefinition[];
  aggregated: AggregatedCarriedCargoModifiers;
}

export function isUnstableCargoEffectId(
  resourceId: ResourceItemId,
): resourceId is UnstableCargoEffectId {
  return (UNSTABLE_CARRIED_EFFECT_IDS as readonly string[]).includes(resourceId);
}
