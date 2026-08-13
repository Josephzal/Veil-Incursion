import type { CargoItemId, CargoRunState } from '../types/cargoGrid';
import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import type { ActiveIncursionState } from '../types/game';
import type { RequisitionRuntime as KeepsakeRuntime } from '../types/expeditionRequisition';
import type { ProceduralRunTree } from '../types/proceduralRunTree';
import type { ResourceItemId } from '../types/resourceItem';
import {
  containmentItemValue,
} from './cargoGridEngine';
import {
  formatKeepsakeLogLine,
  tryKeepsakeTrigger,
} from './expeditionKeepsakeEngine';
import { EXPEDITION_REQUISITION_REGISTRY } from './expeditionRequisitionRegistry';
import { patchKeepsakeStats } from './keepsakeRunState';
import { resolveBlackMarketListingPrice } from './blackMarket';
import { localProceduralDepth } from './proceduralScannerBridge';
import { getResourceCategory } from './resourceRegistry';
import { canBankCargoItemId } from './cargoOwnershipEngine';
import {
  bankSingleCargoInstance,
  recordResourcesBanked,
} from './runResourceLedgerEngine';
import {
  buildExtractionTokenChoice,
  canAccrueNullLedgerDebt,
  queueKeepsakePendingChoice,
} from './expeditionKeepsakeChoiceEngine';

/** Marked Shelf black-market discount — Phase D validates against trinket soft caps. */
export const MARKED_SHELF_DISCOUNT_PCT = 25;
const NULL_LEDGER_DEBT_SURCHARGE_PCT = 25;
const STAMPED_STABLE_CARGO_VALUE_BONUS_PCT = 10;
import { getGreedZoneActive } from './sectorGraphEngine';
import { MASTER_EXTRACTION_PAYOUT_MULTIPLIER } from '../types/sectorPacing';

export function computeBaseSectorExtractionPayout(inc: ActiveIncursionState): number {
  const pathBonus = inc.encounterPath.reduce(
    (sum, node) => sum + (node.sectorMeta?.creditBonus ?? 0),
    0,
  );
  let total = inc.runCredits + pathBonus + 150;
  if (inc.primeExtractionBonus) total = Math.floor(total * 1.5);
  if (inc.masterLinkUsed) {
    total = Math.floor(total * MASTER_EXTRACTION_PAYOUT_MULTIPLIER);
  }
  if (getGreedZoneActive(inc.nodesCleared)) total = Math.floor(total * 1.25);
  return total;
}

export interface KeepsakeEconomyApplyResult {
  runtime: KeepsakeRuntime | null;
  incursionPatch?: Partial<ActiveIncursionState>;
  logLines: string[];
  runCreditsDelta?: number;
}

function pickMarkedShelfItem(stock: readonly CargoItemId[]): CargoItemId | null {
  const rotating = stock.filter((id) => id !== 'soul-core');
  if (rotating.length > 0) {
    return rotating[Math.floor(Math.random() * rotating.length)] ?? null;
  }
  return stock[0] ?? null;
}

function pickCorruptionTarget(
  tree: ProceduralRunTree,
  nodesCleared: number,
): string | null {
  const currentDepth = localProceduralDepth(nodesCleared);
  const candidates = Object.values(tree.nodes).filter((node) => (
    node.depth > currentDepth
    && node.type !== 'GATEKEEPER'
    && node.type !== 'EXTRACTION'
    && !node.contextModifiers?.keepsakeMarkedCorruption
  ));
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
  return sorted[0]?.id ?? null;
}

export function isKeepsakeMarkedShelfItem(
  runtime: KeepsakeRuntime | null | undefined,
  itemId: CargoItemId,
): boolean {
  return runtime?.markedShelfItemId === itemId;
}

export function resolveKeepsakeMarkedShelfPrice(
  basePrice: number,
  itemId: CargoItemId,
  runtime: KeepsakeRuntime | null | undefined,
  discountPct: number,
): { price: number; markedDiscountApplied: boolean } {
  if (!isKeepsakeMarkedShelfItem(runtime, itemId)) {
    return {
      price: Math.max(1, Math.floor(basePrice * (1 - discountPct / 100))),
      markedDiscountApplied: false,
    };
  }
  const afterMarked = Math.floor(basePrice * (1 - MARKED_SHELF_DISCOUNT_PCT / 100));
  return {
    price: Math.max(1, Math.floor(afterMarked * (1 - discountPct / 100))),
    markedDiscountApplied: true,
  };
}

