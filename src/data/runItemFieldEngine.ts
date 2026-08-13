import type { CargoItemId, CargoRunState } from '../types/cargoGrid';
import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import type { ActiveIncursionState } from '../types/game';
import type { ProceduralRunTree } from '../types/proceduralRunTree';
import type {
  RunItemAshSealState,
  RunItemFieldChoice,
  RunItemId,
  RunItemRuntime,
} from '../types/runItem';
import type { UnstableCargoEffectId } from '../types/unstableCargoEffects';
import { UNSTABLE_CARRIED_EFFECT_IDS } from '../types/unstableCargoEffects';
import { ensureNodeContextModifiersAtEngagement } from './lazyNodeContextEngine';
import { resolveActiveDepthIdentityScanBias } from './depthIdentityEngine';
import { getAvailableProceduralNodeIds } from './proceduralScannerBridge';
import { patchKeepsakeNodeModifiers } from './expeditionKeepsakeRouteEngine';
import { countPhysicalCargoResource } from './unstableCargoEffectsEngine';
import { getRunItemDefinition } from './runItemRegistry';
import {
  consumeSupplyInstance,
  findSupplyInstance,
  hasSupplyInstance,
} from './cargoSupplyEngine';
import { mergeRunItemRuntime, recordRunItemTrigger, recordSupplyUse } from './runItemRunState';
import { rollBlackMarketStock } from './blackMarket';
import {
  buildAnchorNeedleFieldChoice,
  buildEchoTuningForkFieldChoice,
} from './runItemFieldChoiceEngine';

export interface RunItemFieldUseOutcome {
  success: boolean;
  logLine: string;
  supplyRuntime?: RunItemRuntime;
  cargo?: CargoRunState;
  blackMarketStock?: CargoItemId[];
  revealedSonarNodeIds?: readonly string[];
  runCredits?: number;
  bankedValue?: number;
  proceduralRunTree?: ProceduralRunTree;
  requisitionFullyInterpretedNodeIds?: readonly string[];
  pendingFieldChoice?: RunItemFieldChoice | null;
}

function consumeField(
  cargo: CargoRunState,
  itemId: RunItemId,
  runtime: RunItemRuntime,
  triggerText: string,
): { cargo: CargoRunState; runtime: RunItemRuntime } | null {
  const instance = findSupplyInstance(cargo, itemId);
  if (!instance) return null;
  const consumed = consumeSupplyInstance(cargo, instance.instanceId);
  if (!consumed) return null;
  return {
    cargo: consumed.cargo,
    runtime: recordSupplyUse(recordRunItemTrigger(runtime, triggerText), itemId),
  };
}

export function hasFieldRunItem(cargo: CargoRunState, itemId: RunItemId): boolean {
  return hasSupplyInstance(cargo, itemId);
}

/** Sonar-Ping — reveal one scanner node; consume from field slot. */
export function useSonarPingFieldTool(
  incursion: Pick<ActiveIncursionState, 'cargo' | 'supplyRuntime' | 'revealedSonarNodeIds'>,
  nodeId: string,
): RunItemFieldUseOutcome {
  const itemId: RunItemId = 'sonar-ping';
  const def = getRunItemDefinition(itemId);
  if (!hasFieldRunItem(incursion.cargo, itemId)) {
    return { success: false, logLine: '[REJECTED] >> No Sonar-Ping in Field Tool slots.' };
  }
  if (incursion.revealedSonarNodeIds.includes(nodeId)) {
    return { success: false, logLine: '[REJECTED] >> Sonar trace already mapped for this vector.' };
  }
  const consumed = consumeField(incursion.cargo, itemId, incursion.supplyRuntime, def.triggerText);
  if (!consumed) {
    return { success: false, logLine: '[REJECTED] >> Sonar-Ping consume failed.' };
  }
  const noise = consumed.runtime.scannerNoise + 1;
  let runtime = mergeRunItemRuntime(consumed.runtime, {
    scannerNoise: noise,
    stats: {
      ...consumed.runtime.stats,
      scannerRevealsByItems: consumed.runtime.stats.scannerRevealsByItems + 1,
      riskAddedByItems: consumed.runtime.stats.riskAddedByItems + (noise >= 2 ? 1 : 0),
    },
  });
  if (noise >= 2) {
    runtime = recordRunItemTrigger(runtime, 'SONAR-PING // Scanner noise detected.');
  }
  return {
    success: true,
    logLine: `>> ${def.triggerText}`,
    cargo: consumed.cargo,
    supplyRuntime: runtime,
    revealedSonarNodeIds: [...incursion.revealedSonarNodeIds, nodeId],
  };
}

