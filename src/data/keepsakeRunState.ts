import type {
  KeepsakeDecision,
  KeepsakeDeployment,
  KeepsakeId,
  KeepsakeRuntime,
  KeepsakeRuntimeStats,
} from '../types/expeditionKeepsake';

export function createDefaultKeepsakeRuntimeStats(): KeepsakeRuntimeStats {
  return {
    nodeDetailsRevealed: 0,
    futureNodesPreviewed: 0,
    routeNodesLocked: 0,
    bonusResourcesGenerated: 0,
    unstablePenaltiesReduced: 0,
    creditsSaved: 0,
    creditsDeferred: 0,
    extractionDebtPaid: 0,
    cargoValueBonus: 0,
    cargoPreserved: 0,
    cargoBankedByTrinket: 0,
    operationProgressAdded: 0,
    sponsorRepBonus: 0,
    echoSignalsGenerated: 0,
    echoThreadGenerated: 0,
    echoIntelRevealed: 0,
    echoGlassBonus: 0,
    anchorSignalsGenerated: 0,
    anchorTrailCleared: 0,
    contaminationAdded: 0,
    contaminationPurged: 0,
    matchesLit: 0,
    safeExtractionsSkipped: 0,
    contrabandWrapped: 0,
    markedShelfPurchases: 0,
    debtWarningsTriggered: 0,
    rivalQuarriesCleared: 0,
    falseBeaconsPlanted: 0,
    keysUsed: 0,
    outsideCargoNodesCarried: 0,
    safehouseServiceUsed: null,
    triggerCount: 0,
  };
}

export function createDefaultKeepsakeDeployment(): KeepsakeDeployment {
  return {
    attunement: null,
    routeDoctrine: null,
    mirrorCategory: null,
  };
}

export function createKeepsakeRuntime(
  keepsakeId: KeepsakeId,
  deployment?: Partial<KeepsakeDeployment> | null,
): KeepsakeRuntime {
  return {
    keepsakeId,
    deployment: { ...createDefaultKeepsakeDeployment(), ...(deployment ?? {}) },
    triggersUsed: {},
    perDepthTriggersUsed: {},
    messages: [],
    decisions: [],
    flags: {},
    counters: {},
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
    pendingChoice: null,
    cargoSealCracked: false,
    smugglersHunterMarkActive: false,
    extractionTokenBurns: 0,
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
    deployment: patch.deployment ?? runtime.deployment,
    triggersUsed: { ...runtime.triggersUsed, ...patch.triggersUsed },
    perDepthTriggersUsed: patch.perDepthTriggersUsed ?? runtime.perDepthTriggersUsed,
    messages: patch.messages ?? runtime.messages,
    decisions: patch.decisions ?? runtime.decisions,
    flags: patch.flags ? { ...runtime.flags, ...patch.flags } : runtime.flags,
    counters: patch.counters ? { ...runtime.counters, ...patch.counters } : runtime.counters,
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
    pendingChoice: patch.pendingChoice !== undefined ? patch.pendingChoice : runtime.pendingChoice,
    cargoSealCracked: patch.cargoSealCracked ?? runtime.cargoSealCracked,
    smugglersHunterMarkActive: patch.smugglersHunterMarkActive ?? runtime.smugglersHunterMarkActive,
    extractionTokenBurns: patch.extractionTokenBurns ?? runtime.extractionTokenBurns,
  };
}

/** Safe numeric counter update (spec: incrementTrinketStat / counters). */
export function incrementKeepsakeCounter(
  runtime: KeepsakeRuntime,
  key: string,
  amount = 1,
): KeepsakeRuntime {
  return {
    ...runtime,
    counters: { ...runtime.counters, [key]: (runtime.counters[key] ?? 0) + amount },
  };
}

export function setKeepsakeFlag(
  runtime: KeepsakeRuntime,
  key: string,
  value: boolean,
): KeepsakeRuntime {
  return {
    ...runtime,
    flags: { ...runtime.flags, [key]: value },
  };
}

/** Record a player-facing decision for the debrief (spec: appendTrinketDecision). */
export function appendKeepsakeDecision(
  runtime: KeepsakeRuntime,
  decision: KeepsakeDecision,
): KeepsakeRuntime {
  return {
    ...runtime,
    decisions: [...runtime.decisions, decision],
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
  if (!runtime) return 'EXPEDITION RELIC RUNTIME — none equipped.';
  const lines = [
    'EXPEDITION RELIC RUNTIME',
    `id: ${runtime.keepsakeId}`,
    ...(runtime.deployment.attunement ? [`attunement: ${runtime.deployment.attunement}`] : []),
    ...(runtime.deployment.routeDoctrine ? [`routeDoctrine: ${runtime.deployment.routeDoctrine}`] : []),
    ...(runtime.deployment.mirrorCategory ? [`mirrorCategory: ${runtime.deployment.mirrorCategory}`] : []),
    `triggers: ${runtime.stats.triggerCount}`,
    `messages: ${runtime.messages.length}`,
    ...(runtime.decisions.length > 0
      ? [`decisions: ${runtime.decisions.map((d) => `${d.label}=${d.value}`).join('; ')}`]
      : []),
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
