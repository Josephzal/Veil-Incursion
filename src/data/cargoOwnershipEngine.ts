import type { CargoItemId, CargoRunState } from '../types/cargoGrid';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { RunPhysicalBankSnapshot, RunResourceLedger } from '../types/runResourceLedger';
import { cargoItemQuantity } from './cargoStackEngine';
import {
  canResourceBeBankedAtSafehouse,
  getResourceDisplayName,
  isResourceItemId,
  RESOURCE_REGISTRY,
} from './resourceRegistry';
import {
  bankAllPhysicalRunCargo,
  bankSingleCargoInstance,
  countResourcesInCargo,
  mergeBankSnapshotIntoCargo,
  recordResourcesBanked,
  recordResourcesExtracted,
  recordResourcesLostOnDeath,
  resolveRunDeathResourceState,
  resolveRunExtractionResourceState,
} from './runResourceLedgerEngine';

/**
 * Phase 2B.1 — ownership states for extracted economy clarity.
 *
 * CARRIED  — physical run cargo (grid / containment). Lost on death if unbanked.
 * BANKED   — mid-run safehouse snapshot. Survives death. Not yet hub stash.
 * EXTRACTED — converted to hub stash after successful extraction.
 * LOST     — carried cargo dropped on death (unbanked).
 */
export type CargoOwnershipState = 'CARRIED' | 'BANKED' | 'EXTRACTED' | 'LOST';

export const CARGO_OWNERSHIP_RULES_COPY = {
  CARRIED: 'In your pack now. Lost on death unless banked or extracted.',
  BANKED: 'Secured at the safehouse vault this run. Survives death.',
  EXTRACTED: 'Converted to hub stash after a successful extract.',
  LOST: 'Dropped on death — was still carried and unbanked.',
} as const;

export function ownershipLabel(state: CargoOwnershipState): string {
  switch (state) {
    case 'CARRIED':
      return 'CARRIED';
    case 'BANKED':
      return 'BANKED (RUN)';
    case 'EXTRACTED':
      return 'EXTRACTED';
    case 'LOST':
      return 'LOST';
    default:
      return state;
  }
}

export function canBankCargoItemId(itemId: CargoItemId): boolean {
  if (!isResourceItemId(itemId)) return true;
  return canResourceBeBankedAtSafehouse(itemId);
}

export function listNonBankableResourcesInCargo(cargo: CargoRunState): ResourceItemId[] {
  const blocked = new Set<ResourceItemId>();
  [...cargo.grid.placed, ...cargo.containment].forEach((item) => {
    if (!isResourceItemId(item.itemId)) return;
    if (!canResourceBeBankedAtSafehouse(item.itemId)) {
      blocked.add(item.itemId);
    }
  });
  return [...blocked];
}

/** Split cargo into bankable vs must-extract (apex / blocked) stacks. */
export function partitionCargoForSafehouseBank(cargo: CargoRunState): {
  bankable: CargoRunState;
  blocked: CargoRunState;
  blockedResourceIds: ResourceItemId[];
} {
  const bankablePlaced = cargo.grid.placed.filter((item) => canBankCargoItemId(item.itemId));
  const blockedPlaced = cargo.grid.placed.filter((item) => !canBankCargoItemId(item.itemId));
  const bankableContainment = cargo.containment.filter((item) => canBankCargoItemId(item.itemId));
  const blockedContainment = cargo.containment.filter((item) => !canBankCargoItemId(item.itemId));
  const blockedResourceIds = listNonBankableResourcesInCargo(cargo);

  return {
    bankable: {
      ...cargo,
      grid: { placed: bankablePlaced },
      containment: bankableContainment,
    },
    blocked: {
      ...cargo,
      grid: { placed: blockedPlaced },
      containment: blockedContainment,
    },
    blockedResourceIds,
  };
}

export interface SafehouseBankResult {
  cargo: CargoRunState;
  bank: RunPhysicalBankSnapshot;
  bankedResources: ResourceQuantity;
  bankedConsumables: Partial<Record<CargoItemId, number>>;
  blockedResourceIds: ResourceItemId[];
  blockedUnitCount: number;
}

/**
 * Banks only safehouse-eligible cargo. Apex / non-bankable stacks stay carried
 * so the player must extract them (greed check).
 */
export function bankEligiblePhysicalRunCargo(
  cargo: CargoRunState,
  bank: RunPhysicalBankSnapshot,
): SafehouseBankResult {
  const { bankable, blocked, blockedResourceIds } = partitionCargoForSafehouseBank(cargo);
  const result = bankAllPhysicalRunCargo(bankable, bank);
  const blockedUnitCount = [...blocked.grid.placed, ...blocked.containment]
    .reduce((sum, item) => sum + cargoItemQuantity(item), 0);

  return {
    cargo: {
      ...result.cargo,
      grid: { placed: [...result.cargo.grid.placed, ...blocked.grid.placed] },
      containment: [...result.cargo.containment, ...blocked.containment],
      dataBleedActive: cargo.dataBleedActive,
      outsideHook: cargo.outsideHook,
    },
    bank: result.bank,
    bankedResources: result.bankedResources,
    bankedConsumables: result.bankedConsumables,
    blockedResourceIds,
    blockedUnitCount,
  };
}

