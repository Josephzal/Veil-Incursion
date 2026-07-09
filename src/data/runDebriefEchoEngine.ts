import type { ActiveIncursionState } from '../types/game';
import type { RunResourceLedger } from '../types/runResourceLedger';
import {
  createDefaultEchoRunState,
  ECHO_OPERATION_PROGRESS,
  type EchoRunState,
} from './echoRunState';
import { getResourceDisplayName } from './resourceRegistry';

export interface EchoDebriefContributionLine {
  label: string;
  progress: number;
}

export interface EchoGlassResolution {
  extracted: number;
  banked: number;
  lost: number;
}

export interface EchoDebriefSummary {
  signalsDiscovered: number;
  signalsResolved: number;
  hostileEchoesDefeated: number;
  cargoEchoesRecovered: number;
  fallenEchoesLooted: number;
  echoesStabilized: number;
  assistEchoesTriggered: number;
  extractionEchoesUsed: number;
  echoGlassRecovered: number;
  echoCreditsRecovered: number;
  echoRewardsExtracted: number;
  echoOperationProgress: number;
  contributionLines: EchoDebriefContributionLine[];
  glassResolution: EchoGlassResolution;
  isEchoRecoveryOperation: boolean;
}

function resolveEchoGlassFromLedger(ledger: RunResourceLedger): EchoGlassResolution {
  return {
    extracted: ledger.extracted['echo-glass-shard'] ?? 0,
    banked: ledger.bankedAtSafehouse['echo-glass-shard'] ?? 0,
    lost: ledger.lostOnDeath['echo-glass-shard'] ?? 0,
  };
}

function buildContributionLines(
  state: EchoRunState,
  isEchoRecoveryOperation: boolean,
): EchoDebriefContributionLine[] {
  if (!isEchoRecoveryOperation) return [];

  const lines: EchoDebriefContributionLine[] = [];
  const push = (label: string, count: number, perEvent: number) => {
    if (count <= 0 || perEvent <= 0) return;
    lines.push({
      label: count > 1 ? `${label} (${count})` : label,
      progress: perEvent * count,
    });
  };

  push('Fallen runner imprint looted', state.fallenEchoesLooted, ECHO_OPERATION_PROGRESS.resolveFallenRunner);
  push('Fallen runner stabilized', state.echoesStabilized, ECHO_OPERATION_PROGRESS.stabilizeEcho);
  push('Hostile echo defeated', state.hostileEchoesDefeated, ECHO_OPERATION_PROGRESS.defeatHostileEcho);
  push('Echo cargo recovered', state.cargoEchoesRecovered, ECHO_OPERATION_PROGRESS.recoverEchoCargo);
  push('Extraction echo used', state.extractionEchoesUsed, ECHO_OPERATION_PROGRESS.extractionEchoUsed);

  return lines;
}

function hasEchoActivity(state: EchoRunState, glass: EchoGlassResolution): boolean {
  return state.echoSignalsDiscovered > 0
    || state.echoSignalsResolved > 0
    || state.hostileEchoesDefeated > 0
    || state.cargoEchoesRecovered > 0
    || state.fallenEchoesLooted > 0
    || state.echoesStabilized > 0
    || state.assistEchoesTriggered > 0
    || state.extractionEchoesUsed > 0
    || state.echoGlassRecovered > 0
    || state.echoCreditsRecovered > 0
    || state.echoRewardsExtracted > 0
    || glass.extracted + glass.banked + glass.lost > 0;
}

export function buildEchoDebriefSummary(
  incursion: ActiveIncursionState,
): EchoDebriefSummary | null {
  const state = incursion.echoRunState ?? createDefaultEchoRunState();
  const glassResolution = resolveEchoGlassFromLedger(incursion.runResourceLedger);
  if (!hasEchoActivity(state, glassResolution)) return null;

  const isEchoRecoveryOperation =
    incursion.runGenerationContext?.activeOperation.objectiveKind === 'ECHO_RECOVERY';

  return {
    signalsDiscovered: state.echoSignalsDiscovered,
    signalsResolved: state.echoSignalsResolved,
    hostileEchoesDefeated: state.hostileEchoesDefeated,
    cargoEchoesRecovered: state.cargoEchoesRecovered,
    fallenEchoesLooted: state.fallenEchoesLooted,
    echoesStabilized: state.echoesStabilized,
    assistEchoesTriggered: state.assistEchoesTriggered,
    extractionEchoesUsed: state.extractionEchoesUsed,
    echoGlassRecovered: state.echoGlassRecovered,
    echoCreditsRecovered: state.echoCreditsRecovered,
    echoRewardsExtracted: state.echoRewardsExtracted,
    echoOperationProgress: state.echoOperationProgress,
    contributionLines: buildContributionLines(state, isEchoRecoveryOperation),
    glassResolution,
    isEchoRecoveryOperation,
  };
}

export function formatEchoDebriefContributionLine(line: EchoDebriefContributionLine): string {
  return `${line.label}: +${line.progress} Operation Progress`;
}

export function formatEchoGlassResolutionLine(
  kind: keyof EchoGlassResolution,
  quantity: number,
): string | null {
  if (quantity <= 0) return null;
  const label = getResourceDisplayName('echo-glass-shard', true).toUpperCase();
  switch (kind) {
    case 'extracted':
      return `${quantity}× ${label} extracted`;
    case 'banked':
      return `${quantity}× ${label} banked at safehouse`;
    case 'lost':
      return `${quantity}× ${label} lost on death`;
    default:
      return null;
  }
}
