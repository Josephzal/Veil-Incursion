import type { ClassType } from '../types/game';
import type { EchoEncounterKind } from '../types/echoEncounter';
import type { NodeContextModifiers } from '../types/worldState';
import type { ProceduralRunTree } from '../types/proceduralRunTree';
import type { EchoRunState } from './echoRunState';
import { createDefaultEchoRunState } from './echoRunState';
import { buildEchoDebriefSummary } from './runDebriefEchoEngine';
import type { ActiveIncursionState } from '../types/game';
import { getEchoEliteTemplate } from './echoEliteCatalog';
import {
  canPlaceEchoOverlay,
  createEchoOverlay,
  isEchoOverlayNodeTypeEligible,
  recordEchoOverlayPlacement,
} from './echoEncounterEngine';
import { pickEchoTemplateForNode } from './echoRecoveryEngine';
import { validateEchoEncounterPipeline } from './echoValidation';
import type { NodeModifierRollState } from '../types/worldState';
import type { RunGenerationContext } from '../types/worldState';
import { getDepthStage } from './worldStateHelpers';

export interface DevEchoForceRequest {
  forceOverlayOnNextLayer?: boolean;
  encounterKind?: EchoEncounterKind;
  hostileTemplateId?: string;
  sourceClass?: ClassType;
}

let pendingEchoForce: DevEchoForceRequest | null = null;

export function devQueueEchoForce(request: DevEchoForceRequest): void {
  pendingEchoForce = { ...pendingEchoForce, ...request };
}

export function devClearEchoForce(): void {
  pendingEchoForce = null;
}

export function devPeekEchoForce(): DevEchoForceRequest | null {
  return pendingEchoForce;
}

export function devConsumeEchoOverlayForce(): boolean {
  if (!pendingEchoForce?.forceOverlayOnNextLayer) return false;
  pendingEchoForce = {
    ...pendingEchoForce,
    forceOverlayOnNextLayer: false,
  };
  if (!pendingEchoForce.encounterKind
    && !pendingEchoForce.hostileTemplateId
    && !pendingEchoForce.sourceClass) {
    pendingEchoForce = null;
  }
  return true;
}

export function devConsumeEchoEngagementForce(): DevEchoForceRequest | null {
  if (!pendingEchoForce) return null;
  const { forceOverlayOnNextLayer, ...engagement } = pendingEchoForce;
  if (forceOverlayOnNextLayer) {
    pendingEchoForce = { forceOverlayOnNextLayer };
    if (!engagement.encounterKind && !engagement.hostileTemplateId && !engagement.sourceClass) {
      return null;
    }
    return engagement;
  }
  pendingEchoForce = null;
  return engagement;
}

export function devApplyForcedEchoOverlay(
  tree: ProceduralRunTree,
  depth: number,
  isEchoRecoveryOp: boolean,
): ProceduralRunTree {
  if (!devConsumeEchoOverlayForce() || tree.rollSeed == null || tree.modifierRollState == null) {
    return tree;
  }

  const layerIds = tree.depthIndex[depth] ?? [];
  const rollState: NodeModifierRollState = {
    echoSignalsUsed: tree.modifierRollState.echoSignalsUsed,
    legendaryEchoUsed: tree.modifierRollState.legendaryEchoUsed,
    echoSignalsByDepth: { ...tree.modifierRollState.echoSignalsByDepth },
  };

  const nodes = { ...tree.nodes };
  const targetId = layerIds.find((nodeId) => {
    const node = nodes[nodeId];
    return node
      && !node.echoOverlay
      && !node.contextModifiers?.echoSignal
      && isEchoOverlayNodeTypeEligible(node.type)
      && canPlaceEchoOverlay(rollState, depth, isEchoRecoveryOp);
  });

  if (!targetId) return tree;

  recordEchoOverlayPlacement(rollState, depth);
  nodes[targetId] = {
    ...nodes[targetId]!,
    echoOverlay: createEchoOverlay(`dev-force:${depth}:${targetId}`),
  };

  return {
    ...tree,
    nodes,
    modifierRollState: rollState,
  };
}

