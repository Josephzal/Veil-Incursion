import type { ActiveIncursionState, IncursionNode } from '../types/game';
import type { ProceduralRunTree } from '../types/proceduralRunTree';
import type { KeepsakeRuntime } from '../types/expeditionKeepsake';
import { createDefaultActiveIncursionState } from '../types/game';
import { createKeepsakeRuntime } from './keepsakeRunState';
import {
  applyKeepsakeOnRunStart,
  initializeKeepsakeRuntime,
  tryKeepsakeTrigger,
} from './expeditionKeepsakeEngine';
import { applyKeepsakeOnSafeExtractionSkip } from './expeditionKeepsakeEconomyEngine';
import { applyKeepsakeScannerLayerEffects } from './expeditionKeepsakeScannerEngine';
import { applyKeepsakeDeadDropHarvestBonus } from './expeditionKeepsakeCargoEngine';
import { applyKeepsakePhaseDOnNodeSelected, applyKeepsakePhaseDOnRunStart } from './expeditionKeepsakePhaseDEngine';
import { buildKeepsakeDebriefSummary } from './runDebriefKeepsakeEngine';
import { buildKeepsakeLiveCounters } from './expeditionKeepsakeRunUiEngine';
import { createDefaultCargoRunState } from '../types/cargoGrid';
import type { KeepsakeValidationIssue } from './expeditionKeepsakeValidation';

const MATCHBOOK_MAX_MATCHES = 4;

function issue(
  severity: KeepsakeValidationIssue['severity'],
  message: string,
  keepsakeId?: KeepsakeValidationIssue['keepsakeId'],
): KeepsakeValidationIssue {
  return { severity, message, keepsakeId };
}

function createAcceptanceScannerTree(): ProceduralRunTree {
  return {
    nodes: {
      'd1-resource': {
        id: 'd1-resource',
        depth: 1,
        type: 'RESOURCE',
        children: ['d2-resource'],
        typeAssigned: true,
      },
      'd1-combat': {
        id: 'd1-combat',
        depth: 1,
        type: 'COMBAT',
        children: ['d2-combat'],
        typeAssigned: true,
      },
      'd2-resource': {
        id: 'd2-resource',
        depth: 2,
        type: 'RESOURCE',
        children: [],
        typeAssigned: true,
      },
      'd2-combat': {
        id: 'd2-combat',
        depth: 2,
        type: 'COMBAT',
        children: [],
        typeAssigned: true,
      },
    },
    depthIndex: {
      1: ['d1-resource', 'd1-combat'],
      2: ['d2-resource', 'd2-combat'],
    },
    bossNodeId: 'boss',
    maxDepth: 15,
    rollSeed: 9001,
  };
}

function createAcceptanceIncursion(
  keepsakeId: KeepsakeRuntime['keepsakeId'] | null,
  nodesCleared: number,
): ActiveIncursionState {
  return {
    ...createDefaultActiveIncursionState(),
    isRunActive: true,
    nodesCleared,
    proceduralRunTree: createAcceptanceScannerTree(),
    keepsakeRuntime: keepsakeId ? createKeepsakeRuntime(keepsakeId) : null,
    cargo: createDefaultCargoRunState(),
  };
}

function countDeadDropNodes(tree: ProceduralRunTree): number {
  return Object.values(tree.nodes).filter((node) => node.contextModifiers?.keepsakeDeadDrop).length;
}

function countAnchorTrailNodes(tree: ProceduralRunTree): number {
  return Object.values(tree.nodes).filter((node) => node.contextModifiers?.anchorSignal).length;
}

/** Last Light Matchbook — cannot light more than four matches per run. */
export function validateMatchbookMaxFourGuard(): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];
  let runtime = createKeepsakeRuntime('last_light_matchbook');
  let triggerCountAfterFour = 0;

  for (let attempt = 0; attempt < MATCHBOOK_MAX_MATCHES + 1; attempt += 1) {
    const result = applyKeepsakeOnSafeExtractionSkip(runtime);
    if (!result.runtime) {
      issues.push(issue('error', 'Matchbook skip returned null runtime during acceptance simulation.', 'last_light_matchbook'));
      return issues;
    }
    runtime = result.runtime;
    if (attempt === MATCHBOOK_MAX_MATCHES) {
      triggerCountAfterFour = runtime.stats.triggerCount;
    }
  }

  const matches = runtime.counters.matches ?? 0;
  if (matches !== MATCHBOOK_MAX_MATCHES) {
    issues.push(issue(
      'error',
      `Matchbook guard failed — expected ${MATCHBOOK_MAX_MATCHES} matches lit, found ${matches}.`,
      'last_light_matchbook',
    ));
  }
  if (triggerCountAfterFour > MATCHBOOK_MAX_MATCHES) {
    issues.push(issue(
      'error',
      `Matchbook guard failed — trigger count ${triggerCountAfterFour} exceeds max ${MATCHBOOK_MAX_MATCHES}.`,
      'last_light_matchbook',
    ));
  }

  return issues;
}