export function bankSingleEligibleCargoInstance(
  cargo: CargoRunState,
  bank: RunPhysicalBankSnapshot,
  instanceId: string,
): SafehouseBankResult | { ok: false; reason: string } {
  const placed = cargo.grid.placed.find((item) => item.instanceId === instanceId);
  const contained = cargo.containment.find((item) => item.instanceId === instanceId);
  const item = placed ?? contained;
  if (!item) return { ok: false, reason: 'Cargo instance not found.' };
  if (!canBankCargoItemId(item.itemId)) {
    const name = isResourceItemId(item.itemId)
      ? getResourceDisplayName(item.itemId, true)
      : item.itemId;
    return {
      ok: false,
      reason: `${name.toUpperCase()} cannot be banked mid-run — extract it.`,
    };
  }

  const single = bankSingleCargoInstance(cargo, bank, instanceId);
  if (!single) return { ok: false, reason: 'Bank transfer failed.' };

  return {
    cargo: single.cargo,
    bank: single.bank,
    bankedResources: single.bankedResources,
    bankedConsumables: {},
    blockedResourceIds: [],
    blockedUnitCount: 0,
  };
}

export function formatSafehouseBankLog(result: SafehouseBankResult): string {
  const bankedUnits = Object.values(result.bankedResources).reduce((s, q) => s + (q ?? 0), 0)
    + Object.values(result.bankedConsumables).reduce((s, q) => s + (q ?? 0), 0);
  if (bankedUnits <= 0 && result.blockedUnitCount > 0) {
    const names = result.blockedResourceIds
      .map((id) => getResourceDisplayName(id, true).toUpperCase())
      .join(', ');
    return `>> CARGO BANK BLOCKED — ${names || 'APEX CARGO'} must be extracted (cannot mid-run bank).`;
  }
  const blockedNote = result.blockedUnitCount > 0
    ? ` // ${result.blockedUnitCount} APEX UNIT(S) STILL CARRIED — EXTRACT TO KEEP.`
    : ' SURVIVES DEATH IF NOT RE-LOOTED.';
  return `>> CARGO BANKED AT SAFEHOUSE — ${bankedUnits} UNIT(S) SECURED.${blockedNote}`;
}

export function formatCargoOwnershipBrief(input: {
  carried: ResourceQuantity;
  banked: ResourceQuantity;
  extracted?: ResourceQuantity;
  lost?: ResourceQuantity;
}): string {
  const sum = (q: ResourceQuantity) => Object.values(q).reduce((s, n) => s + (n ?? 0), 0);
  const lines = [
    '=== CARGO OWNERSHIP // PHASE 2B.1 ===',
    `CARRIED: ${sum(input.carried)} — ${CARGO_OWNERSHIP_RULES_COPY.CARRIED}`,
    `BANKED: ${sum(input.banked)} — ${CARGO_OWNERSHIP_RULES_COPY.BANKED}`,
  ];
  if (input.extracted) {
    lines.push(`EXTRACTED: ${sum(input.extracted)} — ${CARGO_OWNERSHIP_RULES_COPY.EXTRACTED}`);
  }
  if (input.lost) {
    lines.push(`LOST: ${sum(input.lost)} — ${CARGO_OWNERSHIP_RULES_COPY.LOST}`);
  }
  lines.push('');
  lines.push('Safe extract: carried + banked → hub stash.');
  lines.push('Death: banked → hub stash; carried → lost.');
  lines.push('Apex cargo (Anomalous Core, Sealed Casket): cannot mid-run bank — extract or lose.');
  return lines.join('\n');
}

export function describeExtractionConversion(input: {
  cargo: CargoRunState;
  bank: RunPhysicalBankSnapshot;
  ledger: RunResourceLedger;
  outcome: 'SAFE_EXTRACT' | 'DIRTY_EXTRACT_SUCCESS' | 'DEATH';
}): string {
  if (input.outcome === 'DEATH') {
    const death = resolveRunDeathResourceState(input.cargo, input.bank, input.ledger);
    return formatCargoOwnershipBrief({
      carried: countResourcesInCargo(input.cargo),
      banked: death.bankedResources,
      lost: death.lostResources,
    });
  }
  const extract = resolveRunExtractionResourceState(input.cargo, input.bank, input.ledger);
  return formatCargoOwnershipBrief({
    carried: countResourcesInCargo(input.cargo),
    banked: { ...input.bank.resources },
    extracted: extract.extractedResources,
  });
}

/** Dev / validation — non-bankable apex roster. */
export function listApexNonBankableResourceIds(): ResourceItemId[] {
  return (Object.keys(RESOURCE_REGISTRY) as ResourceItemId[]).filter(
    (id) => !RESOURCE_REGISTRY[id].canBeBankedAtSafehouse
      && (RESOURCE_REGISTRY[id].primaryRole === 'APEX_CARGO' || id === 'sealed-containment-casket'),
  );
}

// Re-export helpers used by ownership brief consumers.
export {
  countResourcesInCargo,
  mergeBankSnapshotIntoCargo,
  recordResourcesBanked,
  recordResourcesExtracted,
  recordResourcesLostOnDeath,
};
