import type { ActiveIncursionState, IncursionNode, NarrativeChoiceKey } from '../types/game';
import type { CargoRunState } from '../types/cargoGrid';
import type { ResourceItemId } from '../types/resourceItem';
import type { ProceduralRunTree } from '../types/proceduralRunTree';
import type { EchoEncounterKind } from '../types/echoEncounter';
import { addLootToContainment } from './cargoGridEngine';
import { seededRandom } from './encounterGenerator';
import { getAvailableProceduralNodeIds } from './proceduralScannerBridge';
import {
  createDefaultEchoRunState,
  ECHO_OPERATION_PROGRESS,
  recordEchoRewardsExtracted,
  type EchoRunState,
} from './echoRunState';

export interface EchoResolutionResult {
  logLines: string[];
  echoRunState: EchoRunState;
  cargo?: CargoRunState;
  runCreditsDelta?: number;
  triggerCombatAmbush?: boolean;
  revealedSonarNodeIds?: string[];
  progressPatch?: ActiveIncursionState['progress'];
  operationProgressDelta?: number;
}

function isEchoRecoveryActive(inc: ActiveIncursionState): boolean {
  return inc.runGenerationContext?.activeOperation.objectiveKind === 'ECHO_RECOVERY';
}

function withOperationProgress(
  state: EchoRunState,
  amount: number,
  isEchoRecovery: boolean,
): EchoRunState {
  if (!isEchoRecovery || amount <= 0) return state;
  return {
    ...state,
    echoOperationProgress: state.echoOperationProgress + amount,
  };
}

function recordEchoResolved(
  state: EchoRunState,
  patch: Partial<EchoRunState>,
): EchoRunState {
  return {
    ...state,
    echoSignalsResolved: state.echoSignalsResolved + 1,
    ...patch,
  };
}

export function mergeEchoRunState(
  current: EchoRunState | undefined,
  patch: Partial<EchoRunState>,
): EchoRunState {
  return { ...(current ?? createDefaultEchoRunState()), ...patch };
}

export function recordEchoSignalDiscovered(
  state: EchoRunState | undefined,
): EchoRunState {
  const base = state ?? createDefaultEchoRunState();
  return { ...base, echoSignalsDiscovered: base.echoSignalsDiscovered + 1 };
}

function grantResourceToCargo(
  cargo: CargoRunState,
  resourceId: ResourceItemId,
  quantity: number,
  stagedIds: string[],
): CargoRunState {
  let next = cargo;
  for (let i = 0; i < quantity; i += 1) {
    next = addLootToContainment(next, resourceId, 1, stagedIds);
  }
  return next;
}

function rollSectorStableResource(inc: ActiveIncursionState, seed: string): ResourceItemId {
  const focus = inc.runGenerationContext?.sectorState.resourceFocus ?? [];
  const pool: ResourceItemId[] = ['ley-slag', 'echo-glass-shard'];
  if (focus.some((entry) => entry.toLowerCase().includes('ley'))) {
    pool.unshift('ley-slag');
  }
  const rand = seededRandom(`echo-cargo:${seed}`);
  return pool[Math.floor(rand() * pool.length)] ?? 'ley-slag';
}

export function resolveAssistEcho(
  inc: ActiveIncursionState,
  seed: string,
): EchoResolutionResult {
  const isEchoRecovery = isEchoRecoveryActive(inc);
  const rand = seededRandom(`echo-assist:${seed}`);
  const roll = rand();
  const logLines: string[] = ['>> ASSIST ECHO — benevolent runner trace acknowledged.'];

  let progressPatch: ActiveIncursionState['progress'] | undefined;
  if (roll < 0.34) {
    progressPatch = {
      ...inc.progress,
      narrativeModifiers: {
        ...inc.progress.narrativeModifiers,
        nextCombatDamageBonusPct: inc.progress.narrativeModifiers.nextCombatDamageBonusPct + 10,
      },
    };
    logLines.push('>> RUNNER MEMORY — next combat damage +10%.');
  } else if (roll < 0.67) {
    progressPatch = {
      ...inc.progress,
      narrativeModifiers: {
        ...inc.progress.narrativeModifiers,
        nextCombatEnemyHpBonusPct: inc.progress.narrativeModifiers.nextCombatEnemyHpBonusPct - 5,
      },
    };
    logLines.push('>> RUNNER MEMORY — hostile pressure reduced next engagement.');
  } else {
    logLines.push('>> RUNNER MEMORY — residual shield harmonics logged (narrative buff).');
  }

  const echoRunState = recordEchoResolved(
    withOperationProgress(
      inc.echoRunState ?? createDefaultEchoRunState(),
      ECHO_OPERATION_PROGRESS.assistEchoTriggered,
      isEchoRecovery,
    ),
    { assistEchoesTriggered: (inc.echoRunState?.assistEchoesTriggered ?? 0) + 1 },
  );

  return {
    logLines,
    echoRunState,
    progressPatch,
    operationProgressDelta: isEchoRecovery ? ECHO_OPERATION_PROGRESS.assistEchoTriggered : 0,
  };
}