/** Dead-Drop Token — bank first containment item (non-apex). */
export function useDeadDropTokenFieldTool(
  incursion: Pick<ActiveIncursionState, 'cargo' | 'supplyRuntime' | 'cargo'>,
): RunItemFieldUseOutcome {
  const itemId: RunItemId = 'dead-drop-token';
  const def = getRunItemDefinition(itemId);
  if (!hasFieldRunItem(incursion.cargo, itemId)) {
    return { success: false, logLine: '[REJECTED] >> No Dead-Drop Token in Field Tool slots.' };
  }
  const containment = incursion.cargo.containment[0];
  if (!containment) {
    return { success: false, logLine: '[REJECTED] >> Dead-Drop Token requires cargo in containment.' };
  }
  const apexBlocked = containment.itemId === 'anomalous-core'
    || containment.itemId === 'sealed-containment-casket';
  if (apexBlocked) {
    return { success: false, logLine: '[REJECTED] >> Dead-Drop Token cannot bank Apex cargo.' };
  }
  const consumed = consumeField(incursion.cargo, itemId, incursion.supplyRuntime, def.triggerText);
  if (!consumed) {
    return { success: false, logLine: '[REJECTED] >> Dead-Drop Token consume failed.' };
  }
  const value = containment.currentValue ?? CARGO_ITEM_CATALOG[containment.itemId]?.baseValue ?? 0;
  const nextCargo: CargoRunState = {
    ...consumed.cargo,
    containment: consumed.cargo.containment.filter((c) => c.instanceId !== containment.instanceId),
  };
  const runtime = mergeRunItemRuntime(consumed.runtime, {
    deadDropRiskPending: true,
    stats: {
      ...consumed.runtime.stats,
      cargoBankedByItems: consumed.runtime.stats.cargoBankedByItems + 1,
      riskAddedByItems: consumed.runtime.stats.riskAddedByItems + 1,
    },
  });
  return {
    success: true,
    logLine: `>> ${def.triggerText} ${CARGO_ITEM_CATALOG[containment.itemId]?.name ?? containment.itemId} secured (+${value} CR value).`,
    cargo: nextCargo,
    supplyRuntime: recordRunItemTrigger(runtime, 'DEAD-DROP TOKEN // Routing signature exposed.'),
    bankedValue: value,
  };
}

/** Broker Flashcard — reroll black market stock; mark one listing cheaper. */
export function useBrokerFlashcardFieldTool(
  incursion: Pick<ActiveIncursionState, 'cargo' | 'supplyRuntime' | 'blackMarketStock'>,
): RunItemFieldUseOutcome {
  const itemId: RunItemId = 'broker-flashcard';
  const def = getRunItemDefinition(itemId);
  if (!hasFieldRunItem(incursion.cargo, itemId)) {
    return { success: false, logLine: '[REJECTED] >> No Broker Flashcard in Field Tool slots.' };
  }
  if (incursion.blackMarketStock.length === 0) {
    return { success: false, logLine: '[REJECTED] >> No Black Market inventory to spoof.' };
  }
  const consumed = consumeField(incursion.cargo, itemId, incursion.supplyRuntime, def.triggerText);
  if (!consumed) {
    return { success: false, logLine: '[REJECTED] >> Broker Flashcard consume failed.' };
  }
  const nextStock = rollBlackMarketStock();
  const marked = nextStock.find((id) => id !== 'soul-core') ?? nextStock[0] ?? null;
  const runtime = mergeRunItemRuntime(consumed.runtime, {
    brokerMarkedItemId: marked,
    stats: {
      ...consumed.runtime.stats,
      creditsSavedByItems: consumed.runtime.stats.creditsSavedByItems,
    },
  });
  return {
    success: true,
    logLine: `>> ${def.triggerText}${marked ? ` Broker-Marked: ${CARGO_ITEM_CATALOG[marked]?.name ?? marked}.` : ''}`,
    cargo: consumed.cargo,
    supplyRuntime: runtime,
    blackMarketStock: nextStock,
  };
}

