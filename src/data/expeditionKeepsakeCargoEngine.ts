import type { CargoRunState } from '../types/cargoGrid';
import type { IncursionNode } from '../types/game';
import type {
  KeepsakeCargoTagKind,
  KeepsakeRuntime,
  KeepsakeTaggedCargoEntry,
} from '../types/expeditionKeepsake';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import { addLootToContainment } from './cargoGridEngine';
import {
  formatKeepsakeLogLine,
  tryKeepsakeTrigger,
} from './expeditionKeepsakeEngine';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';
import { patchKeepsakeStats } from './keepsakeRunState';
import {
  applyKeepsakeLeyContamination,
  buildDeadDropChoice,
  buildLeySiphonOverdrawChoice,
  buildSmugglersDoubleWrapChoice,
  clearLeyOverdrawConfirmedFlag,
  isLeyOverdrawConfirmed,
  queueKeepsakePendingChoice,
} from './expeditionKeepsakeChoiceEngine';
import {
  getResourceCategory,
} from './resourceRegistry';
import { isUnstableCargoEffectId } from '../types/unstableCargoEffects';
import type { UnstableCarriedEffectDefinition } from '../types/unstableCargoEffects';

export interface KeepsakeCargoApplyResult {
  runtime: KeepsakeRuntime | null;
  logLines: string[];
  leySiphonOverdrawPending?: boolean;
  jettisonLockedInstanceIds?: string[];
}

const CARGO_SEAL_VALUE_GROWTH_PCT = 5;
const CARGO_SEAL_VALUE_CAP_PCT = 25;
const SMUGGLERS_DOUBLE_WRAP_BONUS = 0.15;

const LEY_SIPHON_BYPRODUCTS: readonly ResourceItemId[] = [
  'veil-ash-canister',
  'anomalous-core',
  'ossified-ley-knot',
];

const DEAD_DROP_BONUS_RESOURCES: readonly ResourceItemId[] = [
  'ley-slag',
  'tarnished-dog-tags',
  'encrypted-grid-drive',
  'echo-glass-shard',
];

function pickLeySiphonByproduct(nodeId: string): ResourceItemId {
  let hash = 0;
  for (let i = 0; i < nodeId.length; i += 1) {
    hash = (hash * 31 + nodeId.charCodeAt(i)) >>> 0;
  }
  return LEY_SIPHON_BYPRODUCTS[hash % LEY_SIPHON_BYPRODUCTS.length] ?? 'veil-ash-canister';
}

function pickDeadDropBonus(nodeId: string): ResourceItemId {
  let hash = nodeId.length >>> 0;
  for (let i = 0; i < nodeId.length; i += 1) {
    hash = (hash * 37 + nodeId.charCodeAt(i)) >>> 0;
  }
  return DEAD_DROP_BONUS_RESOURCES[hash % DEAD_DROP_BONUS_RESOURCES.length] ?? 'ley-slag';
}

function tagCargoInstances(
  runtime: KeepsakeRuntime,
  resourceId: ResourceItemId,
  tag: KeepsakeCargoTagKind,
  instanceIds: readonly string[],
): KeepsakeRuntime {
  const newEntries: KeepsakeTaggedCargoEntry[] = instanceIds.map((instanceId) => ({
    instanceId,
    resourceId,
    tag,
  }));
  return {
    ...runtime,
    taggedCargo: [...runtime.taggedCargo, ...newEntries],
    cargoTagByResource: {
      ...runtime.cargoTagByResource,
      [resourceId]: tag,
    },
  };
}

export function getKeepsakeCargoTagForResource(
  runtime: KeepsakeRuntime | null | undefined,
  resourceId: ResourceItemId,
): KeepsakeCargoTagKind | null {
  return runtime?.cargoTagByResource[resourceId] ?? null;
}

export function isKeepsakeTaggedInstance(
  runtime: KeepsakeRuntime | null | undefined,
  instanceId: string,
): KeepsakeTaggedCargoEntry | null {
  if (!runtime) return null;
  return runtime.taggedCargo.find((entry) => entry.instanceId === instanceId) ?? null;
}

export function isKeepsakeJettisonBlocked(
  runtime: KeepsakeRuntime | null | undefined,
  instanceId: string,
  lockedInstanceIds: readonly string[],
): boolean {
  if (lockedInstanceIds.includes(instanceId)) return true;
  const tag = isKeepsakeTaggedInstance(runtime, instanceId);
  return tag?.tag === 'sealed';
}

export function isKeepsakeSafehouseBankBlocked(
  runtime: KeepsakeRuntime | null | undefined,
  resourceId: ResourceItemId,
): boolean {
  return getKeepsakeCargoTagForResource(runtime, resourceId) === 'wrapped';
}

