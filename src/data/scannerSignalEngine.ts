import type { IncursionNode } from '../types/game';
import type { RunGenerationContext } from '../types/worldState';
import type { NodeContextModifiers } from '../types/worldState';
import type { RadarVeilSignal, ScannerSignalKind } from '../types/scannerSignals';
import { SCANNER_SIGNAL_COLORS } from '../types/scannerSignals';
import { getNodePressureBand } from './worldStateHelpers';

function anchorSignalKind(anchorStage?: NodeContextModifiers['anchorStage']): ScannerSignalKind {
  if (anchorStage === 'CORE') return 'ANCHOR_CORE';
  if (anchorStage === 'BREACH') return 'ANCHOR_BREACH';
  return 'ANCHOR_TRACE';
}

function anchorLabel(anchorStage?: NodeContextModifiers['anchorStage']): string {
  if (anchorStage === 'CORE') return 'ANCHOR CORE';
  if (anchorStage === 'BREACH') return 'ANCHOR BREACH';
  return 'ANCHOR TRACE';
}

function pressureIntensity(band: NodeContextModifiers['nodePressureBand']): number {
  if (band === 'LOW') return 0.45;
  if (band === 'MEDIUM') return 0.7;
  return 1;
}

export function resolveNodeScannerSignals(
  node: IncursionNode,
  runContext: RunGenerationContext | null | undefined,
): RadarVeilSignal[] {
  const ctx = node.contextModifiers;
  if (!ctx && !runContext) return [];

  const signals: RadarVeilSignal[] = [];
  const pressure = ctx?.nodePressureBand ?? 'MEDIUM';
  const baseIntensity = pressureIntensity(pressure);

  if (ctx?.anchorSignal) {
    const kind = anchorSignalKind(ctx.anchorStage);
    signals.push({
      kind,
      label: anchorLabel(ctx.anchorStage),
      color: SCANNER_SIGNAL_COLORS[kind],
      intensity: kind === 'ANCHOR_CORE' ? 1 : baseIntensity,
    });
  }

  if (ctx?.echoSignal) {
    signals.push({
      kind: 'ECHO_RESIDUE',
      label: 'ECHO RESIDUE',
      color: SCANNER_SIGNAL_COLORS.ECHO_RESIDUE,
      intensity: baseIntensity,
    });
  }

  if (runContext && ctx?.operationTag) {
    const op = runContext.activeOperation;
    if (op.objectiveKind === ctx.operationTag) {
      signals.push({
        kind: 'OPERATION',
        label: op.title.length > 22 ? 'OP SIGNAL' : op.title.toUpperCase(),
        color: SCANNER_SIGNAL_COLORS.OPERATION,
        intensity: 0.65,
      });
    }
  }

  if (ctx?.highRisk) {
    signals.push({
      kind: 'HIGH_RISK',
      label: 'HIGH RISK',
      color: SCANNER_SIGNAL_COLORS.HIGH_RISK,
      intensity: Math.min(1, baseIntensity + 0.15),
    });
  }

  if (ctx?.highValueResource && node.type === 'RESOURCE_HARVEST') {
    signals.push({
      kind: 'OPERATION',
      label: 'HIGH VALUE',
      color: SCANNER_SIGNAL_COLORS.OPERATION,
      intensity: 0.55,
    });
  }

  return dedupeSignals(signals);
}

function dedupeSignals(signals: RadarVeilSignal[]): RadarVeilSignal[] {
  const seen = new Set<ScannerSignalKind>();
  return signals.filter((signal) => {
    if (seen.has(signal.kind)) return false;
    seen.add(signal.kind);
    return true;
  });
}

export function formatVeilFrontSignalIntel(
  node: IncursionNode,
  runContext: RunGenerationContext | null | undefined,
): string[] {
  const signals = resolveNodeScannerSignals(node, runContext);
  if (signals.length === 0) return [];

  return signals.map((signal) => `> SIGNAL // ${signal.label}`);
}

export function primaryScannerSignalAccent(signals: readonly RadarVeilSignal[] | undefined): string | null {
  if (!signals || signals.length === 0) return null;

  const priority: ScannerSignalKind[] = [
    'ANCHOR_CORE',
    'ANCHOR_BREACH',
    'ANCHOR_TRACE',
    'HIGH_RISK',
    'ECHO_RESIDUE',
    'OPERATION',
  ];

  for (const kind of priority) {
    const match = signals.find((s) => s.kind === kind);
    if (match) return match.color;
  }

  return signals[0]?.color ?? null;
}

export function shouldShowScannerSignalOverlay(
  nodeId: string,
  opts: {
    siphonedNodeIds: readonly string[];
    selectedNodeId: string | null;
    isPreDiscovered?: boolean;
    hasSignals: boolean;
  },
): boolean {
  if (!opts.hasSignals) return false;
  if (opts.siphonedNodeIds.includes(nodeId)) return true;
  if (opts.selectedNodeId === nodeId) return true;
  if (opts.isPreDiscovered) return true;
  return false;
}

export function scannerOverlayOpacity(
  nodeId: string,
  opts: {
    siphonedNodeIds: readonly string[];
    selectedNodeId: string | null;
    isPreDiscovered?: boolean;
  },
): number {
  if (opts.siphonedNodeIds.includes(nodeId)) return 1;
  if (opts.selectedNodeId === nodeId) return 0.92;
  if (opts.isPreDiscovered) return 0.55;
  return 0;
}

/** Sector-level scanner bias readout — operation + anchor name only. */
export function formatScannerFieldTelemetry(
  runContext: RunGenerationContext | null | undefined,
): string[] {
  if (!runContext) return [];

  const lines: string[] = [];
  const anchor = runContext.activeAnchor;
  const op = runContext.activeOperation;

  if (anchor?.isActive) {
    lines.push(`> FIELD ANCHOR: ${anchor.displayName.toUpperCase()}`);
  }
  if (op.title) {
    lines.push(`> ACTIVE OPERATION: ${op.title.toUpperCase()}`);
  }

  return lines;
}
