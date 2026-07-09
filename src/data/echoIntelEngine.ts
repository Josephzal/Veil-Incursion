import type { RunGenerationContext, OperationObjectiveKind, SectorState } from '../types/worldState';
import { formatEchoActivity } from '../utils/veilFrontBriefingUi';
import { ECHO_OPERATION_PROGRESS } from './echoRunState';

/** Scanner bezel + briefing copy for echo-aware runs. */
export function formatEchoScannerTelemetry(
  runContext: RunGenerationContext | null | undefined,
): string[] {
  if (!runContext) return [];

  const lines: string[] = [];
  const { echoActivity, activeOperation } = runContext.sectorState;

  if (activeOperation.objectiveKind === 'ECHO_RECOVERY') {
    lines.push('> ECHO RECOVERY ACTIVE — seek Echo Signal vectors.');
  } else if (echoActivity === 'ELEVATED' || echoActivity === 'CRITICAL') {
    lines.push(`> ECHO ACTIVITY: ${formatEchoActivity(echoActivity).toUpperCase()}`);
  }

  return lines;
}

export function formatEchoRecoveryContributionHints(): string[] {
  return [
    `Stabilize fallen runner (+${ECHO_OPERATION_PROGRESS.stabilizeEcho})`,
    `Defeat hostile echo (+${ECHO_OPERATION_PROGRESS.defeatHostileEcho})`,
    `Loot fallen imprint (+${ECHO_OPERATION_PROGRESS.resolveFallenRunner})`,
    `Recover echo cargo (+${ECHO_OPERATION_PROGRESS.recoverEchoCargo})`,
    `Use extraction echo (+${ECHO_OPERATION_PROGRESS.extractionEchoUsed})`,
  ];
}

export function formatEchoOperationContributionHints(
  objectiveKind: OperationObjectiveKind,
): string[] {
  if (objectiveKind === 'ECHO_RECOVERY') {
    return formatEchoRecoveryContributionHints();
  }
  return [];
}

export function formatEchoDeployBriefingLine(sector: SectorState): string | null {
  const { activeOperation, echoActivity } = sector;

  if (activeOperation.objectiveKind === 'ECHO_RECOVERY') {
    return 'Echo Recovery — Echo Signal nodes advance community progress on extract.';
  }
  if (echoActivity === 'CRITICAL') {
    return 'Critical echo bleed — residual runner signatures likely this run.';
  }
  if (echoActivity === 'ELEVATED') {
    return 'Elevated echo activity — watch for Echo Signal overlays on scanner.';
  }
  return null;
}

export function formatEchoSectorIntelLines(sector: SectorState): string[] {
  const lines: string[] = [];
  const briefing = formatEchoDeployBriefingLine(sector);
  if (briefing) {
    lines.push(briefing);
  }
  if (sector.activeOperation.objectiveKind === 'ECHO_RECOVERY') {
    lines.push('Resolve Echo Signals for operation credit on successful extraction.');
  }
  return lines;
}