/** Dead-Drop Receiver — first HV conversion fires once per run. */
export function validateDeadDropRunGuard(): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];
  let runtime = createKeepsakeRuntime('dead_drop_receiver');

  const first = tryKeepsakeTrigger(runtime, 'dead_drop_receiver_first_hv', 'run');
  const second = tryKeepsakeTrigger(first.runtime ?? runtime, 'dead_drop_receiver_first_hv', 'run');

  if (!first.triggered) {
    issues.push(issue('error', 'Dead-Drop primary trigger did not fire on first attempt.', 'dead_drop_receiver'));
  }
  if (second.triggered) {
    issues.push(issue('error', 'Dead-Drop primary trigger fired twice — run guard broken.', 'dead_drop_receiver'));
  }

  return issues;
}

/** Dead-Drop harvest bonus choice queues once per run. */
export function validateDeadDropHarvestBonusGuard(): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];
  const node: IncursionNode = {
    id: 'cache-node',
    encounterIndex: 0,
    index: 0,
    encounterType: 'RESOURCE_HARVEST',
    type: 'RESOURCE_HARVEST',
    label: 'Dead Drop Cache',
    isCompleted: false,
    contextModifiers: {
      depthStage: 'THRESHOLD',
      nodePressureBand: 'MEDIUM',
      keepsakeDeadDrop: true,
    },
  };
  const staged: string[] = [];
  let runtime = createKeepsakeRuntime('dead_drop_receiver');

  const first = applyKeepsakeDeadDropHarvestBonus(runtime, createDefaultCargoRunState(), node, staged);
  const second = applyKeepsakeDeadDropHarvestBonus(
    first.runtime,
    first.cargo,
    node,
    staged,
  );

  if (!first.runtime?.pendingChoice) {
    issues.push(issue('error', 'Dead-Drop harvest bonus did not queue its choice modal.', 'dead_drop_receiver'));
  }
  if (second.runtime !== first.runtime && second.logLines.length > 0) {
    issues.push(issue('error', 'Dead-Drop harvest bonus fired more than once per run.', 'dead_drop_receiver'));
  }

  return issues;
}

/** Anchor Charm — trail staging starts once per run across scanner depths. */
export function validateAnchorTrailRunGuard(): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];
  let runtime = createKeepsakeRuntime('anchor_charm');

  const first = tryKeepsakeTrigger(runtime, 'anchor_charm_trail_started', 'run');
  const second = tryKeepsakeTrigger(first.runtime ?? runtime, 'anchor_charm_trail_started', 'run');

  if (!first.triggered) {
    issues.push(issue('error', 'Anchor trail start trigger did not fire on first attempt.', 'anchor_charm'));
  }
  if (second.triggered) {
    issues.push(issue('error', 'Anchor trail start trigger fired twice — run guard broken.', 'anchor_charm'));
  }

  return issues;
}

/** Scanner layer — Dead-Drop HV conversion applies to one node total per run. */
export function validateDeadDropScannerSingleConversion(): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];
  const depthOne = createAcceptanceIncursion('dead_drop_receiver', 0);
  const depthTwo = createAcceptanceIncursion('dead_drop_receiver', 1);

  const firstPass = applyKeepsakeScannerLayerEffects(depthOne);
  const secondPass = applyKeepsakeScannerLayerEffects({
    ...depthTwo,
    keepsakeRuntime: firstPass.runtime,
    proceduralRunTree: firstPass.incursion.proceduralRunTree,
  });

  const tree = secondPass.incursion.proceduralRunTree;
  if (!tree) {
    issues.push(issue('error', 'Dead-Drop scanner acceptance missing procedural tree.', 'dead_drop_receiver'));
    return issues;
  }

  const deadDropNodes = countDeadDropNodes(tree);
  if (deadDropNodes !== 1) {
    issues.push(issue(
      'error',
      `Dead-Drop scanner guard failed — expected 1 cache node, found ${deadDropNodes}.`,
      'dead_drop_receiver',
    ));
  }
  if (secondPass.logLines.some((line) => line.includes('DEAD-DROP RECEIVER'))) {
    issues.push(issue(
      'error',
      'Dead-Drop scanner re-logged primary trigger on a second depth.',
      'dead_drop_receiver',
    ));
  }

  return issues;
}

