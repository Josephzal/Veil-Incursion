import type {
  RequisitionCombatPreparationRuntime,
  RequisitionDecision as KeepsakeDecision,
  RequisitionDeployment,
  RequisitionId,
  RequisitionRuntime as KeepsakeRuntime,
  RequisitionRuntimeStats as KeepsakeRuntimeStats,
} from '../types/expeditionRequisition';

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
    cargoBankedByRequisition: 0,
    sponsorRepBonus: 0,
    contrabandWrapped: 0,
    markedShelfPurchases: 0,
    debtWarningsTriggered: 0,
    startingCreditsGranted: 0,
    eligibleCombatEncountersConsumed: 0,
    temporaryApGranted: 0,
    directHostileDamagePrevented: 0,
    attributableCriticalHits: 0,
    empoweredPiercingActions: 0,
    armorLayersBypassed: 0,
    wardLayersBypassed: 0,
    hostileEffectsPrevented: 0,
    triggerCount: 0,
  };
}

export function createDefaultKeepsakeDeployment(): RequisitionDeployment {
  return {
    attunement: null,
    routeDoctrine: null,
  };
}

function createCombatPreparationRuntime(
  requisitionId: RequisitionId,
): RequisitionCombatPreparationRuntime | null {
  switch (requisitionId) {
    case 'adrenaline_primer':
      return {
        kind: requisitionId,
        consumedEncounterIds: [],
        grantedEncounterIds: [],
        apGranted: 0,
      };
    case 'reinforced_trench_coat':
      return {
        kind: requisitionId,
        protectedEncounterId: null,
        protectionSpent: false,
        damagePrevented: 0,
      };
    case 'hollow_point_requisition':
      return {
        kind: requisitionId,
        depthOneExpired: false,
        attributableCriticalHits: 0,
      };
    case 'kinetic_battery':
      return {
        kind: requisitionId,
        consumedEncounterIds: [],
        empoweredActionIds: [],
        bypassedArmorLayers: 0,
        bypassedWardLayers: 0,
      };
    case 'chalk_line_ward':
      return {
        kind: requisitionId,
        protectedEncounterIds: [],
        currentEncounterId: null,
        currentWardAvailable: false,
        preventedEffectIds: [],
      };
    default:
      return null;
  }
}

export function createKeepsakeRuntime(
  requisitionId: RequisitionId,
  deployment?: Partial<RequisitionDeployment> | null,
): KeepsakeRuntime {
  return {
    requisitionId,
    deployment: { ...createDefaultKeepsakeDeployment(), ...(deployment ?? {}) },
    triggersUsed: {},
    perDepthTriggersUsed: {},
    perEncounterTriggersUsed: {},
    messages: [],
    decisions: [],
    flags: {},
    counters: {},
    stats: createDefaultKeepsakeRuntimeStats(),
    taggedCargo: [],
    cargoTagByResource: {},
    markedShelfItemId: null,
    markedShelfCorruptedNodeId: null,
    nullLedgerDebtCredits: 0,
    nullLedgerCreditItemId: null,
    stampedExtractionNodeId: null,
    stampedExtractionConfirmed: false,
    pendingChoice: null,
    cargoSealCracked: false,
    smugglersHunterMarkActive: false,
    extractionTokenBurns: 0,
    combatPreparation: createCombatPreparationRuntime(requisitionId),
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
    perEncounterTriggersUsed:
      patch.perEncounterTriggersUsed ?? runtime.perEncounterTriggersUsed,
    messages: patch.messages ?? runtime.messages,
    decisions: patch.decisions ?? runtime.decisions,
    flags: patch.flags ? { ...runtime.flags, ...patch.flags } : runtime.flags,
    counters: patch.counters ? { ...runtime.counters, ...patch.counters } : runtime.counters,
    stats: { ...runtime.stats, ...patch.stats },
    taggedCargo: patch.taggedCargo ?? runtime.taggedCargo,
    cargoTagByResource: patch.cargoTagByResource ?? runtime.cargoTagByResource,
    markedShelfItemId: patch.markedShelfItemId ?? runtime.markedShelfItemId,
    markedShelfCorruptedNodeId: patch.markedShelfCorruptedNodeId ?? runtime.markedShelfCorruptedNodeId,
    nullLedgerDebtCredits: patch.nullLedgerDebtCredits ?? runtime.nullLedgerDebtCredits,
    nullLedgerCreditItemId: patch.nullLedgerCreditItemId ?? runtime.nullLedgerCreditItemId,
    stampedExtractionNodeId: patch.stampedExtractionNodeId ?? runtime.stampedExtractionNodeId,
    stampedExtractionConfirmed: patch.stampedExtractionConfirmed ?? runtime.stampedExtractionConfirmed,
    pendingChoice: patch.pendingChoice !== undefined ? patch.pendingChoice : runtime.pendingChoice,
    cargoSealCracked: patch.cargoSealCracked ?? runtime.cargoSealCracked,
    smugglersHunterMarkActive: patch.smugglersHunterMarkActive ?? runtime.smugglersHunterMarkActive,
    extractionTokenBurns: patch.extractionTokenBurns ?? runtime.extractionTokenBurns,
    combatPreparation:
      patch.combatPreparation !== undefined
        ? patch.combatPreparation
        : runtime.combatPreparation,
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
  if (!runtime) return 'EXPEDITION REQUISITION RUNTIME — none equipped.';
  const lines = [
    'EXPEDITION REQUISITION RUNTIME',
    `id: ${runtime.requisitionId}`,
    ...(runtime.deployment.attunement ? [`attunement: ${runtime.deployment.attunement}`] : []),
    ...(runtime.deployment.routeDoctrine ? [`routeDoctrine: ${runtime.deployment.routeDoctrine}`] : []),
    `triggers: ${runtime.stats.triggerCount}`,
    `messages: ${runtime.messages.length}`,
    ...(runtime.decisions.length > 0
      ? [`decisions: ${runtime.decisions.map((d) => `${d.label}=${d.value}`).join('; ')}`]
      : []),
    ...Object.entries(runtime.stats)
      .filter(([, value]) => typeof value === 'number' && value > 0)
      .map(([key, value]) => `${key}: ${value}`),
  ];
  runtime.messages.forEach((message) => lines.push(`- ${message}`));
  return lines.join('\n');
}
