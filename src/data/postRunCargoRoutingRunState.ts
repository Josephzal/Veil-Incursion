import type { ActiveRunContract } from '../types/contract';
import type { CargoRunState } from '../types/cargoGrid';
import type { ActiveIncursionState } from '../types/game';
import type { CargoRoutingContext } from '../types/postRunCargoRouting';
import type { CargoRoutingResult } from '../types/postRunCargoRouting';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { RunGenerationContext } from '../types/worldState';
import type { RunPhysicalBankSnapshot, RunResourceLedger } from '../types/runResourceLedger';
import { formatMidRunBribeFlavorMessage } from './bribeOfferEngine';
import {
  buildCargoRoutingContext,
  isContractTargetResource,
  isOperationTargetResource,
  requiresPostRunRouting,
} from './postRunCargoRoutingEngine';
import {
  countResourcesInCargo,
  mergeResourceQuantities,
  recordNewResourcesFromCargoDelta,
} from './runResourceLedgerEngine';
import { createEmptyRunPhysicalBankSnapshot } from '../types/runResourceLedger';
import {
  cargoHasUnstableOrContraband,
  ensureEconomyRunTelemetry,
  noteUnstableCargoPresent,
  recordEconomyGenerated,
} from './economyRunTelemetryEngine';

export interface CargoRoutingRunState {
  specialCargoStacksAcquired: number;
  contractTargetStacksAcquired: number;
  operationTargetStacksAcquired: number;
  specialCargoStacksBanked: number;
  pendingRoutingStacksAtExtract: number;
}

export interface CareerCargoRoutingStats {
  deliveredToSponsor: number;
  deliveredToRival: number;
  fencedAtDebrief: number;
  contributedToOperation: number;
  casketsOpened: number;
  keptInStash: number;
  contractsBetrayed: number;
}

export function createDefaultCargoRoutingRunState(): CargoRoutingRunState {
  return {
    specialCargoStacksAcquired: 0,
    contractTargetStacksAcquired: 0,
    operationTargetStacksAcquired: 0,
    specialCargoStacksBanked: 0,
    pendingRoutingStacksAtExtract: 0,
  };
}

export function createDefaultCareerCargoRoutingStats(): CareerCargoRoutingStats {
  return {
    deliveredToSponsor: 0,
    deliveredToRival: 0,
    fencedAtDebrief: 0,
    contributedToOperation: 0,
    casketsOpened: 0,
    keptInStash: 0,
    contractsBetrayed: 0,
  };
}

export function mergeCargoRoutingRunState(
  state: CargoRoutingRunState | undefined,
  patch: Partial<CargoRoutingRunState>,
): CargoRoutingRunState {
  return { ...(state ?? createDefaultCargoRoutingRunState()), ...patch };
}

function sumResourceQuantityMap(map: Partial<Record<ResourceItemId, number>>): number {
  return Object.values(map).reduce((sum, quantity) => sum + (quantity ?? 0), 0);
}

export function recordCargoRoutingResourcesCollected(
  state: CargoRoutingRunState | undefined,
  resources: ResourceQuantity,
  contract: ActiveRunContract | null,
  ctx: CargoRoutingContext,
): CargoRoutingRunState {
  let next = state ?? createDefaultCargoRoutingRunState();

  (Object.entries(resources) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      const qty = quantity ?? 0;
      if (qty <= 0) return;
      if (!requiresPostRunRouting(resourceId, qty, ctx)) return;

      next = {
        ...next,
        specialCargoStacksAcquired: next.specialCargoStacksAcquired + qty,
      };
      if (isContractTargetResource(resourceId, contract)) {
        next = {
          ...next,
          contractTargetStacksAcquired: next.contractTargetStacksAcquired + qty,
        };
      }
      if (isOperationTargetResource(resourceId, ctx)) {
        next = {
          ...next,
          operationTargetStacksAcquired: next.operationTargetStacksAcquired + qty,
        };
      }
    },
  );

  return next;
}