export function resolveCargoEcho(
  inc: ActiveIncursionState,
  seed: string,
): EchoResolutionResult {
  const isEchoRecovery = isEchoRecoveryActive(inc);
  const rand = seededRandom(`echo-cargo:${seed}`);
  const logLines: string[] = ['>> CARGO ECHO — jettisoned runner cache uncovered.'];
  const stagedIds: string[] = [];
  let cargo = inc.cargo;

  const resourceId = rollSectorStableResource(inc, seed);
  cargo = grantResourceToCargo(cargo, resourceId, 1, stagedIds);
  logLines.push(`>> SALVAGE SECURED — 1× ${resourceId.toUpperCase()}.`);

  if (rand() < 0.2) {
    cargo = grantResourceToCargo(cargo, 'echo-glass-shard', 1, stagedIds);
    logLines.push('>> ECHO-Glass shard recovered from imprint residue.');
  }

  const unstableRoll = rand();
  let triggerCombatAmbush = false;
  if (unstableRoll < 0.08) {
    cargo = grantResourceToCargo(cargo, 'veil-ash-canister', 1, stagedIds);
    logLines.push('>> WARNING — unstable cargo imprint merged into containment.');
    triggerCombatAmbush = rand() < 0.35;
    if (triggerCombatAmbush) {
      logLines.push('>> CARGO PRESSURE — hostile trace converging on high-value salvage.');
    }
  } else if (rand() < 0.18) {
    triggerCombatAmbush = true;
    logLines.push('>> CARGO ECHO AMBUSH — feral imprint defending the cache.');
  }

  const echoRunState = recordEchoResolved(
    recordEchoRewardsExtracted(
      withOperationProgress(
        inc.echoRunState ?? createDefaultEchoRunState(),
        ECHO_OPERATION_PROGRESS.recoverEchoCargo,
        isEchoRecovery,
      ),
      stagedIds.length,
    ),
    { cargoEchoesRecovered: (inc.echoRunState?.cargoEchoesRecovered ?? 0) + 1 },
  );

  return {
    logLines,
    echoRunState,
    cargo,
    triggerCombatAmbush,
    operationProgressDelta: isEchoRecovery ? ECHO_OPERATION_PROGRESS.recoverEchoCargo : 0,
  };
}

function findExtractionRevealTargets(
  tree: ProceduralRunTree,
  inc: ActiveIncursionState,
): string[] {
  const available = new Set(getAvailableProceduralNodeIds(inc));
  return Object.values(tree.nodes)
    .filter((node) => node.type === 'EXTRACTION' && available.has(node.id))
    .map((node) => node.id);
}

export function resolveExtractionEcho(
  inc: ActiveIncursionState,
  engagedNode: IncursionNode,
): EchoResolutionResult {
  const isEchoRecovery = isEchoRecoveryActive(inc);
  const logLines: string[] = ['>> EXTRACTION ECHO — prior runner evac route traced.'];
  const revealedSonarNodeIds: string[] = [];

  const tree = inc.proceduralRunTree;
  if (tree) {
    const extractionIds = findExtractionRevealTargets(tree, inc);
    if (extractionIds.length > 0) {
      extractionIds.forEach((id) => {
        if (!inc.revealedSonarNodeIds.includes(id)) {
          revealedSonarNodeIds.push(id);
        }
      });
      logLines.push(`>> ROUTE REVEALED — ${extractionIds.length} extraction vector(s) illuminated.`);
    } else {
      const childIds = tree.nodes[engagedNode.id]?.children ?? [];
      childIds.forEach((childId) => {
        if (!inc.revealedSonarNodeIds.includes(childId)) {
          revealedSonarNodeIds.push(childId);
        }
      });
      if (childIds.length > 0) {
        logLines.push('>> ROUTE REVEALED — downstream vectors illuminated.');
      }
    }
  }

  logLines.push('>> EMERGENCY RECALL — extraction echo shaves hazard from evac review.');

  const echoRunState = recordEchoResolved(
    recordEchoRewardsExtracted(
      withOperationProgress(
        inc.echoRunState ?? createDefaultEchoRunState(),
        ECHO_OPERATION_PROGRESS.extractionEchoUsed,
        isEchoRecovery,
      ),
      0,
    ),
    {
      extractionEchoesUsed: (inc.echoRunState?.extractionEchoesUsed ?? 0) + 1,
      extractionRecallBonusPending: true,
    },
  );

  return {
    logLines,
    echoRunState,
    revealedSonarNodeIds,
    operationProgressDelta: isEchoRecovery ? ECHO_OPERATION_PROGRESS.extractionEchoUsed : 0,
  };
}

