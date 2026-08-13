import type { ActiveRunContract, KeepsakeSealedClause, KeepsakeSealedClauseKind } from '../types/contract';
import type { ActiveIncursionState } from '../types/game';
import type {
  RequisitionPendingChoice,
  RequisitionRuntime,
} from '../types/expeditionRequisition';
import type { ProceduralRunTree } from '../types/proceduralRunTree';
import { addLootToContainment } from './cargoGridEngine';
import {
  formatKeepsakeLogLine,
} from './expeditionKeepsakeEngine';
import { EXPEDITION_REQUISITION_REGISTRY } from './expeditionRequisitionRegistry';
import {
  appendKeepsakeDecision,
  incrementKeepsakeCounter,
  patchKeepsakeStats,
  setKeepsakeFlag,
} from './keepsakeRunState';
import {
  patchKeepsakeNodeModifiers,
  pickAdjacentCorruptionTarget,
  pickFutureKeepsakeNode,
} from './expeditionKeepsakeRouteEngine';
import { localProceduralDepth } from './proceduralScannerBridge';

const NULL_LEDGER_CREDIT_CAP = 200;
const NULL_LEDGER_INTEREST_PCT = 25;

const CONTRACT_CLAUSE_TEXT: Record<KeepsakeSealedClauseKind, string> = {
  OPERATION_TARGET: 'Clear 1 operation target before extract.',
  EXTRACT_TWO_CARGO: 'Extract with at least 2 cargo items secured.',
  DEFEAT_ELITE: 'Defeat 1 Elite hostile.',
  CLEAR_ANCHOR: 'Clear 1 Anchor Signal.',
  COMPLETE_DEPTH_2: 'Reach Depth 2 before extract.',
  NO_DIRTY_EXTRACTION: 'Extract without using Dirty Extraction.',
};

const CONTRACT_CLAUSE_POOL: readonly KeepsakeSealedClauseKind[] = [
  'OPERATION_TARGET',
  'EXTRACT_TWO_CARGO',
  'DEFEAT_ELITE',
  'CLEAR_ANCHOR',
  'COMPLETE_DEPTH_2',
  'NO_DIRTY_EXTRACTION',
];

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickThreeSealedClauses(contractId: string): KeepsakeSealedClause[] {
  const used = new Set<number>();
  const clauses: KeepsakeSealedClause[] = [];
  let salt = 0;
  while (clauses.length < 3 && used.size < CONTRACT_CLAUSE_POOL.length) {
    const idx = (hashSeed(`${contractId}:${salt}`)) % CONTRACT_CLAUSE_POOL.length;
    salt += 1;
    if (used.has(idx)) continue;
    used.add(idx);
    const kind = CONTRACT_CLAUSE_POOL[idx] ?? 'DEFEAT_ELITE';
    clauses.push({ kind, text: CONTRACT_CLAUSE_TEXT[kind] });
  }
  return clauses;
}

export interface KeepsakeChoiceCommitResult {
  runtime: RequisitionRuntime | null;
  incursionPatch?: Partial<ActiveIncursionState>;
  contract?: ActiveRunContract | null;
  logLines: string[];
  /** When true, caller should defer harvest cargo commit until choice resolves. */
  deferHarvest?: boolean;
}

export function queueKeepsakePendingChoice(
  runtime: RequisitionRuntime,
  choice: RequisitionPendingChoice,
): RequisitionRuntime {
  if (runtime.pendingChoice) return runtime;
  return { ...runtime, pendingChoice: choice };
}

export function buildContractSealChoice(contractId: string): RequisitionPendingChoice {
  const clauses = pickThreeSealedClauses(contractId);
  return {
    kind: 'contract_seal_clause',
    prompt: 'Choose one sealed clause to bind this contract.',
    options: clauses.map((clause, index) => ({
      value: clause.kind,
      label: clause.kind.replace(/_/g, ' '),
      detail: clause.text,
    })),
  };
}

export function buildDeadDropChoice(nodeId: string): RequisitionPendingChoice {
  return {
    kind: 'dead_drop_action',
    prompt: 'Dead-Drop cache intercepted — choose your next move.',
    nodeId,
    options: [
      { value: 'TAKE', label: 'Take Cache', detail: 'Secure the buried salvage and hold position.' },
      { value: 'TRACE', label: 'Trace Chain', detail: 'Follow the smuggler ping — next depth gains HIGH RISK.' },
      { value: 'SELL', label: 'Sell Intel', detail: 'Fence the cache coordinates for +40 run credits now.' },
    ],
  };
}

