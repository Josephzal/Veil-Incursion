import type { CargoRunState } from '../types/cargoGrid';
import type { ResourceItemId } from '../types/resourceItem';
import {
  type ActiveCarriedCargoSnapshot,
  type AggregatedCarriedCargoModifiers,
  type CarriedCargoContextRollBias,
  type CarriedEffectDisplayKind,
  type UnstableCargoEffectId,
  type UnstableCarriedEffectDefinition,
  UNSTABLE_CARRIED_EFFECT_IDS,
} from '../types/unstableCargoEffects';
import { countCargoItemInstances } from './cargoGridEngine';
import { getResourceDisplayName } from './resourceRegistry';

const DEFAULT_AGGREGATED: AggregatedCarriedCargoModifiers = {
  rareLootBonusPct: 0,
  occultRewardBonusPct: 0,
  healReceivedMultiplier: 1,
  eliteWeightDelta: 0,
  anchorSignalMultiplier: 1,
  anomalyWeightDelta: 0,
};

export const UNSTABLE_CARRIED_EFFECTS: Record<
  UnstableCargoEffectId,
  UnstableCarriedEffectDefinition
> = {
  'anomalous-core': {
    resourceId: 'anomalous-core',
    itemName: 'Anomalous Core',
    warningText:
      'UNSTABLE CARGO — Anomalous Core is distorting the run: rare rewards and Anchor pressure increased.',
    displayLines: [
      { kind: 'upside', text: 'Rare rewards' },
      { kind: 'downside', text: 'Anchor pressure' },
    ],
    modifiers: {
      rareLootBonusPct: 10,
      eliteWeightDelta: 0.1,
      anchorSignalMultiplier: 1.1,
    },
  },
  'veil-ash-canister': {
    resourceId: 'veil-ash-canister',
    itemName: 'Veil-Ash Canister',
    warningText:
      'UNSTABLE CARGO — Veil-Ash Canister is leaking: anomaly pressure increased.',
    displayLines: [
      { kind: 'downside', text: 'Anomaly pressure' },
    ],
    modifiers: {
      anomalyWeightDelta: 0.1,
    },
  },
  'ossified-ley-knot': {
    resourceId: 'ossified-ley-knot',
    itemName: 'Ossified Ley-Knot',
    warningText:
      'UNSTABLE CARGO — Ossified Ley-Knot is feeding on you: healing reduced, occult rewards increased.',
    displayLines: [
      { kind: 'upside', text: 'Occult rewards' },
      { kind: 'downside', text: 'Healing received' },
    ],
    modifiers: {
      occultRewardBonusPct: 10,
      healReceivedMultiplier: 0.9,
    },
  },
};

export function getUnstableCarriedEffect(
  resourceId: UnstableCargoEffectId,
): UnstableCarriedEffectDefinition {
  return UNSTABLE_CARRIED_EFFECTS[resourceId];
}

/** Physical run cargo only — grid + containment (not safehouse bank snapshot). */
export function countPhysicalCargoResource(
  cargo: CargoRunState,
  resourceId: ResourceItemId,
): number {
  return countCargoItemInstances(cargo, resourceId);
}

function aggregateCarriedModifiers(
  effects: readonly UnstableCarriedEffectDefinition[],
): AggregatedCarriedCargoModifiers {
  if (effects.length === 0) return { ...DEFAULT_AGGREGATED };

  let rareLootBonusPct = 0;
  let occultRewardBonusPct = 0;
  let healReceivedMultiplier = 1;
  let eliteWeightDelta = 0;
  let anchorSignalMultiplier = 1;
  let anomalyWeightDelta = 0;

  effects.forEach((effect) => {
    const mods = effect.modifiers;
    if (mods.rareLootBonusPct != null) {
      rareLootBonusPct += mods.rareLootBonusPct;
    }
    if (mods.occultRewardBonusPct != null) {
      occultRewardBonusPct += mods.occultRewardBonusPct;
    }
    if (mods.healReceivedMultiplier != null) {
      healReceivedMultiplier *= mods.healReceivedMultiplier;
    }
    if (mods.eliteWeightDelta != null) {
      eliteWeightDelta += mods.eliteWeightDelta;
    }
    if (mods.anchorSignalMultiplier != null) {
      anchorSignalMultiplier *= mods.anchorSignalMultiplier;
    }
    if (mods.anomalyWeightDelta != null) {
      anomalyWeightDelta += mods.anomalyWeightDelta;
    }
  });

  return {
    rareLootBonusPct,
    occultRewardBonusPct,
    healReceivedMultiplier,
    eliteWeightDelta,
    anchorSignalMultiplier,
    anomalyWeightDelta,
  };
}

/** Each unique unstable cargo effect applies once — duplicate copies do not stack. */
export function buildActiveCarriedCargoSnapshot(
  cargo: CargoRunState,
): ActiveCarriedCargoSnapshot {
  const activeEffects = UNSTABLE_CARRIED_EFFECT_IDS
    .filter((resourceId) => countPhysicalCargoResource(cargo, resourceId) > 0)
    .map((resourceId) => UNSTABLE_CARRIED_EFFECTS[resourceId]);

  return {
    activeEffects,
    aggregated: aggregateCarriedModifiers(activeEffects),
  };
}

export function hasActiveCarriedCargoEffects(cargo: CargoRunState): boolean {
  return buildActiveCarriedCargoSnapshot(cargo).activeEffects.length > 0;
}

export function resolveEffectiveRareLootBonusPct(
  baseRareLootBonusPct: number,
  cargo: CargoRunState,
): number {
  return baseRareLootBonusPct
    + buildActiveCarriedCargoSnapshot(cargo).aggregated.rareLootBonusPct;
}