/** Scanner layer — Anchor trail harmonic stages once even when depth advances. */
export function validateAnchorTrailScannerSingleStart(): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];
  const depthOne = createAcceptanceIncursion('anchor_charm', 0);
  const depthTwo = createAcceptanceIncursion('anchor_charm', 1);

  const firstPass = applyKeepsakeScannerLayerEffects(depthOne);
  const secondPass = applyKeepsakeScannerLayerEffects({
    ...depthTwo,
    keepsakeRuntime: firstPass.runtime,
    proceduralRunTree: firstPass.incursion.proceduralRunTree,
  });

  const tree = secondPass.incursion.proceduralRunTree;
  if (!tree) {
    issues.push(issue('error', 'Anchor trail scanner acceptance missing procedural tree.', 'anchor_charm'));
    return issues;
  }

  const anchorNodes = countAnchorTrailNodes(tree);
  if (anchorNodes !== 1) {
    issues.push(issue(
      'error',
      `Anchor trail scanner guard failed — expected 1 harmonic node, found ${anchorNodes}.`,
      'anchor_charm',
    ));
  }
  if (secondPass.logLines.some((line) => line.includes('Anchor trail harmonic staged'))) {
    issues.push(issue(
      'error',
      'Anchor trail restaged on a second scanner depth.',
      'anchor_charm',
    ));
  }

  return issues;
}

/** Depth guard — per-depth relics cannot double-fire at the same depth. */
export function validateDepthGuardNoDuplicateSameDepth(): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];
  const inc = createAcceptanceIncursion('false_evac_beacon', 0);
  let runtime = inc.keepsakeRuntime!;

  const first = applyKeepsakePhaseDOnNodeSelected(inc, 'd1-combat', runtime);
  runtime = first.runtime ?? runtime;
  const second = applyKeepsakePhaseDOnNodeSelected(inc, 'd1-resource', runtime);

  const depthKey = 'false_evac_beacon_depth_plant:1';
  const depthUsed = Boolean(runtime?.triggersUsed[depthKey] ?? second.runtime?.triggersUsed[depthKey]);
  if (!depthUsed) {
    issues.push(issue('error', 'False Evac depth trigger did not record per-depth guard.', 'false_evac_beacon'));
  }
  if (second.logLines.some((line) => line.includes('Choose a false evac signal'))) {
    issues.push(issue(
      'error',
      'False Evac beacon queued twice at the same depth.',
      'false_evac_beacon',
    ));
  }

  return issues;
}

/** Runs without an equipped relic remain no-ops across core hooks. */
export function validateKeepsakeNoRelicRegression(): KeepsakeValidationIssue[] {
  const issues: KeepsakeValidationIssue[] = [];
  const inc = createAcceptanceIncursion(null, 0);

  if (initializeKeepsakeRuntime(null) !== null) {
    issues.push(issue('error', 'initializeKeepsakeRuntime(null) should return null.'));
  }

  const runStart = applyKeepsakeOnRunStart(null);
  if (runStart.runtime !== null || runStart.logLines.length > 0) {
    issues.push(issue('error', 'applyKeepsakeOnRunStart(null) should be a silent no-op.'));
  }

  const phaseDStart = applyKeepsakePhaseDOnRunStart(null, null);
  if (phaseDStart.runtime !== null || phaseDStart.logLines.length > 0) {
    issues.push(issue('error', 'applyKeepsakePhaseDOnRunStart(null) should be a silent no-op.'));
  }

  const scanner = applyKeepsakeScannerLayerEffects(inc);
  if (scanner.runtime !== null || scanner.logLines.length > 0) {
    issues.push(issue('error', 'applyKeepsakeScannerLayerEffects without relic should not mutate runtime.'));
  }

  if (buildKeepsakeDebriefSummary(null) !== null) {
    issues.push(issue('error', 'buildKeepsakeDebriefSummary(null) should return null.'));
  }

  if (buildKeepsakeLiveCounters(null).length > 0) {
    issues.push(issue('error', 'buildKeepsakeLiveCounters(null) should return an empty list.'));
  }

  return issues;
}

/** Consolidated duplication-guard acceptance scenarios. */
export function validateExpeditionKeepsakeAcceptance(): KeepsakeValidationIssue[] {
  return [
    ...validateMatchbookMaxFourGuard(),
    ...validateDeadDropRunGuard(),
    ...validateDeadDropHarvestBonusGuard(),
    ...validateAnchorTrailRunGuard(),
    ...validateDeadDropScannerSingleConversion(),
    ...validateAnchorTrailScannerSingleStart(),
    ...validateDepthGuardNoDuplicateSameDepth(),
    ...validateKeepsakeNoRelicRegression(),
  ];
}

export function formatKeepsakeAcceptanceReport(issues: KeepsakeValidationIssue[]): string {
  if (issues.length === 0) {
    return 'EXPEDITION RELIC ACCEPTANCE — OK (0 issues).';
  }
  const errors = issues.filter((issueEntry) => issueEntry.severity === 'error');
  const warns = issues.filter((issueEntry) => issueEntry.severity === 'warn');
  return [
    'EXPEDITION RELIC ACCEPTANCE',
    `errors: ${errors.length}`,
    `warnings: ${warns.length}`,
    ...issues.map((issueEntry) => (
      `[${issueEntry.severity.toUpperCase()}] ${issueEntry.keepsakeId ?? 'global'} — ${issueEntry.message}`
    )),
  ].join('\n');
}
