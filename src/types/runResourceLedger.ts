import type { CargoItemId } from './cargoGrid';
import type { ResourceItemId, ResourceQuantity } from './resourceItem';

/** Physical cargo secured at an in-run safehouse — survives later death within the same run. */
export interface RunPhysicalBankSnapshot {
  resources: ResourceQuantity;
  consumables: Partial<Record<CargoItemId, number>>;
}

/** Per-run resource accounting for debrief and contract resolution. */
export interface RunResourceLedger {
  /** Resources picked up during the run (unbanked + banked + lost + extracted). */
  collected: ResourceQuantity;
  /** Resources moved to safehouse bank during the run. */
  bankedAtSafehouse: ResourceQuantity;
  /** Resources deposited to hub stash on successful extraction. */
  extracted: ResourceQuantity;
  /** Unbanked resources lost on death. */
  lostOnDeath: ResourceQuantity;
  /** Resources destroyed or spent during the run (bench, bleed, etc.). */
  consumed: ResourceQuantity;
  /** Physical cargo bank actions at in-run safehouse (Extraction Surge contribution). */
  safehouseBankActions: number;
}

export function createEmptyRunPhysicalBankSnapshot(): RunPhysicalBankSnapshot {
  return { resources: {}, consumables: {} };
}

export function createEmptyRunResourceLedger(): RunResourceLedger {
  return {
    collected: {},
    bankedAtSafehouse: {},
    extracted: {},
    lostOnDeath: {},
    consumed: {},
    safehouseBankActions: 0,
  };
}
