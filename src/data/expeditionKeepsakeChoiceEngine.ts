import type { ActiveRunContract, KeepsakeSealedClause, KeepsakeSealedClauseKind } from '../types/contract';
import type { ActiveIncursionState } from '../types/game';
import type {
  KeepsakePendingChoice,
  KeepsakeRuntime,
} from '../types/expeditionKeepsake';
import type { ProceduralRunTree } from '../types/proceduralRunTree';
import { addLootToContainment } from './cargoGridEngine';
import {
  formatKeepsakeLogLine,
} from './expeditionKeepsakeEngine';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';
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
  runtime: KeepsakeRuntime | null;
  incursionPatch?: Partial<ActiveIncursionState>;
  contract?: ActiveRunContract | null;
  logLines: string[];
  /** When true, caller should defer harvest cargo commit until choice resolves. */
  deferHarvest?: boolean;
}

export function queueKeepsakePendingChoice(
  runtime: KeepsakeRuntime,
  choice: KeepsakePendingChoice,
): KeepsakeRuntime {
  if (runtime.pendingChoice) return runtime;
  return { ...runtime, pendingChoice: choice };
}

export function buildContractSealChoice(contractId: string): KeepsakePendingChoice {
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

export function buildDeadDropChoice(nodeId: string): KeepsakePendingChoice {
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

export function buildLeySiphonOverdrawChoice(nodeId: string): KeepsakePendingChoice {
  return {
    kind: 'ley_siphon_overdraw',
    prompt: 'Ley vein overdraw available on this resource node.',
    nodeId,
    options: [
      { value: 'OVERDRAW', label: 'Overdraw Vein', detail: 'Bonus salvage + unstable byproduct. Adds Contamination.' },
      { value: 'DECLINE', label: 'Standard Harvest', detail: 'Skip overdraw — no contamination this node.' },
    ],
  };
}

export function buildSmugglersDoubleWrapChoice(): KeepsakePendingChoice {
  return {
    kind: 'smugglers_double_wrap',
    prompt: "Contraband wrapped — double down or hold the line?",
    options: [
      { value: 'DOUBLE_WRAP', label: 'Double Wrap', detail: '+15% extra fence value and Hunter Mark on the route.' },
      { value: 'HOLD', label: 'Hold Wrap', detail: 'Keep the standard wrap — no extra hunter pressure.' },
    ],
  };
}

export function buildCartographLockChoice(ghostNodeId: string): KeepsakePendingChoice {
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

export function buildPolaroidDevelopChoice(nodeId: string): KeepsakePendingChoice {
  return {
    kind: 'polaroid_develop',
    prompt: 'Echo imprint captured — develop the polaroid?',
    nodeId,
    options: [
      { value: 'DEVELOP', label: 'Develop Photo', detail: 'Reveal a death clue and corrupt a future node.' },
      { value: 'SKIP', label: 'Hold Negative', detail: 'Keep the preview only — no extra fallout.' },
    ],
  };
}

export function buildExtractionTokenChoice(): KeepsakePendingChoice {
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

export function buildMournersBellChoice(nodeId: string): KeepsakePendingChoice {
  return {
    kind: 'mourners_bell_answer',
    prompt: "Echo signal detected — answer the Mourner's Bell.",
    nodeId,
    options: [
      { value: 'LISTEN', label: 'Listen', detail: '+15% echo credit yield; gain Echo Thread.' },
      { value: 'LOOT', label: 'Loot', detail: '+1 echo-glass; raises hostile echo pressure.' },
      { value: 'BURY', label: 'Bury', detail: 'Reduce echo heat; still gain Echo Thread.' },
    ],
  };
}

export function buildHollowKeyUnlockChoice(nodeId: string): KeepsakePendingChoice {
  return {
    kind: 'hollow_key_unlock',
    prompt: 'Occult lock detected — spend a Hollow Key?',
    nodeId,
    options: [
      { value: 'UNLOCK', label: 'Spend Key', detail: 'Unlock hidden options (+1 Noise on the route).' },
      { value: 'PASS', label: 'Leave Sealed', detail: 'Keep the key — occult options remain locked.' },
    ],
  };
}

export function buildFalseEvacBeaconChoice(nodeId: string): KeepsakePendingChoice {
  return {
    kind: 'false_evac_beacon_plant',
    prompt: 'Plant a false evac beacon on this vector.',
    nodeId,
    options: [
      { value: 'DECOY', label: 'Decoy Extraction', detail: 'Fake evac signal — biases next depth toward extraction.' },
      { value: 'LURE', label: 'Lure Signal', detail: 'Draw rival attention — +HIGH RISK on adjacent node.' },
      { value: 'SCRAMBLE', label: 'Scramble Route', detail: 'Corrupt a future node with unstable readings.' },
    ],
  };
}

export function buildGutterServiceChoice(): KeepsakePendingChoice {
  return {
    kind: 'gutter_service',
    prompt: 'Gutter Crown shrine awake — choose one black-market favor.',
    options: [
      { value: 'LAUNDER', label: 'Launder Cargo', detail: '+10% banked cargo value this run.' },
      { value: 'HIDE_SCENT', label: 'Hide Scent', detail: 'Clear outside-hook scent / rival pressure.' },
      { value: 'CROWN_RESOURCE', label: 'Crown Resource', detail: '+1 stable salvage routed to containment.' },
      { value: 'BUY_RUMOR', label: 'Buy Rumor', detail: '+40 run credits; next depth gains HIGH RISK.' },
    ],
  };
}

export function prepareKeepsakeContractSealChoice(
  runtime: KeepsakeRuntime | null,
  contract: ActiveRunContract | null,
): { runtime: KeepsakeRuntime | null; contract: ActiveRunContract | null; logLines: string[] } {
  if (!runtime || runtime.keepsakeId !== 'contract_seal' || !contract?.contractId) {
    return { runtime, contract, logLines: [] };
  }
  if (runtime.triggersUsed.contract_seal_clause_prepared) {
    return { runtime, contract, logLines: [] };
  }

  const def = getKeepsakeDefinition('contract_seal');
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
  runtime: KeepsakeRuntime | null,
): { runtime: KeepsakeRuntime | null; logLines: string[] } {
  if (!runtime || runtime.keepsakeId !== 'null_ledger') {
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
  runtime: KeepsakeRuntime | null,
  depth: number,
): { runtime: KeepsakeRuntime | null; logLines: string[] } {
  if (!runtime || runtime.keepsakeId !== 'null_ledger' || runtime.nullLedgerDebtCredits <= 0) {
    return { runtime, logLines: [] };
  }

  const interest = Math.ceil(runtime.nullLedgerDebtCredits * (NULL_LEDGER_INTEREST_PCT / 100));
  const nextDebt = Math.min(NULL_LEDGER_CREDIT_CAP, runtime.nullLedgerDebtCredits + interest);
  let nextRuntime = {
    ...runtime,
    nullLedgerDebtCredits: nextDebt,
  };
  nextRuntime = incrementKeepsakeCounter(nextRuntime, 'contamination', 0);
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

export function resolveNullLedgerCreditCap(runtime: KeepsakeRuntime | null): number {
  return runtime?.counters.nullLedgerCreditCap ?? NULL_LEDGER_CREDIT_CAP;
}

export function canAccrueNullLedgerDebt(
  runtime: KeepsakeRuntime | null,
  additionalDebt: number,
): boolean {
  if (!runtime || runtime.keepsakeId !== 'null_ledger') return false;
  const cap = resolveNullLedgerCreditCap(runtime);
  return runtime.nullLedgerDebtCredits + additionalDebt <= cap;
}

export function commitKeepsakePendingChoice(
  inc: ActiveIncursionState,
  selectedValue: string,
): KeepsakeChoiceCommitResult {
  const runtime = inc.keepsakeRuntime;
  const choice = runtime?.pendingChoice;
  if (!runtime || !choice) {
    return { runtime, logLines: [] };
  }

  const clearChoice = (next: KeepsakeRuntime): KeepsakeRuntime => ({
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

    case 'ley_siphon_overdraw': {
      if (selectedValue === 'OVERDRAW') {
        return {
          runtime: clearChoice(setKeepsakeFlag(runtime, 'leyOverdrawConfirmed', true)),
          logLines: ['>> LEY-SIPHON — overdraw confirmed.'],
        };
      }
      return {
        runtime: clearChoice({ ...runtime, leySiphonOverdrawPending: false }),
        logLines: ['>> LEY-SIPHON — standard harvest. No contamination added.'],
      };
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

    case 'polaroid_develop': {
      let nextRuntime = clearChoice(
        appendKeepsakeDecision(runtime, {
          key: 'polaroid_develop',
          label: 'Polaroid',
          value: selectedValue,
        }),
      );
      const logLines = [`>> POLAROID — ${selectedValue}.`];
      let incursionPatch: Partial<ActiveIncursionState> | undefined;

      if (selectedValue === 'DEVELOP') {
        nextRuntime = setKeepsakeFlag(nextRuntime, 'deathClueAvailable', true);
        nextRuntime = patchKeepsakeStats(nextRuntime, {
          echoIntelRevealed: nextRuntime.stats.echoIntelRevealed + 1,
        });
        const tree = inc.proceduralRunTree;
        if (tree) {
          const targetId = pickFutureKeepsakeNode(tree, inc.nodesCleared, ['GATEKEEPER', 'EXTRACTION'], 'highRisk');
          if (targetId) {
            incursionPatch = {
              proceduralRunTree: patchKeepsakeNodeModifiers(tree, targetId, {
                highRisk: true,
                highValueResource: true,
              }),
            };
            logLines.push('>> POLAROID DEVELOPED — death clue archived; future vector corrupted.');
          } else {
            logLines.push('>> POLAROID DEVELOPED — death clue archived.');
          }
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
          keepsakeStampedExtractionNodeId: null,
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
          keepsakeStampedExtractionNodeId: null,
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

    case 'mourners_bell_answer': {
      const nextRuntime = clearChoice(
        appendKeepsakeDecision(runtime, {
          key: 'mourners_bell',
          label: "Mourner's Bell",
          value: selectedValue,
          depth: localProceduralDepth(inc.nodesCleared),
        }),
      );
      const logLines = [`>> MOURNER'S BELL — ${selectedValue}.`];
      if (selectedValue === 'LOOT') {
        return {
          runtime: setKeepsakeFlag(nextRuntime, 'mournersBellHostileBias', true),
          logLines: [...logLines, '>> LOOT CHOSEN — hostile echo pressure rising.'],
        };
      }
      return { runtime: nextRuntime, logLines };
    }

    case 'hollow_key_unlock': {
      if (selectedValue === 'PASS') {
        return {
          runtime: clearChoice(runtime),
          logLines: ['>> OCCULT LOCK — left sealed.'],
        };
      }
      const keys = runtime.counters.hollowKeys ?? 0;
      if (keys <= 0) {
        return { runtime: clearChoice(runtime), logLines: ['>> HOLLOW KEY — no keys remaining.'] };
      }
      let nextRuntime = clearChoice(
        appendKeepsakeDecision(runtime, {
          key: 'hollow_key',
          label: 'Occult Lock',
          value: 'UNLOCK',
          depth: localProceduralDepth(inc.nodesCleared),
        }),
      );
      nextRuntime = incrementKeepsakeCounter(nextRuntime, 'hollowKeys', -1);
      nextRuntime = incrementKeepsakeCounter(nextRuntime, 'noise', 1);
      nextRuntime = patchKeepsakeStats(nextRuntime, { keysUsed: nextRuntime.stats.keysUsed + 1 });
      return {
        runtime: nextRuntime,
        logLines: ['>> OCCULT LOCK OPENED — hidden options unlocked (+1 Noise).'],
      };
    }

    case 'false_evac_beacon_plant': {
      let nextRuntime = clearChoice(
        appendKeepsakeDecision(runtime, {
          key: 'false_beacon',
          label: 'False Beacon',
          value: selectedValue,
          depth: localProceduralDepth(inc.nodesCleared),
        }),
      );
      nextRuntime = patchKeepsakeStats(nextRuntime, {
        falseBeaconsPlanted: nextRuntime.stats.falseBeaconsPlanted + 1,
      });
      const logLines = [`>> FALSE BEACON — ${selectedValue} planted.`];
      let incursionPatch: Partial<ActiveIncursionState> | undefined;
      const tree = inc.proceduralRunTree;
      const anchorId = choice.nodeId;

      if (tree && anchorId) {
        if (selectedValue === 'DECOY') {
          incursionPatch = {
            proceduralRunTree: patchKeepsakeNodeModifiers(tree, anchorId, {
              keepsakeFalseBeacon: true,
              highValueResource: true,
            }),
          };
        } else if (selectedValue === 'LURE') {
          const corruptId = pickFutureKeepsakeNode(tree, inc.nodesCleared);
          if (corruptId) {
            incursionPatch = {
              proceduralRunTree: patchKeepsakeNodeModifiers(tree, corruptId, {
                keepsakeFalseBeacon: true,
                highRisk: true,
              }),
            };
          }
        } else {
          const scrambleId = pickFutureKeepsakeNode(tree, inc.nodesCleared, ['GATEKEEPER'], 'highRisk');
          if (scrambleId) {
            incursionPatch = {
              proceduralRunTree: patchKeepsakeNodeModifiers(tree, scrambleId, {
                keepsakeFalseBeacon: true,
                highRisk: true,
                highValueResource: true,
              }),
            };
          }
        }
      }

      return { runtime: nextRuntime, incursionPatch, logLines };
    }

    case 'gutter_service': {
      let nextRuntime = clearChoice(
        appendKeepsakeDecision(runtime, {
          key: 'gutter_service',
          label: 'Gutter Service',
          value: selectedValue,
        }),
      );
      nextRuntime = patchKeepsakeStats(nextRuntime, {
        safehouseServiceUsed: selectedValue,
      });
      const logLines = [`>> GUTTER SERVICE — ${selectedValue}.`];
      let incursionPatch: Partial<ActiveIncursionState> | undefined;

      if (selectedValue === 'LAUNDER') {
        nextRuntime = setKeepsakeFlag(nextRuntime, 'gutterLaunderActive', true);
        logLines.push('>> LAUNDER — banked cargo value +10% this run.');
      } else if (selectedValue === 'HIDE_SCENT') {
        nextRuntime = incrementKeepsakeCounter(nextRuntime, 'scent', -(nextRuntime.counters.scent ?? 0));
        logLines.push('>> HIDE SCENT — outside hook scent cleared.');
      } else if (selectedValue === 'CROWN_RESOURCE') {
        logLines.push('>> CROWN RESOURCE — stable salvage queued for next harvest.');
        nextRuntime = setKeepsakeFlag(nextRuntime, 'gutterCrownResourcePending', true);
      } else if (selectedValue === 'BUY_RUMOR') {
        incursionPatch = { runCredits: inc.runCredits + 40 };
        const tree = inc.proceduralRunTree;
        if (tree) {
          const targetId = pickFutureKeepsakeNode(tree, inc.nodesCleared);
          if (targetId) {
            incursionPatch = {
              ...incursionPatch,
              proceduralRunTree: patchKeepsakeNodeModifiers(tree, targetId, { highRisk: true }),
            };
          }
        }
        logLines.push('>> BUY RUMOR — +40 run credits; next vector destabilized.');
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

export function shouldDeferHarvestForKeepsakeChoice(
  runtime: KeepsakeRuntime | null | undefined,
): boolean {
  return runtime?.pendingChoice?.kind === 'ley_siphon_overdraw';
}

export function isLeyOverdrawConfirmed(runtime: KeepsakeRuntime | null | undefined): boolean {
  return runtime?.flags.leyOverdrawConfirmed === true;
}

export function clearLeyOverdrawConfirmedFlag(runtime: KeepsakeRuntime | null): KeepsakeRuntime | null {
  if (!runtime) return runtime;
  const { leyOverdrawConfirmed: _, ...restFlags } = runtime.flags;
  return {
    ...runtime,
    flags: restFlags,
    leySiphonOverdrawPending: false,
  };
}

export function applyKeepsakeLeyContamination(
  runtime: KeepsakeRuntime | null,
): KeepsakeRuntime | null {
  if (!runtime) return runtime;
  let next = incrementKeepsakeCounter(runtime, 'contamination', 1);
  next = patchKeepsakeStats(next, {
    contaminationAdded: next.stats.contaminationAdded + 1,
  });
  return next;
}

export function purgeKeepsakeLeyContamination(
  runtime: KeepsakeRuntime | null,
): { runtime: KeepsakeRuntime | null; logLines: string[] } {
  if (!runtime || runtime.keepsakeId !== 'ley_siphon_needle') {
    return { runtime, logLines: [] };
  }
  const amount = runtime.counters.contamination ?? 0;
  if (amount <= 0) {
    return { runtime, logLines: [] };
  }
  const next = patchKeepsakeStats(
    { ...runtime, counters: { ...runtime.counters, contamination: 0 } },
    { contaminationPurged: runtime.stats.contaminationPurged + amount },
  );
  return {
    runtime: next,
    logLines: [`>> LEY-SIPHON PURGE — ${amount} contamination cleared at safehouse.`],
  };
}
