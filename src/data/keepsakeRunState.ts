import type {
  KeepsakeId,
  KeepsakeRuntime,
  KeepsakeRuntimeStats,
} from '../types/expeditionKeepsake';

export function createDefaultKeepsakeRuntimeStats(): KeepsakeRuntimeStats {
  return {
    nodeDetailsRevealed: 0,
    futureNodesPreviewed: 0,
    bonusResourcesGenerated: 0,
    unstablePenaltiesReduced: 0,
    creditsSaved: 0,
    creditsDeferred: 0,
    extractionDebtPaid: 0,
    cargoValueBonus: 0,
    cargoPreserved: 0,
    operationProgressAdded: 0,
    sponsorRepBonus: 0,
    echoSignalsGenerated: 0,
    echoGlassBonus: 0,
    staminaPreserved: 0,
    safehouseServiceUsed: null,
    harmonicNodesGenerated: 0,
    narrativeResolversSpoofed: 0,
    triggerCount: 0,
  };
}

export function createKeepsakeRuntime(keepsakeId: KeepsakeId): KeepsakeRuntime {
  return {
    keepsakeId,
    triggersUsed: {},
    perDepthTriggersUsed: {},
    messages: [],
    stats: createDefaultKeepsakeRuntimeStats(),
    taggedCargo: [],
    cargoTagByResource: {},
    leySiphonOverdrawPending: false,
    markedShelfItemId: null,
    markedShelfCorruptedNodeId: null,
    nullLedgerDebtCredits: 0,
    nullLedgerCreditItemId: null,
    stampedExtractionNodeId: null,
    stampedExtractionConfirmed: false,
    overextendedActive: false,
    overextendedBonusConsumed: false,
    overextendedDirtyThreatPending: false,
    rustedFlareShieldPending: false,
    rustedFlareCargoProtectionAvailable: false,
    safehouseCoinServicePending: false,
    safehouseCoinServiceUsed: null,
    safehouseCoinRouteCargoBonus: false,
    safehouseCoinNextDepthPreviewType: null,
    safehouseCoinStabilizePayloadActive: false,
    wellFedCombatsRemaining: 0,
  };
}

export function mergeKeepsakeRuntime(
  runtime: KeepsakeRuntime | null | undefined,
  patch: Partial<KeepsakeRuntime>,
): KeepsakeRuntime | null {
  if (!runtime) return null;
  return {
    ...runtime,
    ...patch,
    triggersUsed: { ...runtime.triggersUsed, ...patch.triggersUsed },
    perDepthTriggersUsed: patch.perDepthTriggersUsed ?? runtime.perDepthTriggersUsed,
    messages: patch.messages ?? runtime.messages,
    stats: { ...runtime.stats, ...patch.stats },
    taggedCargo: patch.taggedCargo ?? runtime.taggedCargo,
    cargoTagByResource: patch.cargoTagByResource ?? runtime.cargoTagByResource,
    leySiphonOverdrawPending: patch.leySiphonOverdrawPending ?? runtime.leySiphonOverdrawPending,
    markedShelfItemId: patch.markedShelfItemId ?? runtime.markedShelfItemId,
    markedShelfCorruptedNodeId: patch.markedShelfCorruptedNodeId ?? runtime.markedShelfCorruptedNodeId,
    nullLedgerDebtCredits: patch.nullLedgerDebtCredits ?? runtime.nullLedgerDebtCredits,
    nullLedgerCreditItemId: patch.nullLedgerCreditItemId ?? runtime.nullLedgerCreditItemId,
    stampedExtractionNodeId: patch.stampedExtractionNodeId ?? runtime.stampedExtractionNodeId,
    stampedExtractionConfirmed: patch.stampedExtractionConfirmed ?? runtime.stampedExtractionConfirmed,
    overextendedActive: patch.overextendedActive ?? runtime.overextendedActive,
    overextendedBonusConsumed: patch.overextendedBonusConsumed ?? runtime.overextendedBonusConsumed,
    overextendedDirtyThreatPending: patch.overextendedDirtyThreatPending ?? runtime.overextendedDirtyThreatPending,
    rustedFlareShieldPending: patch.rustedFlareShieldPending ?? runtime.rustedFlareShieldPending,
    rustedFlareCargoProtectionAvailable: patch.rustedFlareCargoProtectionAvailable ?? runtime.rustedFlareCargoProtectionAvailable,
    safehouseCoinServicePending: patch.safehouseCoinServicePending ?? runtime.safehouseCoinServicePending,
    safehouseCoinServiceUsed: patch.safehouseCoinServiceUsed ?? runtime.safehouseCoinServiceUsed,
    safehouseCoinRouteCargoBonus: patch.safehouseCoinRouteCargoBonus ?? runtime.safehouseCoinRouteCargoBonus,
    safehouseCoinNextDepthPreviewType: patch.safehouseCoinNextDepthPreviewType ?? runtime.safehouseCoinNextDepthPreviewType,
    safehouseCoinStabilizePayloadActive: patch.safehouseCoinStabilizePayloadActive ?? runtime.safehouseCoinStabilizePayloadActive,
    wellFedCombatsRemaining: patch.wellFedCombatsRemaining ?? runtime.wellFedCombatsRemaining,
  };
}