export function canUseKeepsakeNullLedgerCredit(
  runtime: KeepsakeRuntime | null | undefined,
  purchasePrice = 0,
): boolean {
  if (!runtime || runtime.requisitionId !== 'null_ledger') return false;
  if (runtime.triggersUsed.null_ledger_credit_purchase) return false;
  return canAccrueNullLedgerDebt(runtime, Math.ceil(purchasePrice * 1.25));
}

export function applyKeepsakeOnBlackMarketOpen(
  runtime: KeepsakeRuntime | null,
  stock: readonly CargoItemId[],
): KeepsakeEconomyApplyResult {
  if (!runtime || runtime.requisitionId !== 'black_market_mark') {
    return { runtime, logLines: [] };
  }
  if (runtime.markedShelfItemId) {
    return { runtime, logLines: [] };
  }

  const def = EXPEDITION_REQUISITION_REGISTRY.black_market_mark;
  const trigger = tryKeepsakeTrigger(runtime, def.primaryTriggerKey, 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, logLines: [] };
  }

  const markedItemId = pickMarkedShelfItem(stock);
  if (!markedItemId) {
    return { runtime: trigger.runtime, logLines: [] };
  }

  const nextRuntime: KeepsakeRuntime = {
    ...trigger.runtime,
    markedShelfItemId: markedItemId,
  };

  return {
    runtime: nextRuntime,
    logLines: [
      formatKeepsakeLogLine('Mark', def.triggerMessage),
      `>> MARKED SHELF — ${CARGO_ITEM_CATALOG[markedItemId].name} flagged at -${MARKED_SHELF_DISCOUNT_PCT}%.`,
    ],
  };
}

export function applyKeepsakeMarkedShelfCorruption(
  runtime: KeepsakeRuntime | null,
  tree: ProceduralRunTree | null | undefined,
  nodesCleared: number,
  purchasedMarkedItem: boolean,
): KeepsakeEconomyApplyResult {
  if (!runtime || !purchasedMarkedItem || !tree || runtime.markedShelfCorruptedNodeId) {
    return { runtime, logLines: [] };
  }

  const targetId = pickCorruptionTarget(tree, nodesCleared);
  if (!targetId) {
    return {
      runtime,
      logLines: ['>> MARKED SHELF FALLOUT — no future vector available for corruption.'],
    };
  }

  const node = tree.nodes[targetId];
  if (!node) return { runtime, logLines: [] };

  const nextTree: ProceduralRunTree = {
    ...tree,
    nodes: {
      ...tree.nodes,
      [targetId]: {
        ...node,
        contextModifiers: {
          ...(node.contextModifiers ?? {
            depthStage: 'THRESHOLD',
            nodePressureBand: 'MEDIUM',
          }),
          highRisk: true,
          highValueResource: true,
          keepsakeMarkedCorruption: true,
        },
      },
    },
  };

  return {
    runtime: patchKeepsakeStats(
      { ...runtime, markedShelfCorruptedNodeId: targetId },
      { nodeDetailsRevealed: runtime.stats.nodeDetailsRevealed + 1 },
    ),
    incursionPatch: { proceduralRunTree: nextTree },
    logLines: ['>> MARKED SHELF FALLOUT — future vector corrupted: HIGH RISK + HIGH VALUE.'],
  };
}

export function applyKeepsakeNullLedgerCreditPurchase(
  runtime: KeepsakeRuntime | null,
  itemId: CargoItemId,
  basePrice: number,
  discountPct: number,
): KeepsakeEconomyApplyResult {
  if (!canUseKeepsakeNullLedgerCredit(runtime)) {
    return { runtime, logLines: [] };
  }

  const def = EXPEDITION_REQUISITION_REGISTRY.null_ledger;
  const trigger = tryKeepsakeTrigger(runtime!, def.primaryTriggerKey, 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, logLines: [] };
  }

  const { price } = resolveKeepsakeMarkedShelfPrice(basePrice, itemId, trigger.runtime, discountPct);
  const debt = Math.ceil(price * (1 + NULL_LEDGER_DEBT_SURCHARGE_PCT / 100));

  return {
    runtime: patchKeepsakeStats(
      {
        ...trigger.runtime,
        nullLedgerDebtCredits: debt,
        nullLedgerCreditItemId: itemId,
      },
      { creditsDeferred: trigger.runtime.stats.creditsDeferred + price },
    ),
    logLines: [
      formatKeepsakeLogLine('Ledger', def.triggerMessage),
      `>> NULL LEDGER DEBT — ${debt} CR due on extraction (+${NULL_LEDGER_DEBT_SURCHARGE_PCT}% surcharge).`,
    ],
  };
}

