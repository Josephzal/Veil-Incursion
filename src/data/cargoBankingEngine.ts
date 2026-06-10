import {
  calculateCargoMarketValue,
} from './cargoGridEngine';
import type { CargoRunState, GlobalBankedCargo } from '../types/cargoGrid';
import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';

function containmentItemValue(item: { itemId: string; currentValue?: number }): number {
  return item.currentValue ?? CARGO_ITEM_CATALOG[item.itemId as keyof typeof CARGO_ITEM_CATALOG]?.baseValue ?? 0;
}

/** Transfers a percentage of run cargo market value into the persistent bank vault. */
export function transferRunCargoToBank(
  cargo: CargoRunState,
  banked: GlobalBankedCargo,
  percent: number,
): { cargo: CargoRunState; banked: GlobalBankedCargo; transferredValue: number } | null {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  if (clamped === 0) return null;

  const totalValue = calculateCargoMarketValue(cargo);
  if (totalValue <= 0) return null;

  const targetTransfer = Math.floor(totalValue * (clamped / 100));
  if (targetTransfer <= 0) return null;

  let remaining = targetTransfer;

  const nextContainment = [...cargo.containment];
  for (let i = 0; i < nextContainment.length && remaining > 0; i += 1) {
    const item = nextContainment[i];
    const value = containmentItemValue(item);
    if (value <= remaining) {
      remaining -= value;
      nextContainment.splice(i, 1);
      i -= 1;
    } else {
      const nextValue = value - remaining;
      remaining = 0;
      nextContainment[i] = { ...item, currentValue: nextValue };
    }
  }

  const nextPlaced = cargo.grid.placed.map((item) => ({ ...item }));
  for (let i = 0; i < nextPlaced.length && remaining > 0; i += 1) {
    const item = nextPlaced[i];
    if (item.currentValue <= remaining) {
      remaining -= item.currentValue;
      nextPlaced.splice(i, 1);
      i -= 1;
    } else {
      const nextValue = item.currentValue - remaining;
      remaining = 0;
      nextPlaced[i] = { ...item, currentValue: nextValue };
    }
  }

  return {
    cargo: {
      ...cargo,
      grid: { placed: nextPlaced },
      containment: nextContainment,
    },
    banked: {
      totalValue: banked.totalValue + targetTransfer,
      lastTransferValue: targetTransfer,
    },
    transferredValue: targetTransfer,
  };
}

/** Bench action — spend cargo value to restore a fraction of max health. */
export function applyBenchHealthRestore(
  cargo: CargoRunState,
  cargoCostPct: number,
  currentHp: number,
  maxHp: number,
): { cargo: CargoRunState; nextHp: number; cargoSpent: number } | null {
  const totalValue = calculateCargoMarketValue(cargo);
  if (totalValue <= 0) return null;

  const transfer = transferRunCargoToBank(cargo, { totalValue: 0, lastTransferValue: 0 }, cargoCostPct);
  if (!transfer) return null;

  const restoreAmount = Math.floor(maxHp * 0.25);
  const nextHp = Math.min(maxHp, currentHp + restoreAmount);

  return {
    cargo: transfer.cargo,
    nextHp,
    cargoSpent: transfer.transferredValue,
  };
}