export function resolveEchoFallenRunnerChoice(
  choice: NarrativeChoiceKey,
  inc: ActiveIncursionState,
  seed: string,
): EchoResolutionResult {
  const isEchoRecovery = isEchoRecoveryActive(inc);
  const logLines: string[] = [];
  const stagedIds: string[] = [];
  let cargo = inc.cargo;
  let runCreditsDelta = 0;
  let triggerCombatAmbush = false;
  let operationProgressDelta = 0;
  let patch: Partial<EchoRunState> = {};

  if (choice === 'D') {
    logLines.push('>> ECHO LEFT UNDISTURBED — no salvage taken.');
    return {
      logLines,
      echoRunState: recordEchoResolved(inc.echoRunState ?? createDefaultEchoRunState(), {}),
    };
  }

  if (choice === 'B') {
    cargo = grantResourceToCargo(cargo, 'echo-glass-shard', 1, stagedIds);
    logLines.push('>> ECHO LOOTED — 1× Echo-Glass Shard secured.');
    patch.fallenEchoesLooted = (inc.echoRunState?.fallenEchoesLooted ?? 0) + 1;
    operationProgressDelta = isEchoRecovery ? ECHO_OPERATION_PROGRESS.resolveFallenRunner : 0;

    const rand = seededRandom(`echo-fallen-loot:${seed}`);
    if (rand() < 0.35) {
      cargo = grantResourceToCargo(cargo, 'tarnished-dog-tags', 1, stagedIds);
      logLines.push('>> TAGS RECOVERED — 1× Tarnished Dog Tags.');
    }
    if (rand() < 0.08) {
      cargo = grantResourceToCargo(cargo, 'smugglers-ledger', 1, stagedIds);
      logLines.push('>> LEDGER RECOVERED — 1× Smuggler\'s Ledger.');
    }
    if (rand() < 0.25) {
      runCreditsDelta = 15 + Math.floor(rand() * 20);
      logLines.push(`>> IMPRINT PAYOUT — +${runCreditsDelta} run credits.`);
    }
    if (rand() < 0.28) {
      triggerCombatAmbush = true;
      logLines.push('>> ECHO AMBUSH — looting disturbed a feral memory-shadow.');
    }
  } else if (choice === 'C') {
    const hasLeySlag = inc.cargo.grid.placed.some((item) => item.itemId === 'ley-slag')
      || inc.cargo.containment.some((item) => item.itemId === 'ley-slag');
    if (!hasLeySlag) {
      logLines.push('>> STABILIZATION FAILED — Ley-Slag offering required in cargo.');
      return {
        logLines,
        echoRunState: inc.echoRunState ?? createDefaultEchoRunState(),
      };
    }

    const leyPlaced = inc.cargo.grid.placed.find((item) => item.itemId === 'ley-slag');
    if (leyPlaced) {
      cargo = {
        ...cargo,
        grid: {
          placed: cargo.grid.placed.filter((item) => item.instanceId !== leyPlaced.instanceId),
        },
      };
    } else {
      const leyContainment = cargo.containment.find((item) => item.itemId === 'ley-slag');
      if (leyContainment) {
        cargo = {
          ...cargo,
          containment: cargo.containment.filter((item) => item.instanceId !== leyContainment.instanceId),
        };
      }
    }

    cargo = grantResourceToCargo(cargo, 'echo-glass-shard', 1, stagedIds);
    patch.echoesStabilized = (inc.echoRunState?.echoesStabilized ?? 0) + 1;
    operationProgressDelta = isEchoRecovery ? ECHO_OPERATION_PROGRESS.stabilizeEcho : 0;
    logLines.push('>> ECHO STABILIZED — 1× Ley-Slag spent; imprint archived.');
    if (isEchoRecovery) {
      logLines.push('>> ECHO RECOVERY — stabilization credited to operation progress.');
    }
  } else {
    logLines.push('>> ECHO RESOLVER — no action taken.');
    return {
      logLines,
      echoRunState: inc.echoRunState ?? createDefaultEchoRunState(),
    };
  }

  const echoRunState = recordEchoResolved(
    recordEchoRewardsExtracted(
      withOperationProgress(
        inc.echoRunState ?? createDefaultEchoRunState(),
        operationProgressDelta,
        isEchoRecovery,
      ),
      stagedIds.length,
    ),
    patch,
  );

  return {
    logLines,
    echoRunState,
    cargo,
    runCreditsDelta,
    triggerCombatAmbush,
    operationProgressDelta,
  };
}

export function echoKindRequiresCombat(kind: EchoEncounterKind): boolean {
  return kind === 'HOSTILE_ECHO';
}

export function echoKindUsesNarrative(kind: EchoEncounterKind): boolean {
  return kind === 'FALLEN_RUNNER_ECHO';
}

export function echoKindResolvesImmediately(kind: EchoEncounterKind): boolean {
  return kind === 'ASSIST_ECHO' || kind === 'CARGO_ECHO' || kind === 'EXTRACTION_ECHO';
}