/** Relay Spike — plant on a non-boss node id (pending modifier). */
export function useRelaySpikeFieldTool(
  incursion: Pick<ActiveIncursionState, 'cargo' | 'supplyRuntime'>,
  nodeId: string,
  isBossNode: boolean,
): RunItemFieldUseOutcome {
  const itemId: RunItemId = 'relay-spike';
  const def = getRunItemDefinition(itemId);
  if (!hasFieldRunItem(incursion.cargo, itemId)) {
    return { success: false, logLine: '[REJECTED] >> No Relay Spike in Field Tool slots.' };
  }
  if (isBossNode) {
    return { success: false, logLine: '[REJECTED] >> Relay Spike cannot modify boss nodes.' };
  }
  const consumed = consumeField(incursion.cargo, itemId, incursion.supplyRuntime, def.triggerText);
  if (!consumed) {
    return { success: false, logLine: '[REJECTED] >> Relay Spike consume failed.' };
  }
  const runtime = mergeRunItemRuntime(
    recordRunItemTrigger(consumed.runtime, 'RELAY SPIKE // Relay noise bleeding into future route.'),
    {
      pendingRelayModifier: {
        plantedNodeId: nodeId,
        relayAction: null,
      },
      stats: {
        ...consumed.runtime.stats,
        riskAddedByItems: consumed.runtime.stats.riskAddedByItems + 1,
      },
    },
  );
  return {
    success: true,
    logLine: `>> ${def.triggerText}`,
    cargo: consumed.cargo,
    supplyRuntime: runtime,
  };
}

/** Generic field-tool consume for tools that need UI choice before effect (echo/anchor/etc). */
export function beginFieldToolChoice(
  incursion: Pick<ActiveIncursionState, 'cargo' | 'supplyRuntime'>,
  itemId: RunItemId,
): RunItemFieldUseOutcome {
  const def = getRunItemDefinition(itemId);
  if (def.family !== 'FIELD_TOOL') {
    return { success: false, logLine: '[REJECTED] >> Not a field tool.' };
  }
  if (!hasFieldRunItem(incursion.cargo, itemId)) {
    return { success: false, logLine: `[REJECTED] >> ${def.name} not in Field Tool slots.` };
  }
  return {
    success: true,
    logLine: `>> ${def.name.toUpperCase()} READY — select mode.`,
  };
}

export function getBrokerMarkedDiscountPrice(basePrice: number, marked: boolean): number {
  if (!marked) return basePrice;
  return Math.max(1, Math.floor(basePrice * 0.65));
}

const APEX_CARGO_IDS = new Set<CargoItemId>(['anomalous-core', 'sealed-containment-casket']);

function isApexCargoItem(itemId: CargoItemId): boolean {
  return APEX_CARGO_IDS.has(itemId);
}

function firstUnstableEffectInCargo(
  cargo: CargoRunState,
): UnstableCargoEffectId | null {
  return UNSTABLE_CARRIED_EFFECT_IDS.find(
    (resourceId) => countPhysicalCargoResource(cargo, resourceId) > 0,
  ) ?? null;
}