export function devApplyForcedEchoEncounter(
  modifiers: NodeContextModifiers,
  depthIndex: 1 | 2 | 3,
  nodeType: import('../types/proceduralRunTree').ProceduralNodeType,
  runContext: RunGenerationContext | null | undefined,
  resolutionSeed: string,
  rollState: NodeModifierRollState,
): NodeContextModifiers {
  const force = devConsumeEchoEngagementForce();
  if (!force || !modifiers.echoSignal) return modifiers;

  const depthStage = modifiers.depthStage ?? getDepthStage(depthIndex);
  const sourceClass = force.sourceClass ?? 'AEGIS';
  const snapshot = {
    echoRarity: depthIndex === 3 ? 'CORRUPTED' as const : 'COMMON' as const,
    sourceClass,
  };

  const kind = force.encounterKind ?? 'HOSTILE_ECHO';
  if (kind !== 'HOSTILE_ECHO') {
    return {
      ...modifiers,
      echoEncounterKind: kind,
      echoSnapshot: snapshot,
    };
  }

  const forcedTemplate = force.hostileTemplateId
    ? getEchoEliteTemplate(force.hostileTemplateId)
    : null;
  const template = forcedTemplate ?? pickEchoTemplateForNode(
    depthIndex,
    depthStage,
    resolutionSeed,
    depthIndex >= 3,
    sourceClass,
  );

  if (!template) {
    return {
      ...modifiers,
      echoEncounterKind: kind,
      echoSnapshot: snapshot,
    };
  }

  if (template.tier === 'LEGENDARY') {
    rollState.legendaryEchoUsed += 1;
  }

  const alignedSnapshot = template.isClassEcho && template.sourceClass
    ? { ...snapshot, sourceClass: template.sourceClass }
    : snapshot;

  return {
    ...modifiers,
    echoEncounterKind: kind,
    echoTemplateId: template.id,
    echoTier: template.tier,
    echoSnapshot: alignedSnapshot,
  };
}

export function formatEchoRunStateSnapshot(state: EchoRunState | undefined): string {
  const echo = state ?? createDefaultEchoRunState();
  return [
    'ECHO RUN STATE',
    `signals discovered: ${echo.echoSignalsDiscovered}`,
    `signals resolved: ${echo.echoSignalsResolved}`,
    `hostile defeated: ${echo.hostileEchoesDefeated}`,
    `cargo recovered: ${echo.cargoEchoesRecovered}`,
    `fallen looted: ${echo.fallenEchoesLooted}`,
    `stabilized: ${echo.echoesStabilized}`,
    `assist triggered: ${echo.assistEchoesTriggered}`,
    `extraction used: ${echo.extractionEchoesUsed}`,
    `operation progress: ${echo.echoOperationProgress}`,
    `echo-glass recovered: ${echo.echoGlassRecovered}`,
    `echo credits: ${echo.echoCreditsRecovered}`,
    `reward stacks extracted: ${echo.echoRewardsExtracted}`,
    `extraction recall bonus pending: ${echo.extractionRecallBonusPending ? 'yes' : 'no'}`,
  ].join('\n');
}

export function formatEchoDebriefPreview(incursion: ActiveIncursionState): string {
  const summary = buildEchoDebriefSummary(incursion);
  if (!summary) return 'ECHO DEBRIEF — no echo activity this run.';
  const lines = [
    'ECHO DEBRIEF PREVIEW',
    `signals discovered: ${summary.signalsDiscovered}`,
    `signals resolved: ${summary.signalsResolved}`,
    `hostile defeated: ${summary.hostileEchoesDefeated}`,
    `echo-glass recovered: ${summary.echoGlassRecovered}`,
    `echo operation progress: ${summary.echoOperationProgress}`,
  ];
  summary.contributionLines.forEach((line) => {
    lines.push(`${line.label}: +${line.progress}`);
  });
  if (summary.glassResolution.extracted > 0) {
    lines.push(`extracted echo-glass: ${summary.glassResolution.extracted}`);
  }
  if (summary.glassResolution.banked > 0) {
    lines.push(`banked echo-glass: ${summary.glassResolution.banked}`);
  }
  if (summary.glassResolution.lost > 0) {
    lines.push(`lost echo-glass: ${summary.glassResolution.lost}`);
  }
  return lines.join('\n');
}

export function formatEchoValidationReport(
  tree?: ProceduralRunTree | null,
): string {
  const issues = validateEchoEncounterPipeline(tree);
  if (issues.length === 0) return 'ECHO PIPELINE — no validation issues.';
  return [
    'ECHO PIPELINE VALIDATION',
    ...issues.map((issue) => `[${issue.severity.toUpperCase()}] ${issue.message}`),
  ].join('\n');
}