export function buildSmugglersDoubleWrapChoice(): RequisitionPendingChoice {
  return {
    kind: 'smugglers_double_wrap',
    prompt: "Contraband wrapped — double down or hold the line?",
    options: [
      { value: 'DOUBLE_WRAP', label: 'Double Wrap', detail: '+15% extra fence value and Hunter Mark on the route.' },
      { value: 'HOLD', label: 'Hold Wrap', detail: 'Keep the standard wrap — no extra hunter pressure.' },
    ],
  };
}

export function buildCartographLockChoice(ghostNodeId: string): RequisitionPendingChoice {
  return {
    kind: 'cartograph_lock',
    prompt: 'Ghost route revealed — lock the previewed vector?',
    nodeId: ghostNodeId,
    options: [
      { value: 'LOCK', label: 'Lock Route', detail: 'Commit the ghost path — corrupt an adjacent node with HIGH RISK.' },
      { value: 'PASS', label: 'Pass', detail: 'Keep the preview intel without destabilizing the grid.' },
    ],
  };
}

export function buildExtractionTokenChoice(): RequisitionPendingChoice {
  return {
    kind: 'extraction_token_action',
    prompt: 'Stamped evac vector — choose how to spend the token.',
    options: [
      { value: 'STAMP_CARGO', label: 'Stamp Cargo', detail: 'Confirm clean extract — free bank + stable cargo payout bonus.' },
      { value: 'CASH_OUT', label: 'Cash Out', detail: 'Take +75 run credits now and forfeit the stamped bonus.' },
      { value: 'BURN_TOKEN', label: 'Burn Token', detail: 'Decline this exit — escalate route risk for a hotter run.' },
    ],
  };
}

export function prepareKeepsakeContractSealChoice(
  runtime: RequisitionRuntime | null,
  contract: ActiveRunContract | null,
): { runtime: RequisitionRuntime | null; contract: ActiveRunContract | null; logLines: string[] } {
  if (!runtime || runtime.requisitionId !== 'contract_seal' || !contract?.contractId) {
    return { runtime, contract, logLines: [] };
  }
  if (runtime.triggersUsed.contract_seal_clause_prepared) {
    return { runtime, contract, logLines: [] };
  }

  const def = EXPEDITION_REQUISITION_REGISTRY.contract_seal;
  const choice = buildContractSealChoice(contract.contractId);
  const nextRuntime = queueKeepsakePendingChoice(
    {
      ...runtime,
      triggersUsed: { ...runtime.triggersUsed, contract_seal_clause_prepared: true },
    },
    choice,
  );

  return {
    runtime: nextRuntime,
    contract,
    logLines: [formatKeepsakeLogLine('Seal', `${def.triggerMessage} — choose your sealed clause.`)],
  };
}

export function applyKeepsakeNullLedgerRunStart(
  runtime: RequisitionRuntime | null,
): { runtime: RequisitionRuntime | null; logLines: string[] } {
  if (!runtime || runtime.requisitionId !== 'null_ledger') {
    return { runtime, logLines: [] };
  }
  const next = incrementKeepsakeCounter(runtime, 'nullLedgerCreditCap', NULL_LEDGER_CREDIT_CAP);
  return {
    runtime: setKeepsakeFlag(next, 'nullLedgerActive', true),
    logLines: [
      formatKeepsakeLogLine('Ledger', `Null credit line opened — cap ${NULL_LEDGER_CREDIT_CAP} CR.`),
    ],
  };
}