/** Null-Lens Filter — fully interpret one visible scanner node. */
export function useNullLensFieldTool(
  incursion: Pick<
    ActiveIncursionState,
    'cargo' | 'supplyRuntime' | 'proceduralRunTree' | 'runGenerationContext'
    | 'cargo' | 'requisitionFullyInterpretedNodeIds' | 'depthIdentity' | 'currentDistrict'
  >,
  nodeId: string,
): RunItemFieldUseOutcome {
  const itemId: RunItemId = 'null-lens-filter';
  const def = getRunItemDefinition(itemId);
  if (!hasFieldRunItem(incursion.cargo, itemId)) {
    return { success: false, logLine: '[REJECTED] >> No Null-Lens Filter in Field Tool slots.' };
  }
  if (!incursion.proceduralRunTree?.nodes[nodeId]) {
    return { success: false, logLine: '[REJECTED] >> Invalid Null-Lens target.' };
  }
  if (incursion.requisitionFullyInterpretedNodeIds.includes(nodeId)) {
    return { success: false, logLine: '[REJECTED] >> Node signature already fully interpreted.' };
  }
  const availableIds = getAvailableProceduralNodeIds(incursion as ActiveIncursionState);
  if (!availableIds.includes(nodeId)) {
    return { success: false, logLine: '[REJECTED] >> Null-Lens target not on current depth layer.' };
  }

  const consumed = consumeField(incursion.cargo, itemId, incursion.supplyRuntime, def.triggerText);
  if (!consumed) {
    return { success: false, logLine: '[REJECTED] >> Null-Lens Filter consume failed.' };
  }

  const depthIndex = (incursion.currentDistrict as 1 | 2 | 3) ?? 1;
  const rolled = ensureNodeContextModifiersAtEngagement(
    incursion.proceduralRunTree,
    nodeId,
    incursion.runGenerationContext,
    incursion.cargo,
    resolveActiveDepthIdentityScanBias(incursion.depthIdentity, depthIndex),
    incursion.depthIdentity,
  );

  const interpretedIds = incursion.requisitionFullyInterpretedNodeIds.includes(nodeId)
    ? incursion.requisitionFullyInterpretedNodeIds
    : [...incursion.requisitionFullyInterpretedNodeIds, nodeId];

  const runtime = mergeRunItemRuntime(consumed.runtime, {
    stats: {
      ...consumed.runtime.stats,
      scannerRevealsByItems: consumed.runtime.stats.scannerRevealsByItems + 1,
    },
  });

  return {
    success: true,
    logLine: `>> ${def.triggerText}`,
    cargo: consumed.cargo,
    supplyRuntime: runtime,
    proceduralRunTree: rolled.tree,
    requisitionFullyInterpretedNodeIds: interpretedIds,
  };
}

/** Ash-Seal Canister — dampen one unstable cargo downside until depth transition. */
export function useAshSealFieldTool(
  incursion: Pick<ActiveIncursionState, 'cargo' | 'supplyRuntime' | 'cargo' | 'currentDepth'>,
  targetEffectId?: UnstableCargoEffectId,
): RunItemFieldUseOutcome {
  const itemId: RunItemId = 'ash-seal-canister';
  const def = getRunItemDefinition(itemId);
  if (!hasFieldRunItem(incursion.cargo, itemId)) {
    return { success: false, logLine: '[REJECTED] >> No Ash-Seal Canister in Field Tool slots.' };
  }
  if (incursion.supplyRuntime.ashSeal) {
    return { success: false, logLine: '[REJECTED] >> Ash-Seal already active on unstable payload.' };
  }
  const effectId = targetEffectId ?? firstUnstableEffectInCargo(incursion.cargo);
  if (!effectId) {
    return { success: false, logLine: '[REJECTED] >> Ash-Seal requires unstable cargo in inventory.' };
  }

  const consumed = consumeField(incursion.cargo, itemId, incursion.supplyRuntime, def.triggerText);
  if (!consumed) {
    return { success: false, logLine: '[REJECTED] >> Ash-Seal Canister consume failed.' };
  }

  const ashSeal: RunItemAshSealState = {
    targetEffectId: effectId,
    armedAtDepth: incursion.currentDepth,
    cracked: false,
  };
  const runtime = mergeRunItemRuntime(consumed.runtime, {
    ashSeal,
    stats: {
      ...consumed.runtime.stats,
      unstablePenaltiesReducedByItems: consumed.runtime.stats.unstablePenaltiesReducedByItems + 1,
    },
  });

  const label = CARGO_ITEM_CATALOG[effectId]?.name ?? effectId;
  return {
    success: true,
    logLine: `>> ${def.triggerText} Target: ${label}.`,
    cargo: consumed.cargo,
    supplyRuntime: runtime,
  };
}