export function resolveKeepsakeExtractionPayoutAdjustments(
  runtime: KeepsakeRuntime | null,
  cargo: CargoRunState,
  basePayout: number,
): { payout: number; runtime: KeepsakeRuntime | null; logLines: string[] } {
  const logLines: string[] = [];
  if (!runtime) return { payout: basePayout, runtime, logLines };

  let payout = basePayout;
  let nextRuntime = runtime;

  if (runtime.nullLedgerDebtCredits > 0) {
    const debt = runtime.nullLedgerDebtCredits;
    payout = Math.max(0, payout - debt);
    nextRuntime = patchKeepsakeStats(
      {
        ...nextRuntime,
        nullLedgerDebtCredits: 0,
      },
      { extractionDebtPaid: nextRuntime.stats.extractionDebtPaid + debt },
    );
    logLines.push(`>> NULL LEDGER SETTLED — -${debt} CR extraction debt collected.`);
  }

  if (runtime.stampedExtractionConfirmed) {
    const stableValue = sumStableCargoValue(cargo);
    const bonus = Math.floor(stableValue * (STAMPED_STABLE_CARGO_VALUE_BONUS_PCT / 100));
    if (bonus > 0) {
      payout += bonus;
      nextRuntime = patchKeepsakeStats(nextRuntime, {
        cargoValueBonus: nextRuntime.stats.cargoValueBonus + bonus,
      });
      logLines.push(`>> STAMPED EVAC BONUS — +${bonus} CR from stable cargo (+${STAMPED_STABLE_CARGO_VALUE_BONUS_PCT}%).`);
    }
  }

  return { payout, runtime: nextRuntime, logLines };
}

function sumStableCargoValue(cargo: CargoRunState): number {
  let total = 0;
  const tally = (itemId: string, value: number) => {
    if (getResourceCategory(itemId as ResourceItemId) === 'STABLE') {
      total += value;
    }
  };
  cargo.containment.forEach((item) => tally(item.itemId, containmentItemValue(item)));
  cargo.grid.placed.forEach((item) => tally(item.itemId, item.currentValue));
  return total;
}

export function applyKeepsakeOnExtractionNodeReveal(
  runtime: KeepsakeRuntime | null,
  tree: ProceduralRunTree,
  layerIds: readonly string[],
): KeepsakeEconomyApplyResult {
  if (!runtime || runtime.requisitionId !== 'extraction_token' || runtime.stampedExtractionNodeId) {
    return { runtime, logLines: [] };
  }

  const extractionId = layerIds.find((id) => tree.nodes[id]?.type === 'EXTRACTION');
  if (!extractionId) return { runtime, logLines: [] };

  const def = EXPEDITION_REQUISITION_REGISTRY.extraction_token;
  const trigger = tryKeepsakeTrigger(runtime, def.primaryTriggerKey, 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, logLines: [] };
  }

  return {
    runtime: {
      ...trigger.runtime,
      stampedExtractionNodeId: extractionId,
    },
    incursionPatch: { requisitionStampedExtractionNodeId: extractionId },
    logLines: [
      formatKeepsakeLogLine('Token', def.triggerMessage),
      '>> STAMPED EVAC — payout preview armed; +1 free bank on stamped extract.',
    ],
  };
}

export function isKeepsakeStampedExtractionNode(
  inc: Pick<ActiveIncursionState, 'requisitionStampedExtractionNodeId' | 'pendingExtractionNodeId'>,
): boolean {
  if (!inc.requisitionStampedExtractionNodeId || !inc.pendingExtractionNodeId) return false;
  return inc.requisitionStampedExtractionNodeId === inc.pendingExtractionNodeId;
}