export function applyKeepsakeNullLedgerDepthInterest(
  runtime: RequisitionRuntime | null,
  depth: number,
): { runtime: RequisitionRuntime | null; logLines: string[] } {
  if (!runtime || runtime.requisitionId !== 'null_ledger' || runtime.nullLedgerDebtCredits <= 0) {
    return { runtime, logLines: [] };
  }

  const interest = Math.ceil(runtime.nullLedgerDebtCredits * (NULL_LEDGER_INTEREST_PCT / 100));
  const nextDebt = Math.min(NULL_LEDGER_CREDIT_CAP, runtime.nullLedgerDebtCredits + interest);
  let nextRuntime = {
    ...runtime,
    nullLedgerDebtCredits: nextDebt,
  };
  nextRuntime = patchKeepsakeStats(nextRuntime, {
    creditsDeferred: nextRuntime.stats.creditsDeferred + interest,
  });

  const logLines = [
    `>> NULL LEDGER INTEREST — D${depth}: debt now ${nextDebt} CR (+${interest} CR).`,
  ];

  if (nextDebt >= 150) {
    nextRuntime = incrementKeepsakeCounter(nextRuntime, 'debtWarnings', 1);
    nextRuntime = patchKeepsakeStats(nextRuntime, {
      debtWarningsTriggered: nextRuntime.stats.debtWarningsTriggered + 1,
    });
    logLines.push('>> NULL LEDGER WARNING — debt threshold critical. Extraction fees worsening.');
  }

  return { runtime: nextRuntime, logLines };
}

export function resolveNullLedgerCreditCap(runtime: RequisitionRuntime | null): number {
  return runtime?.counters.nullLedgerCreditCap ?? NULL_LEDGER_CREDIT_CAP;
}

export function canAccrueNullLedgerDebt(
  runtime: RequisitionRuntime | null,
  additionalDebt: number,
): boolean {
  if (!runtime || runtime.requisitionId !== 'null_ledger') return false;
  const cap = resolveNullLedgerCreditCap(runtime);
  return runtime.nullLedgerDebtCredits + additionalDebt <= cap;
}