/** Containment Foam — protect one non-apex cargo item from the next loss event. */
export function useContainmentFoamFieldTool(
  incursion: Pick<ActiveIncursionState, 'cargo' | 'supplyRuntime' | 'cargo'>,
  instanceId: string,
): RunItemFieldUseOutcome {
  const itemId: RunItemId = 'containment-foam';
  const def = getRunItemDefinition(itemId);
  if (!hasFieldRunItem(incursion.cargo, itemId)) {
    return { success: false, logLine: '[REJECTED] >> No Containment Foam in Field Tool slots.' };
  }
  if (incursion.supplyRuntime.foamedCargoInstanceId) {
    return { success: false, logLine: '[REJECTED] >> Containment Foam already applied.' };
  }

  const target = incursion.cargo.containment.find((c) => c.instanceId === instanceId)
    ?? incursion.cargo.grid.placed.find((c) => c.instanceId === instanceId);
  if (!target) {
    return { success: false, logLine: '[REJECTED] >> Foam target not found in cargo.' };
  }
  if (isApexCargoItem(target.itemId)) {
    return { success: false, logLine: '[REJECTED] >> Containment Foam cannot protect Apex cargo.' };
  }

  const consumed = consumeField(incursion.cargo, itemId, incursion.supplyRuntime, def.triggerText);
  if (!consumed) {
    return { success: false, logLine: '[REJECTED] >> Containment Foam consume failed.' };
  }

  const runtime = mergeRunItemRuntime(consumed.runtime, {
    foamedCargoInstanceId: instanceId,
    stats: {
      ...consumed.runtime.stats,
      cargoPreservedByItems: consumed.runtime.stats.cargoPreservedByItems + 1,
    },
  });

  const label = CARGO_ITEM_CATALOG[target.itemId]?.name ?? target.itemId;
  return {
    success: true,
    logLine: `>> ${def.triggerText} ${label} foamed.`,
    cargo: consumed.cargo,
    supplyRuntime: runtime,
  };
}

/** Ley-Slag Splitter — arm +2 stable resource rolls for current harvest. */
export function useLeySlagSplitterFieldTool(
  incursion: Pick<ActiveIncursionState, 'cargo' | 'supplyRuntime'>,
): RunItemFieldUseOutcome {
  const itemId: RunItemId = 'ley-slag-splitter';
  const def = getRunItemDefinition(itemId);
  if (!hasFieldRunItem(incursion.cargo, itemId)) {
    return { success: false, logLine: '[REJECTED] >> No Ley-Slag Splitter in Field Tool slots.' };
  }
  if (incursion.supplyRuntime.leySlagSplitterArmed) {
    return { success: false, logLine: '[REJECTED] >> Ley-Slag Splitter already armed.' };
  }

  const consumed = consumeField(incursion.cargo, itemId, incursion.supplyRuntime, def.triggerText);
  if (!consumed) {
    return { success: false, logLine: '[REJECTED] >> Ley-Slag Splitter consume failed.' };
  }

  const runtime = mergeRunItemRuntime(consumed.runtime, {
    leySlagSplitterArmed: true,
    stats: {
      ...consumed.runtime.stats,
      resourceBonusRollsByItems: consumed.runtime.stats.resourceBonusRollsByItems + 2,
      riskAddedByItems: consumed.runtime.stats.riskAddedByItems + 1,
    },
  });

  return {
    success: true,
    logLine: `>> ${def.triggerText}`,
    cargo: consumed.cargo,
    supplyRuntime: runtime,
  };
}

