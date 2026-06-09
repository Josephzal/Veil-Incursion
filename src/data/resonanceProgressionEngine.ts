import { getCargoResonanceMultiplier } from './cargoGridEngine';
import { getZoneResonanceBase } from './sectorZoneEngine';
import {
  HARVEST_RESONANCE_SPIKE_COMMON,
  HARVEST_RESONANCE_SPIKE_RARE,
  VOLATILE_CARGO_RESONANCE_PER_ITEM,
} from '../types/sectorPacing';
import type { CargoRunState, HarvestYieldTier } from '../types/cargoGrid';
import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import { applyResonanceDelta } from './sectorGraphEngine';
import { COLLAPSE_RESONANCE_SOFT_CAP } from '../types/sectorPacing';

export interface NodeResonanceTickResult {
  nextPercent: number;
  zoneBase: number;
  volatileBonus: number;
  cargoMultiplier: number;
  appliedGain: number;
  logLine: string;
}

export function countVolatileCargoItems(cargo: CargoRunState): number {
  let count = 0;
  const tally = (itemId: string) => {
    const tags = CARGO_ITEM_CATALOG[itemId as keyof typeof CARGO_ITEM_CATALOG]?.tags ?? [];
    if (tags.includes('VOLATILE')) count += 1;
  };
  cargo.grid.placed.forEach((item) => tally(item.itemId));
  cargo.containment.forEach((item) => tally(item.itemId));
  return count;
}

export function computeCargoOccupancyMultiplier(cargo: CargoRunState): number {
  return getCargoResonanceMultiplier(cargo);
}

export function computeNodeProgressionGain(
  nodesCleared: number,
  cargo: CargoRunState,
  collapseActive = false,
): Omit<NodeResonanceTickResult, 'nextPercent' | 'logLine' | 'appliedGain'> & { rawGain: number } {
  const zoneBase = getZoneResonanceBase(nodesCleared, collapseActive);
  const volatileBonus = countVolatileCargoItems(cargo) * VOLATILE_CARGO_RESONANCE_PER_ITEM;
  const cargoMultiplier = computeCargoOccupancyMultiplier(cargo);
  const rawGain = (zoneBase + volatileBonus) * cargoMultiplier;
  return { zoneBase, volatileBonus, cargoMultiplier, rawGain };
}

export function applyNodeProgressionResonance(
  currentPercent: number,
  nodesCleared: number,
  cargo: CargoRunState,
  collapseActive = false,
  extraMultiplier = 1,
): NodeResonanceTickResult {
  const { zoneBase, volatileBonus, cargoMultiplier, rawGain } = computeNodeProgressionGain(
    nodesCleared,
    cargo,
    collapseActive,
  );
  const appliedGain = Math.round(rawGain * extraMultiplier * 10) / 10;
  const nextPercent = applyResonanceDelta(
    currentPercent,
    appliedGain,
    1,
    collapseActive,
    collapseActive ? COLLAPSE_RESONANCE_SOFT_CAP : 100,
  );
  const logLine = `>> RESONANCE +${appliedGain}% — ZONE BASE ${zoneBase}%`
    + (volatileBonus > 0 ? ` // VOLATILE +${volatileBonus}%` : '')
    + ` // CARGO ×${cargoMultiplier.toFixed(2)}`;
  return {
    nextPercent,
    zoneBase,
    volatileBonus,
    cargoMultiplier,
    appliedGain,
    logLine,
  };
}

export function harvestResonanceSpikeForTier(tier: HarvestYieldTier): number {
  switch (tier) {
    case 'QUICK':
      return HARVEST_RESONANCE_SPIKE_COMMON;
    case 'FULL':
    case 'DEEP_GORE':
      return HARVEST_RESONANCE_SPIKE_RARE;
    default:
      return HARVEST_RESONANCE_SPIKE_COMMON;
  }
}

export function applyResonanceAdjustment(
  currentPercent: number,
  amount: number,
  collapseActive = false,
): number {
  return applyResonanceDelta(
    currentPercent,
    amount,
    1,
    collapseActive,
    collapseActive ? COLLAPSE_RESONANCE_SOFT_CAP : 100,
  );
}