export function resolveKeepsakeFenceValueMultiplier(
  runtime: KeepsakeRuntime | null | undefined,
  resourceId: ResourceItemId,
): number {
  const tag = getKeepsakeCargoTagForResource(runtime, resourceId);
  if (tag === 'wrapped') {
    let multiplier = 1.25;
    if (runtime?.smugglersHunterMarkActive) {
      multiplier += SMUGGLERS_DOUBLE_WRAP_BONUS;
    }
    return multiplier;
  }
  return 1;
}

export function resolveKeepsakeContractValueMultiplier(
  _runtime: KeepsakeRuntime | null | undefined,
  _resourceId: ResourceItemId,
): number {
  return 1;
}

/** -25% carry penalty for wrapped contraband — dampens cargo resonance excess. */
export function resolveKeepsakeCargoResonanceMultiplier(
  cargo: CargoRunState,
  runtime: KeepsakeRuntime | null | undefined,
): number {
  const hasWrappedContraband = runtime?.taggedCargo.some(
    (entry) => entry.tag === 'wrapped'
      && (
        cargo.containment.some((item) => item.instanceId === entry.instanceId)
        || cargo.grid.placed.some((item) => item.instanceId === entry.instanceId)
      ),
  );
  if (!hasWrappedContraband) return 1;
  return 0.75;
}

export function applyKeepsakeUnstableDampening(
  effects: readonly UnstableCarriedEffectDefinition[],
  runtime: KeepsakeRuntime | null | undefined,
): UnstableCarriedEffectDefinition[] {
  return dampenSealedUnstableEffects(effects, runtime);
}

export function dampenSealedUnstableEffects(
  effects: readonly UnstableCarriedEffectDefinition[],
  runtime: KeepsakeRuntime | null | undefined,
): UnstableCarriedEffectDefinition[] {
  if (!runtime) return [...effects];
  const sealedResources = new Set(
    runtime.taggedCargo
      .filter((entry) => entry.tag === 'sealed')
      .map((entry) => entry.resourceId),
  );
  if (sealedResources.size === 0) return [...effects];

  const dampenFactor = runtime.cargoSealCracked ? 0.25 : 0.5;

  return effects.map((effect) => {
    if (!sealedResources.has(effect.resourceId)) return effect;
    const mods = effect.modifiers;
    return {
      ...effect,
      modifiers: {
        ...mods,
        healReceivedMultiplier: mods.healReceivedMultiplier != null
          ? 1 - (1 - mods.healReceivedMultiplier) * dampenFactor
          : mods.healReceivedMultiplier,
        eliteWeightDelta: mods.eliteWeightDelta != null
          ? mods.eliteWeightDelta * dampenFactor
          : mods.eliteWeightDelta,
        anomalyWeightDelta: mods.anomalyWeightDelta != null
          ? mods.anomalyWeightDelta * dampenFactor
          : mods.anomalyWeightDelta,
        anchorSignalMultiplier: mods.anchorSignalMultiplier != null
          ? 1 - (mods.anchorSignalMultiplier - 1) * dampenFactor
          : mods.anchorSignalMultiplier,
      },
    };
  });
}

export function applyKeepsakeOnCargoPickup(
  runtime: KeepsakeRuntime | null,
  resourceId: ResourceItemId,
  instanceIds: readonly string[],
): KeepsakeCargoApplyResult {
  const logLines: string[] = [];
  if (!runtime || instanceIds.length === 0) {
    return { runtime, logLines };
  }

  let nextRuntime = runtime;
  const category = getResourceCategory(resourceId);

  if (
    runtime.keepsakeId === 'cargo_seal'
    && category === 'UNSTABLE'
    && isUnstableCargoEffectId(resourceId)
  ) {
    const def = getKeepsakeDefinition('cargo_seal');
    const trigger = tryKeepsakeTrigger(runtime, def.primaryTriggerKey, 'run');
    if (trigger.triggered && trigger.runtime) {
      nextRuntime = tagCargoInstances(trigger.runtime, resourceId, 'sealed', instanceIds);
      nextRuntime = patchKeepsakeStats(nextRuntime, {
        unstablePenaltiesReduced: nextRuntime.stats.unstablePenaltiesReduced + 1,
      });
      logLines.push(formatKeepsakeLogLine('Seal', def.triggerMessage));
      return {
        runtime: nextRuntime,
        logLines,
        jettisonLockedInstanceIds: [...instanceIds],
      };
    }
  }

  if (runtime.keepsakeId === 'smugglers_wrap' && category === 'CONTRABAND') {
    const def = getKeepsakeDefinition('smugglers_wrap');
    const trigger = tryKeepsakeTrigger(runtime, def.primaryTriggerKey, 'run');
    if (trigger.triggered && trigger.runtime) {
      nextRuntime = tagCargoInstances(trigger.runtime, resourceId, 'wrapped', instanceIds);
      nextRuntime = patchKeepsakeStats(nextRuntime, {
        cargoValueBonus: nextRuntime.stats.cargoValueBonus + 1,
        contrabandWrapped: nextRuntime.stats.contrabandWrapped + 1,
      });
      logLines.push(formatKeepsakeLogLine('Wrap', def.triggerMessage));
      if (!nextRuntime.pendingChoice) {
        nextRuntime = queueKeepsakePendingChoice(nextRuntime, buildSmugglersDoubleWrapChoice());
      }
      return { runtime: nextRuntime, logLines };
    }
  }

  return { runtime: nextRuntime, logLines };
}