/** Apply dead-drop route risk on next combat engage. */
export function applyDeadDropRouteRisk(
  inc: Pick<ActiveIncursionState, 'supplyRuntime' | 'proceduralRunTree'>,
): { runtime: RunItemRuntime; tree: ProceduralRunTree | null; logLine: string | null } {
  if (!inc.supplyRuntime.deadDropRiskPending || !inc.proceduralRunTree) {
    return { runtime: inc.supplyRuntime, tree: inc.proceduralRunTree ?? null, logLine: null };
  }

  const candidates = getAvailableProceduralNodeIds(inc as ActiveIncursionState).filter((id) => {
    const node = inc.proceduralRunTree!.nodes[id];
    return node?.type !== 'GATEKEEPER';
  });
  const riskNode = candidates[0];
  let tree = inc.proceduralRunTree;
  if (riskNode) {
    tree = patchKeepsakeNodeModifiers(tree, riskNode, { highRisk: true });
  }

  const runtime = mergeRunItemRuntime(inc.supplyRuntime, {
    deadDropRiskPending: false,
    stats: {
      ...inc.supplyRuntime.stats,
      riskAddedByItems: inc.supplyRuntime.stats.riskAddedByItems + 1,
    },
  });

  return {
    runtime,
    tree,
    logLine: riskNode
      ? '>> DEAD-DROP TOKEN // Routing signature exposed — HIGH RISK injected on route.'
      : '>> DEAD-DROP TOKEN // Routing signature exposed.',
  };
}

/** Crack ash-seal after dirty extraction; clear on depth transition. */
export function crackRunItemAshSealOnDirtyExtract(runtime: RunItemRuntime): RunItemRuntime {
  if (!runtime.ashSeal || runtime.ashSeal.cracked) return runtime;
  return mergeRunItemRuntime(runtime, {
    ashSeal: { ...runtime.ashSeal, cracked: true },
  });
}

export function clearRunItemAshSealOnDepthTransition(runtime: RunItemRuntime): RunItemRuntime {
  if (!runtime.ashSeal) return runtime;
  return mergeRunItemRuntime(runtime, { ashSeal: null });
}

/** Break containment foam instead of losing cargo. */
export function breakRunItemContainmentFoam(runtime: RunItemRuntime): RunItemRuntime {
  if (!runtime.foamedCargoInstanceId) return runtime;
  return mergeRunItemRuntime(runtime, { foamedCargoInstanceId: null });
}

export function isRunItemFoamProtected(runtime: RunItemRuntime, instanceId: string): boolean {
  return runtime.foamedCargoInstanceId === instanceId;
}

/** Defer scanner engage until echo/anchor field-tool mode is chosen. */
export function tryDeferEngageForFieldToolChoice(
  inc: Pick<ActiveIncursionState, 'cargo' | 'supplyRuntime'>,
  nodeId: string,
  nodeType: string | null | undefined,
  contextModifiers: ActiveIncursionState['encounterPath'][number]['contextModifiers'] | null | undefined,
): RunItemFieldUseOutcome {
  if (inc.supplyRuntime.pendingFieldChoice) {
    return { success: false, logLine: '[REJECTED] >> Resolve pending field-tool choice first.' };
  }

  const isEcho = Boolean(contextModifiers?.echoSignal || contextModifiers?.echoEncounterKind);
  const isAnchor = Boolean(contextModifiers?.anchorSignal);

  if (isEcho && hasSupplyInstance(inc.cargo, 'echo-tuning-fork') && !inc.supplyRuntime.echoTuningMode) {
    return {
      success: true,
      logLine: '>> ECHO TUNING FORK — select frequency.',
      pendingFieldChoice: buildEchoTuningForkFieldChoice(nodeId),
    };
  }

  if (isAnchor && hasSupplyInstance(inc.cargo, 'anchor-needle') && !inc.supplyRuntime.anchorNeedleMode) {
    return {
      success: true,
      logLine: '>> ANCHOR NEEDLE — select mode.',
      pendingFieldChoice: buildAnchorNeedleFieldChoice(nodeId),
    };
  }

  if (nodeType === 'NARRATIVE_EVENT' && isEcho) {
    return { success: false, logLine: '' };
  }

  return { success: false, logLine: '' };
}