export function recordCargoRoutingResourcesBanked(
  state: CargoRoutingRunState | undefined,
  resources: ResourceQuantity,
  contract: ActiveRunContract | null,
  ctx: CargoRoutingContext,
): CargoRoutingRunState {
  let next = state ?? createDefaultCargoRoutingRunState();

  (Object.entries(resources) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      const qty = quantity ?? 0;
      if (qty <= 0) return;
      if (!requiresPostRunRouting(resourceId, qty, ctx)) return;
      next = {
        ...next,
        specialCargoStacksBanked: next.specialCargoStacksBanked + qty,
      };
    },
  );

  return next;
}

export function recordPendingRoutingAtExtract(
  state: CargoRoutingRunState | undefined,
  pendingStackCount: number,
): CargoRoutingRunState {
  return mergeCargoRoutingRunState(state, {
    pendingRoutingStacksAtExtract: Math.max(0, pendingStackCount),
  });
}

export function resolveCargoRoutingContextFromIncursion(
  incursion: Pick<ActiveIncursionState, 'activeContract' | 'runGenerationContext'>,
): CargoRoutingContext | null {
  const context = incursion.runGenerationContext;
  if (!context) return null;
  return buildCargoRoutingContext(
    incursion.activeContract,
    context.activeOperation.objectiveKind,
    context.activeOperation.rewardEmphasis.targetResources,
  );
}

export function applyCargoCollectedLedgerDelta(
  incursion: Pick<
    ActiveIncursionState,
    | 'runResourceLedger'
    | 'cargoRoutingRunState'
    | 'activeContract'
    | 'runGenerationContext'
    | 'economyRunTelemetry'
  >,
  beforeCargo: CargoRunState,
  afterCargo: CargoRunState,
): Pick<ActiveIncursionState, 'runResourceLedger' | 'cargoRoutingRunState' | 'economyRunTelemetry'> {
  const ledger = recordNewResourcesFromCargoDelta(
    incursion.runResourceLedger,
    beforeCargo,
    afterCargo,
  );

  const beforeCounts = countResourcesInCargo(beforeCargo);
  const afterCounts = countResourcesInCargo(afterCargo);
  const delta: ResourceQuantity = {};
  let generated = 0;
  const allIds = new Set([
    ...Object.keys(beforeCounts),
    ...Object.keys(afterCounts),
  ]) as Set<ResourceItemId>;

  allIds.forEach((resourceId) => {
    const diff = (afterCounts[resourceId] ?? 0) - (beforeCounts[resourceId] ?? 0);
    if (diff > 0) {
      delta[resourceId] = diff;
      generated += diff;
    }
  });

  let economy = ensureEconomyRunTelemetry(incursion.economyRunTelemetry);
  if (generated > 0) {
    economy = recordEconomyGenerated(economy, generated);
  }
  if (cargoHasUnstableOrContraband(afterCargo)) {
    economy = noteUnstableCargoPresent(economy);
  }

  const routingContext = resolveCargoRoutingContextFromIncursion(incursion);
  if (!routingContext) {
    return {
      runResourceLedger: ledger,
      cargoRoutingRunState: incursion.cargoRoutingRunState,
      economyRunTelemetry: economy,
    };
  }

  return {
    runResourceLedger: ledger,
    cargoRoutingRunState: recordCargoRoutingResourcesCollected(
      incursion.cargoRoutingRunState,
      delta,
      incursion.activeContract,
      routingContext,
    ),
    economyRunTelemetry: economy,
  };
}

export function countSpecialCargoHeldInRun(
  cargo: CargoRunState,
  bank: RunPhysicalBankSnapshot,
  contract: ActiveRunContract | null,
  ctx: CargoRoutingContext,
): number {
  const held = mergeResourceQuantities(
    countResourcesInCargo(cargo),
    bank.resources,
  );
  return sumResourceQuantityMap(
    Object.fromEntries(
      (Object.entries(held) as Array<[ResourceItemId, number | undefined]>).filter(
        ([resourceId, quantity]) => requiresPostRunRouting(resourceId, quantity ?? 0, ctx),
      ),
    ) as Partial<Record<ResourceItemId, number>>,
  );
}