export function applyKeepsakeOnNodeEngagedForLeySiphon(
  runtime: KeepsakeRuntime | null,
  nodeType: IncursionNode['type'],
  nodeId: string,
): KeepsakeCargoApplyResult {
  if (!runtime || runtime.keepsakeId !== 'ley_siphon_needle') {
    return { runtime, logLines: [] };
  }
  if (nodeType !== 'RESOURCE_HARVEST' && nodeType !== 'ANOMALY') {
    return { runtime, logLines: [] };
  }

  let nextRuntime: KeepsakeRuntime = {
    ...runtime,
    leySiphonOverdrawPending: true,
  };
  if (!nextRuntime.pendingChoice) {
    nextRuntime = queueKeepsakePendingChoice(nextRuntime, buildLeySiphonOverdrawChoice(nodeId));
  }

  return {
    runtime: nextRuntime,
    logLines: [],
    leySiphonOverdrawPending: true,
  };
}

export function applyKeepsakeLeySiphonOverdraw(
  runtime: KeepsakeRuntime | null,
  cargo: CargoRunState,
  nodeId: string,
  stagedInstanceIds: string[],
): {
  runtime: KeepsakeRuntime | null;
  cargo: CargoRunState;
  logLines: string[];
} {
  if (!runtime?.leySiphonOverdrawPending || runtime.keepsakeId !== 'ley_siphon_needle') {
    return { runtime, cargo, logLines: [] };
  }
  if (!isLeyOverdrawConfirmed(runtime)) {
    return { runtime, cargo, logLines: [] };
  }

  const def = getKeepsakeDefinition('ley_siphon_needle');
  const trigger = tryKeepsakeTrigger(runtime, `${def.primaryTriggerKey}:${nodeId}`, 'none');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime: clearLeyOverdrawConfirmedFlag(runtime), cargo, logLines: [] };
  }

  const bonusResource = pickDeadDropBonus(nodeId);
  const byproduct = pickLeySiphonByproduct(nodeId);
  const staged: string[] = [];
  let nextCargo = addLootToContainment(cargo, bonusResource, 1, staged);
  nextCargo = addLootToContainment(nextCargo, byproduct, 1, staged);
  stagedInstanceIds.push(...staged);

  let nextRuntime = applyKeepsakeLeyContamination(
    clearLeyOverdrawConfirmedFlag(trigger.runtime),
  );

  nextRuntime = patchKeepsakeStats(nextRuntime!, {
    bonusResourcesGenerated: trigger.runtime.stats.bonusResourcesGenerated + 2,
  });

  return {
    runtime: nextRuntime,
    cargo: nextCargo,
    logLines: [
      formatKeepsakeLogLine('Siphon', def.triggerMessage),
      '>> LEY-SIPHON OVERDRAW — bonus salvage routed; contamination +1.',
    ],
  };
}

export function applyKeepsakeDeadDropHarvestBonus(
  runtime: KeepsakeRuntime | null,
  cargo: CargoRunState,
  node: IncursionNode | null | undefined,
  stagedInstanceIds: string[],
): {
  runtime: KeepsakeRuntime | null;
  cargo: CargoRunState;
  logLines: string[];
} {
  if (!runtime || runtime.keepsakeId !== 'dead_drop_receiver') return { runtime, cargo, logLines: [] };
  if (!node?.contextModifiers?.keepsakeDeadDrop) return { runtime, cargo, logLines: [] };
  if (runtime.triggersUsed.dead_drop_receiver_harvest_bonus) {
    return { runtime, cargo, logLines: [] };
  }

  const bonusResource = pickDeadDropBonus(node.id);
  const staged: string[] = [];
  const nextCargo = addLootToContainment(cargo, bonusResource, 1, staged);
  stagedInstanceIds.push(...staged);

  const nextRuntime = patchKeepsakeStats(
    queueKeepsakePendingChoice(
      {
        ...runtime,
        triggersUsed: { ...runtime.triggersUsed, dead_drop_receiver_harvest_bonus: true },
      },
      buildDeadDropChoice(node.id),
    ),
    { bonusResourcesGenerated: runtime.stats.bonusResourcesGenerated + 1 },
  );

  return {
    runtime: nextRuntime,
    cargo: nextCargo,
    logLines: ['>> DEAD-DROP CACHE — buried salvage bundle secured from cache node.'],
  };
}