export function resolveEffectiveOccultRewardBonusPct(
  cargo: CargoRunState,
): number {
  return buildActiveCarriedCargoSnapshot(cargo).aggregated.occultRewardBonusPct;
}

export function resolveCargoHealReceivedMultiplier(cargo: CargoRunState): number {
  return buildActiveCarriedCargoSnapshot(cargo).aggregated.healReceivedMultiplier;
}

export function buildCarriedCargoContextRollBias(
  cargo: CargoRunState,
): CarriedCargoContextRollBias {
  const agg = buildActiveCarriedCargoSnapshot(cargo).aggregated;
  return {
    anchorSignalChanceMultiplier: agg.anchorSignalMultiplier,
    highValueResourceChanceMultiplier: 1 + agg.rareLootBonusPct / 100,
    highRiskRollBonus: agg.anomalyWeightDelta * 0.25,
    occultRewardChanceBonus: agg.occultRewardBonusPct / 100,
  };
}

/** Type-weight overlay for lazy scanner layer rolls (Phase 3). */
export interface CarriedCargoTypeWeightBias {
  eliteWeightDelta: number;
  anomalyWeightDelta: number;
}

export function buildCarriedCargoTypeWeightBias(
  cargo: CargoRunState,
): CarriedCargoTypeWeightBias {
  const agg = buildActiveCarriedCargoSnapshot(cargo).aggregated;
  return {
    eliteWeightDelta: agg.eliteWeightDelta,
    anomalyWeightDelta: agg.anomalyWeightDelta,
  };
}

export function applyCarriedCargoTypeWeightBias(
  weights: ReadonlyArray<{ type: import('../types/proceduralRunTree').ProceduralNodeType; weight: number }>,
  cargo: CargoRunState,
): { type: import('../types/proceduralRunTree').ProceduralNodeType; weight: number }[] {
  const bias = buildCarriedCargoTypeWeightBias(cargo);
  if (bias.eliteWeightDelta === 0 && bias.anomalyWeightDelta === 0) {
    return weights.map((entry) => ({ ...entry }));
  }
  return weights.map((entry) => {
    if (entry.type === 'ELITE' && bias.eliteWeightDelta > 0) {
      return { ...entry, weight: Math.max(1, Math.round(entry.weight * (1 + bias.eliteWeightDelta))) };
    }
    if (entry.type === 'ANOMALY' && bias.anomalyWeightDelta > 0) {
      return { ...entry, weight: Math.max(1, Math.round(entry.weight * (1 + bias.anomalyWeightDelta))) };
    }
    return { ...entry };
  });
}

export function formatLazyRollCargoPressureLog(
  modifiers: import('../types/worldState').NodeContextModifiers | undefined,
  cargo: CargoRunState,
): string | null {
  if (!modifiers || !hasActiveCarriedCargoEffects(cargo)) return null;
  const parts: string[] = [];
  if (modifiers.anchorSignal) parts.push('Anchor signal confirmed');
  if (modifiers.highRisk) parts.push('Hazard distortion elevated');
  if (modifiers.highValueResource) parts.push('High-value salvage signature');
  if (modifiers.echoSignal) parts.push('Echo trace detected');
  if (parts.length === 0) return null;
  return `>> CARGO PRESSURE — ${parts.join(' // ')}.`;
}

export function applyCargoHealReceived(
  baseHealAmount: number,
  cargo: CargoRunState,
  boonHealMultiplier = 1,
): number {
  if (baseHealAmount <= 0) return 0;
  const cargoMultiplier = resolveCargoHealReceivedMultiplier(cargo);
  return Math.floor(baseHealAmount * boonHealMultiplier * cargoMultiplier);
}

export function detectNewUnstableCargoPickups(
  before: CargoRunState,
  after: CargoRunState,
  alreadyLogged: readonly UnstableCargoEffectId[],
): UnstableCargoEffectId[] {
  const logged = new Set(alreadyLogged);
  return UNSTABLE_CARRIED_EFFECT_IDS.filter((resourceId) => {
    if (logged.has(resourceId)) return false;
    return countPhysicalCargoResource(before, resourceId) === 0
      && countPhysicalCargoResource(after, resourceId) > 0;
  });
}

export function formatUnstableCargoPickupLog(
  resourceId: UnstableCargoEffectId,
): string {
  return `>> ${UNSTABLE_CARRIED_EFFECTS[resourceId].warningText}`;
}

export function formatCarriedEffectDisplayPrefix(kind: CarriedEffectDisplayKind): string {
  return kind === 'upside' ? '+' : '−';
}

export function formatCarriedEffectItemLabel(resourceId: UnstableCargoEffectId): string {
  return getResourceDisplayName(resourceId, false);
}

/** Union of unstable carried-effect types physically present in cargo at any checkpoint. */
export function mergeUnstableCargoEffectsSeen(
  alreadySeen: readonly UnstableCargoEffectId[],
  cargo: CargoRunState,
): UnstableCargoEffectId[] {
  const seen = new Set(alreadySeen);
  UNSTABLE_CARRIED_EFFECT_IDS.forEach((resourceId) => {
    if (countPhysicalCargoResource(cargo, resourceId) > 0) {
      seen.add(resourceId);
    }
  });
  return UNSTABLE_CARRIED_EFFECT_IDS.filter((resourceId) => seen.has(resourceId));
}

export function hasVeilAshCanisterCarried(cargo: CargoRunState): boolean {
  return countPhysicalCargoResource(cargo, 'veil-ash-canister') > 0;
}

export function formatEmergencyRecallVeilAshWarning(): string {
  return '>> UNSTABLE CARGO — Veil-Ash Canister leak elevates emergency recall intercept hazard.';
}