export function resolveSpecialCargoStacksForIncursion(
  incursion: Pick<
    ActiveIncursionState,
    'cargo' | 'runBankedSnapshot' | 'activeContract' | 'runGenerationContext'
  >,
): number {
  const ctx = resolveCargoRoutingContextFromIncursion(incursion);
  if (!ctx) return 0;
  return countSpecialCargoHeldInRun(
    incursion.cargo,
    incursion.runBankedSnapshot,
    incursion.activeContract,
    ctx,
  );
}

export function countSpecialCargoInPreRunCargo(
  cargo: CargoRunState,
  contract: ActiveRunContract | null,
  runGenerationContext: RunGenerationContext | null,
): number {
  const ctx = runGenerationContext
    ? buildCargoRoutingContext(
      contract,
      runGenerationContext.activeOperation.objectiveKind,
      runGenerationContext.activeOperation.rewardEmphasis.targetResources,
    )
    : buildCargoRoutingContext(contract, null, undefined);
  return countSpecialCargoHeldInRun(
    cargo,
    createEmptyRunPhysicalBankSnapshot(),
    contract,
    ctx,
  );
}

export function formatCareerCargoRoutingSummary(stats: CareerCargoRoutingStats): string {
  return [
    `Delivered to sponsor: ${stats.deliveredToSponsor}`,
    `Delivered to rival: ${stats.deliveredToRival}`,
    `Fenced at debrief: ${stats.fencedAtDebrief}`,
    `Contributed to operation: ${stats.contributedToOperation}`,
    `Caskets opened: ${stats.casketsOpened}`,
    `Kept in stash: ${stats.keptInStash}`,
    `Contracts betrayed: ${stats.contractsBetrayed}`,
  ].join(' // ');
}

export function formatCareerCargoRoutingDebugSnapshot(stats: CareerCargoRoutingStats): string {
  return ['CAREER CARGO ROUTING', formatCareerCargoRoutingSummary(stats)].join('\n');
}

export function incrementCareerCargoRoutingFromResult(
  stats: CareerCargoRoutingStats | undefined,
  result: CargoRoutingResult,
  contractBetrayed = false,
): CareerCargoRoutingStats {
  const base = stats ?? createDefaultCareerCargoRoutingStats();
  const rivalTotal = Object.values(result.deliveredToRival).reduce(
    (sum, bucket) => sum + Object.values(bucket ?? {}).reduce((inner, qty) => inner + (qty ?? 0), 0),
    0,
  );
  return {
    deliveredToSponsor: base.deliveredToSponsor + sumResourceQuantityMap(result.delivered),
    deliveredToRival: base.deliveredToRival + rivalTotal,
    fencedAtDebrief: base.fencedAtDebrief + sumResourceQuantityMap(result.fenced),
    contributedToOperation: base.contributedToOperation + sumResourceQuantityMap(result.contributed),
    casketsOpened: base.casketsOpened + sumResourceQuantityMap(result.opened),
    keptInStash: base.keptInStash + sumResourceQuantityMap(result.kept),
    contractsBetrayed: base.contractsBetrayed + (contractBetrayed ? 1 : 0),
  };
}

export function collectMidRunBribeFlavorMessages(
  resources: ResourceQuantity,
  contract: ActiveRunContract | null,
): string[] {
  const messages: string[] = [];
  (Object.entries(resources) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      if (!isContractTargetResource(resourceId, contract)) return;
      const line = formatMidRunBribeFlavorMessage(resourceId);
      if (line) messages.push(line);
    },
  );
  return [...new Set(messages)];
}

export function formatCargoRoutingRunStateSnapshot(
  state: CargoRoutingRunState | undefined,
): string {
  const cargo = state ?? createDefaultCargoRoutingRunState();
  return [
    'CARGO ROUTING RUN STATE',
    `special acquired: ${cargo.specialCargoStacksAcquired}`,
    `contract targets acquired: ${cargo.contractTargetStacksAcquired}`,
    `operation targets acquired: ${cargo.operationTargetStacksAcquired}`,
    `special banked: ${cargo.specialCargoStacksBanked}`,
    `pending at extract: ${cargo.pendingRoutingStacksAtExtract}`,
  ].join('\n');
}