export function processKeepsakeStagedCargoPickup(
  runtime: KeepsakeRuntime | null,
  cargo: CargoRunState,
  stagedInstanceIds: readonly string[],
  jettisonLocked: readonly string[],
): KeepsakeCargoApplyResult & { jettisonLockedInstanceIds: string[] } {
  if (!runtime || stagedInstanceIds.length === 0) {
    return { runtime, logLines: [], jettisonLockedInstanceIds: [...jettisonLocked] };
  }

  let nextRuntime = runtime;
  const logLines: string[] = [];
  let locked = [...jettisonLocked];
  const byResource = new Map<ResourceItemId, string[]>();

  stagedInstanceIds.forEach((instanceId) => {
    const item = cargo.containment.find((entry) => entry.instanceId === instanceId)
      ?? cargo.grid.placed.find((entry) => entry.instanceId === instanceId);
    if (!item) return;
    const resourceId = item.itemId as ResourceItemId;
    const list = byResource.get(resourceId) ?? [];
    list.push(instanceId);
    byResource.set(resourceId, list);
  });

  byResource.forEach((instanceIds, resourceId) => {
    const result = applyKeepsakeOnCargoPickup(nextRuntime, resourceId, instanceIds);
    if (result.runtime) {
      nextRuntime = result.runtime;
    }
    logLines.push(...result.logLines);
    if (result.jettisonLockedInstanceIds?.length) {
      locked = [...locked, ...result.jettisonLockedInstanceIds];
    }
  });

  return {
    runtime: nextRuntime,
    logLines,
    jettisonLockedInstanceIds: locked,
  };
}

export function clearKeepsakeJettisonLocks(): readonly string[] {
  return [];
}

export function applyKeepsakeCargoSealOnNodeClear(
  runtime: KeepsakeRuntime | null,
): KeepsakeRuntime | null {
  if (!runtime || runtime.keepsakeId !== 'cargo_seal') return runtime;
  const hasSealed = runtime.taggedCargo.some((entry) => entry.tag === 'sealed');
  if (!hasSealed) return runtime;

  const currentBonus = runtime.counters.sealedValueBonusPct ?? 0;
  if (currentBonus >= CARGO_SEAL_VALUE_CAP_PCT) return runtime;

  const nextBonus = Math.min(CARGO_SEAL_VALUE_CAP_PCT, currentBonus + CARGO_SEAL_VALUE_GROWTH_PCT);
  return patchKeepsakeStats(
    {
      ...runtime,
      counters: { ...runtime.counters, sealedValueBonusPct: nextBonus },
    },
    { cargoValueBonus: runtime.stats.cargoValueBonus + 1 },
  );
}

export function applyKeepsakeCargoSealOnDirtyExtract(
  runtime: KeepsakeRuntime | null,
): { runtime: KeepsakeRuntime | null; logLines: string[] } {
  if (!runtime || runtime.keepsakeId !== 'cargo_seal' || runtime.cargoSealCracked) {
    return { runtime, logLines: [] };
  }
  const hasSealed = runtime.taggedCargo.some((entry) => entry.tag === 'sealed');
  if (!hasSealed) return { runtime, logLines: [] };

  return {
    runtime: { ...runtime, cargoSealCracked: true },
    logLines: ['>> CARGO SEAL CRACKED — unstable dampening reduced to 25% after dirty extraction.'],
  };
}

/** Lead-lined intel counts as +10% toward sponsor contract delivery thresholds. */
export function applyKeepsakeDeliveredQuantityBonus(
  delivered: ResourceQuantity,
  keepsakeRuntime?: KeepsakeRuntime | null,
): ResourceQuantity {
  if (!keepsakeRuntime) return delivered;
  const next: ResourceQuantity = { ...delivered };
  (Object.entries(delivered) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      const multiplier = resolveKeepsakeContractValueMultiplier(keepsakeRuntime, resourceId);
      if (multiplier !== 1) {
        next[resourceId] = Math.ceil(quantity * multiplier);
      }
    },
  );
  return next;
}