export function commitKeepsakePendingChoice(
  inc: ActiveIncursionState,
  selectedValue: string,
): KeepsakeChoiceCommitResult {
  const runtime = inc.requisitionRuntime;
  const choice = runtime?.pendingChoice;
  if (!runtime || !choice) {
    return { runtime, logLines: [] };
  }

  const clearChoice = (next: RequisitionRuntime): RequisitionRuntime => ({
    ...next,
    pendingChoice: null,
  });

  switch (choice.kind) {
    case 'contract_seal_clause': {
      const kind = selectedValue as KeepsakeSealedClauseKind;
      const clause: KeepsakeSealedClause = {
        kind,
        text: CONTRACT_CLAUSE_TEXT[kind] ?? 'Complete the sealed objective.',
      };
      const contract = inc.activeContract
        ? { ...inc.activeContract, keepsakeSealedClause: clause }
        : null;
      let nextRuntime = clearChoice(
        appendKeepsakeDecision(runtime, {
          key: 'contract_clause',
          label: 'Sealed Clause',
          value: clause.text,
        }),
      );
      nextRuntime = {
        ...nextRuntime,
        triggersUsed: { ...nextRuntime.triggersUsed, contract_seal_run: true },
      };
      return {
        runtime: nextRuntime,
        contract,
        logLines: [`>> SEALED CLAUSE — ${clause.text}`],
      };
    }

    case 'dead_drop_action': {
      let nextRuntime = clearChoice(
        appendKeepsakeDecision(runtime, {
          key: 'dead_drop',
          label: 'Dead-Drop Action',
          value: selectedValue,
          depth: localProceduralDepth(inc.nodesCleared),
        }),
      );
      const logLines: string[] = [`>> DEAD-DROP — ${selectedValue}.`];
      let incursionPatch: Partial<ActiveIncursionState> | undefined;

      if (selectedValue === 'TRACE') {
        nextRuntime = setKeepsakeFlag(nextRuntime, 'deadDropTraceActive', true);
        const tree = inc.proceduralRunTree;
        if (tree) {
          const targetId = pickFutureKeepsakeNode(tree, inc.nodesCleared);
          if (targetId) {
            incursionPatch = {
              proceduralRunTree: patchKeepsakeNodeModifiers(tree, targetId, {
                highRisk: true,
                keepsakeDeadDrop: true,
              }),
            };
            logLines.push('>> DEAD-DROP TRACE — smuggler chain extended. Next depth flagged HIGH RISK.');
          }
        }
      } else if (selectedValue === 'SELL') {
        incursionPatch = { runCredits: inc.runCredits + 40 };
        logLines.push('>> DEAD-DROP SOLD — +40 run credits from fenced coordinates.');
      } else {
        logLines.push('>> DEAD-DROP SECURED — cache contents retained.');
      }

      return { runtime: nextRuntime, incursionPatch, logLines };
    }

    case 'smugglers_double_wrap': {
      let nextRuntime = clearChoice(
        appendKeepsakeDecision(runtime, {
          key: 'double_wrap',
          label: 'Smuggler Wrap',
          value: selectedValue,
        }),
      );
      const logLines = [`>> SMUGGLER'S WRAP — ${selectedValue}.`];
      if (selectedValue === 'DOUBLE_WRAP') {
        nextRuntime = {
          ...nextRuntime,
          smugglersHunterMarkActive: true,
        };
        nextRuntime = patchKeepsakeStats(nextRuntime, {
          cargoValueBonus: nextRuntime.stats.cargoValueBonus + 1,
        });
        logLines.push('>> HUNTER MARK — rival pressure elevated on the route.');
      }
      return { runtime: nextRuntime, logLines };
    }

    case 'cartograph_lock': {
      let nextRuntime = clearChoice(
        appendKeepsakeDecision(runtime, {
          key: 'cartograph_lock',
          label: 'Cartograph Lock',
          value: selectedValue,
        }),
      );
      const logLines = [`>> CARTOGRAPH — ${selectedValue}.`];
      let incursionPatch: Partial<ActiveIncursionState> | undefined;

      if (selectedValue === 'LOCK' && choice.nodeId && inc.proceduralRunTree) {
        const corruptId = pickAdjacentCorruptionTarget(inc.proceduralRunTree, choice.nodeId);
        if (corruptId) {
          incursionPatch = {
            proceduralRunTree: patchKeepsakeNodeModifiers(inc.proceduralRunTree, corruptId, {
              highRisk: true,
              keepsakeMarkedCorruption: true,
            }),
          };
          nextRuntime = patchKeepsakeStats(nextRuntime, {
            routeNodesLocked: nextRuntime.stats.routeNodesLocked + 1,
          });
          logLines.push('>> CARTOGRAPH LOCK — adjacent vector corrupted with HIGH RISK.');
        }
      }

      return { runtime: nextRuntime, incursionPatch, logLines };
    }

    case 'extraction_token_action': {
      let nextRuntime = clearChoice(
        appendKeepsakeDecision(runtime, {
          key: 'extraction_token',
          label: 'Extraction Token',
          value: selectedValue,
        }),
      );
      const logLines = [`>> EXTRACTION TOKEN — ${selectedValue}.`];
      let incursionPatch: Partial<ActiveIncursionState> | undefined;

      if (selectedValue === 'CASH_OUT') {
        incursionPatch = { runCredits: inc.runCredits + 75 };
        nextRuntime = {
          ...nextRuntime,
          stampedExtractionConfirmed: false,
          stampedExtractionNodeId: null,
        };
        incursionPatch = {
          ...incursionPatch,
          requisitionStampedExtractionNodeId: null,
        };
        logLines.push('>> TOKEN CASH OUT — +75 run credits. Stamped bonus forfeited.');
      } else if (selectedValue === 'BURN_TOKEN') {
        const burns = nextRuntime.extractionTokenBurns + 1;
        nextRuntime = {
          ...nextRuntime,
          extractionTokenBurns: burns,
          stampedExtractionNodeId: null,
          stampedExtractionConfirmed: false,
        };
        incursionPatch = {
          requisitionStampedExtractionNodeId: null,
          pendingExtractionNodeId: null,
          extractionReviewKind: null,
          pendingSafeAnchorIndex: null,
        };
        const tree = inc.proceduralRunTree;
        if (tree) {
          const targetId = pickFutureKeepsakeNode(tree, inc.nodesCleared);
          if (targetId) {
            incursionPatch.proceduralRunTree = patchKeepsakeNodeModifiers(tree, targetId, {
              highRisk: true,
            });
          }
        }
        nextRuntime = patchKeepsakeStats(nextRuntime, {
          triggerCount: nextRuntime.stats.triggerCount + 1,
        });
        logLines.push(`>> TOKEN BURNED (${burns}) — evac declined. Route heat rising.`);
      } else {
        nextRuntime = { ...nextRuntime, stampedExtractionConfirmed: true };
        logLines.push('>> TOKEN STAMP — cargo stamp confirmed for clean extract.');
      }

      return { runtime: nextRuntime, incursionPatch, logLines };
    }

    default:
      return {
        runtime: clearChoice(runtime),
        logLines: [],
      };
  }
}