export function patchKeepsakeStats(
  runtime: KeepsakeRuntime,
  patch: Partial<KeepsakeRuntimeStats>,
): KeepsakeRuntime {
  return {
    ...runtime,
    stats: { ...runtime.stats, ...patch },
  };
}

export function recordKeepsakeTrigger(
  runtime: KeepsakeRuntime,
  triggerKey: string,
  message: string,
  depth?: number,
): KeepsakeRuntime {
  const nextTriggersUsed = { ...runtime.triggersUsed, [triggerKey]: true };
  const nextPerDepth = { ...runtime.perDepthTriggersUsed };
  if (depth !== undefined) {
    nextPerDepth[depth] = { ...(nextPerDepth[depth] ?? {}), [triggerKey]: true };
  }
  const messages = runtime.messages.includes(message)
    ? runtime.messages
    : [...runtime.messages, message];
  return {
    ...runtime,
    triggersUsed: nextTriggersUsed,
    perDepthTriggersUsed: nextPerDepth,
    messages,
    stats: {
      ...runtime.stats,
      triggerCount: runtime.stats.triggerCount + 1,
    },
  };
}

export function canUseKeepsakeTrigger(
  runtime: KeepsakeRuntime,
  triggerKey: string,
  guard: 'run' | 'depth' | 'none',
  depth?: number,
): boolean {
  if (guard === 'none') return true;
  if (guard === 'run') return !runtime.triggersUsed[triggerKey];
  if (guard === 'depth' && depth !== undefined) {
    return !runtime.perDepthTriggersUsed[depth]?.[triggerKey];
  }
  return !runtime.triggersUsed[triggerKey];
}

export function formatKeepsakeRuntimeDebugSnapshot(runtime: KeepsakeRuntime | null | undefined): string {
  if (!runtime) return 'KEEPSAKE RUNTIME — none equipped.';
  const lines = [
    'KEEPSAKE RUNTIME',
    `id: ${runtime.keepsakeId}`,
    `triggers: ${runtime.stats.triggerCount}`,
    `messages: ${runtime.messages.length}`,
    ...Object.entries(runtime.stats)
      .filter(([, value]) => typeof value === 'number' && value > 0)
      .map(([key, value]) => `${key}: ${value}`),
    ...(runtime.stats.safehouseServiceUsed
      ? [`safehouseServiceUsed: ${runtime.stats.safehouseServiceUsed}`]
      : []),
  ];
  runtime.messages.forEach((message) => lines.push(`- ${message}`));
  return lines.join('\n');
}