export function applyKeepsakeOnStampedSafeExtractionConfirm(
  runtime: KeepsakeRuntime | null,
  inc: ActiveIncursionState,
): KeepsakeEconomyApplyResult {
  if (!runtime || !isKeepsakeStampedExtractionNode(inc)) {
    return { runtime, logLines: [] };
  }
  if (runtime.requisitionId === 'extraction_token' && !runtime.stampedExtractionConfirmed) {
    return {
      runtime,
      logLines: ['>> EXTRACTION TOKEN — resolve token choice before confirming evac.'],
    };
  }

  const logLines: string[] = [];
  let nextCargo = inc.cargo;
  let nextLedger = inc.runResourceLedger;
  let nextBank = inc.runBankedSnapshot;
  let nextRuntime = {
    ...runtime,
    stampedExtractionConfirmed: true,
  };

  const freeBank = bankSmallestCargoItem(nextCargo, nextBank);
  if (freeBank) {
    nextCargo = freeBank.cargo;
    nextBank = freeBank.bank;
    nextLedger = recordResourcesBanked(nextLedger, freeBank.bankedResources);
    nextRuntime = patchKeepsakeStats(nextRuntime, {
      cargoPreserved: nextRuntime.stats.cargoPreserved + 1,
    });
    logLines.push('>> STAMPED EVAC — 1 cargo item banked free of charge.');
  }

  return {
    runtime: nextRuntime,
    incursionPatch: {
      cargo: nextCargo,
      runBankedSnapshot: nextBank,
      runResourceLedger: nextLedger,
    },
    logLines,
  };
}

function bankSmallestCargoItem(
  cargo: CargoRunState,
  bank: ActiveIncursionState['runBankedSnapshot'],
): {
  cargo: CargoRunState;
  bank: ActiveIncursionState['runBankedSnapshot'];
  bankedResources: Partial<Record<ResourceItemId, number>>;
} | null {
  const candidates = [
    ...cargo.containment.map((item) => ({
      instanceId: item.instanceId,
      itemId: item.itemId,
      value: containmentItemValue(item),
    })),
    ...cargo.grid.placed.map((item) => ({
      instanceId: item.instanceId,
      itemId: item.itemId,
      value: item.currentValue,
    })),
  ]
    .filter((entry) => canBankCargoItemId(entry.itemId))
    .sort((a, b) => a.value - b.value);
  const smallest = candidates[0];
  if (!smallest) return null;
  const result = bankSingleCargoInstance(cargo, bank, smallest.instanceId);
  if (!result) return null;
  return result;
}

export function previewKeepsakeStampedExtractionPayout(
  runtime: KeepsakeRuntime | null,
  inc: ActiveIncursionState,
  basePayout: number,
  nodeId?: string | null,
): number {
  const stampedId = inc.requisitionStampedExtractionNodeId;
  const applies = nodeId != null
    ? stampedId === nodeId
    : isKeepsakeStampedExtractionNode(inc);
  if (!applies || !stampedId) return basePayout;
  const stableValue = sumStableCargoValue(inc.cargo);
  const bonus = Math.floor(stableValue * (STAMPED_STABLE_CARGO_VALUE_BONUS_PCT / 100));
  const debt = runtime?.nullLedgerDebtCredits ?? 0;
  return Math.max(0, basePayout + bonus - debt);
}

export function resolveKeepsakeMarkedPurchaseCreditSaved(
  runtime: KeepsakeRuntime | null,
  itemId: CargoItemId,
  basePrice: number,
  paidPrice: number,
): KeepsakeRuntime | null {
  if (!runtime || !isKeepsakeMarkedShelfItem(runtime, itemId)) return runtime;
  const saved = Math.max(0, basePrice - paidPrice);
  let next = runtime;
  if (saved > 0) {
    next = patchKeepsakeStats(next, {
      creditsSaved: runtime.stats.creditsSaved + saved,
      markedShelfPurchases: runtime.stats.markedShelfPurchases + 1,
    });
  }
  return next;
}

export function stageKeepsakeExtractionTokenChoice(
  runtime: KeepsakeRuntime | null,
  inc: ActiveIncursionState,
): KeepsakeEconomyApplyResult {
  if (!runtime || runtime.requisitionId !== 'extraction_token') {
    return { runtime, logLines: [] };
  }
  if (!isKeepsakeStampedExtractionNode(inc) || runtime.pendingChoice) {
    return { runtime, logLines: [] };
  }
  if (runtime.triggersUsed.extraction_token_choice_staged) {
    return { runtime, logLines: [] };
  }

  const nextRuntime = queueKeepsakePendingChoice(
    {
      ...runtime,
      triggersUsed: { ...runtime.triggersUsed, extraction_token_choice_staged: true },
    },
    buildExtractionTokenChoice(),
  );

  return {
    runtime: nextRuntime,
    logLines: ['>> EXTRACTION TOKEN — choose how to spend the stamped evac clearance.'],
  };
}
