import type { ActiveIncursionState } from '../types/game';
import type { KeepsakeRuntime } from '../types/expeditionKeepsake';
import type { ProceduralNodeType, ProceduralRunTree } from '../types/proceduralRunTree';
import type { UnstableCarriedEffectDefinition } from '../types/unstableCargoEffects';
import {
  formatKeepsakeLogLine,
  tryKeepsakeTrigger,
} from './expeditionKeepsakeEngine';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';
import { patchKeepsakeStats } from './keepsakeRunState';
import { localProceduralDepth } from './proceduralScannerBridge';

export type SafehouseCoinService = 'route_cargo' | 'buy_information' | 'stabilize_payload';

const WELL_FED_COMBAT_COUNT = 3;
const WELL_FED_STAMINA_BONUS = 20;
const ROUTE_CARGO_VALUE_BONUS_PCT = 15;

export interface KeepsakeSafehouseApplyResult {
  runtime: KeepsakeRuntime | null;
  incursionPatch?: Partial<ActiveIncursionState>;
  logLines: string[];
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickNextDepthPreviewType(
  tree: ProceduralRunTree | null | undefined,
  nodesCleared: number,
): ProceduralNodeType | null {
  if (!tree) return null;
  const currentDepth = localProceduralDepth(nodesCleared);
  const nextDepth = currentDepth + 1;
  const candidates = Object.values(tree.nodes)
    .filter((node) => node.depth === nextDepth)
    .sort((a, b) => a.id.localeCompare(b.id));
  return candidates[0]?.type ?? null;
}

export function applyKeepsakeOnSafehouseEnter(
  runtime: KeepsakeRuntime | null,
  inc: ActiveIncursionState,
): KeepsakeSafehouseApplyResult {
  const logLines: string[] = [];
  if (!runtime) return { runtime, logLines };

  let nextRuntime = runtime;

  if (runtime.wellFedCombatsRemaining > 0 && runtime.triggersUsed.field_rations_first_safehouse) {
    nextRuntime = { ...nextRuntime, wellFedCombatsRemaining: 0 };
    logLines.push('>> WELL-FED EXPIRED — safehouse resupply cleared combat ration bonus.');
  }

  if (runtime.keepsakeId === 'safehouse_coin' && !runtime.safehouseCoinServiceUsed) {
    const def = getKeepsakeDefinition('safehouse_coin');
    const trigger = tryKeepsakeTrigger(runtime, def.primaryTriggerKey, 'run');
    if (trigger.triggered && trigger.runtime) {
      nextRuntime = {
        ...trigger.runtime,
        safehouseCoinServicePending: true,
      };
      logLines.push(formatKeepsakeLogLine('Coin', def.triggerMessage));
    }
  }

  if (runtime.keepsakeId === 'field_rations' && runtime.wellFedCombatsRemaining <= 0) {
    const def = getKeepsakeDefinition('field_rations');
    const trigger = tryKeepsakeTrigger(runtime, def.primaryTriggerKey, 'run');
    if (trigger.triggered && trigger.runtime) {
      nextRuntime = patchKeepsakeStats(
        {
          ...trigger.runtime,
          wellFedCombatsRemaining: WELL_FED_COMBAT_COUNT,
        },
        { staminaPreserved: trigger.runtime.stats.staminaPreserved + WELL_FED_STAMINA_BONUS * WELL_FED_COMBAT_COUNT },
      );
      logLines.push(formatKeepsakeLogLine('Rations', def.triggerMessage));
    }
  }

  return { runtime: nextRuntime, logLines };
}

export function commitKeepsakeSafehouseCoinService(
  runtime: KeepsakeRuntime | null,
  inc: ActiveIncursionState,
  service: SafehouseCoinService,
): KeepsakeSafehouseApplyResult {
  if (!runtime?.safehouseCoinServicePending || runtime.safehouseCoinServiceUsed) {
    return { runtime, logLines: [] };
  }

  const logLines: string[] = [];
  let nextRuntime: KeepsakeRuntime = {
    ...runtime,
    safehouseCoinServicePending: false,
    safehouseCoinServiceUsed: service,
  };
  let incursionPatch: Partial<ActiveIncursionState> | undefined;

  switch (service) {
    case 'route_cargo':
      nextRuntime = patchKeepsakeStats(nextRuntime, {
        safehouseServiceUsed: 'Route Cargo (+15% banked value)',
        creditsSaved: nextRuntime.stats.creditsSaved + ROUTE_CARGO_VALUE_BONUS_PCT,
      });
      nextRuntime = { ...nextRuntime, safehouseCoinRouteCargoBonus: true };
      logLines.push('>> SAFEHOUSE COIN — Route Cargo: banked payload valued +15% on extract.');
      break;
    case 'buy_information': {
      const previewType = pickNextDepthPreviewType(inc.proceduralRunTree, inc.nodesCleared);
      nextRuntime = patchKeepsakeStats(nextRuntime, {
        safehouseServiceUsed: 'Buy Information',
        futureNodesPreviewed: nextRuntime.stats.futureNodesPreviewed + (previewType ? 1 : 0),
      });
      nextRuntime = {
        ...nextRuntime,
        safehouseCoinNextDepthPreviewType: previewType,
      };
      incursionPatch = { keepsakeNextDepthNodeTypePreview: previewType };
      logLines.push(
        previewType
          ? `>> SAFEHOUSE COIN — Intel purchased: next depth opens with ${previewType} vector bias.`
          : '>> SAFEHOUSE COIN — Intel purchased: next depth route still forming.',
      );
      break;
    }
    case 'stabilize_payload':
      nextRuntime = patchKeepsakeStats(nextRuntime, {
        safehouseServiceUsed: 'Stabilize Payload',
        unstablePenaltiesReduced: nextRuntime.stats.unstablePenaltiesReduced + 1,
      });
      nextRuntime = { ...nextRuntime, safehouseCoinStabilizePayloadActive: true };
      logLines.push('>> SAFEHOUSE COIN — Payload stabilized: one unstable penalty −25%.');
      break;
    default:
      break;
  }

  return { runtime: nextRuntime, incursionPatch, logLines };
}

export function applyKeepsakeOnCombatStart(
  runtime: KeepsakeRuntime | null,
): { runtime: KeepsakeRuntime | null; staminaBonus: number; logLines: string[] } {
  if (!runtime || runtime.wellFedCombatsRemaining <= 0) {
    return { runtime, staminaBonus: 0, logLines: [] };
  }

  const remaining = runtime.wellFedCombatsRemaining - 1;
  const nextRuntime = patchKeepsakeStats(
    { ...runtime, wellFedCombatsRemaining: remaining },
    { staminaPreserved: runtime.stats.staminaPreserved + WELL_FED_STAMINA_BONUS },
  );

  return {
    runtime: nextRuntime,
    staminaBonus: WELL_FED_STAMINA_BONUS,
    logLines: [
      `>> WELL-FED — +${WELL_FED_STAMINA_BONUS} stamina for this combat (${remaining} remaining).`,
    ],
  };
}

export function dampenKeepsakeStabilizePayload(
  effects: readonly UnstableCarriedEffectDefinition[],
  runtime: KeepsakeRuntime | null | undefined,
): { effects: UnstableCarriedEffectDefinition[]; runtime: KeepsakeRuntime | null } {
  if (!runtime?.safehouseCoinStabilizePayloadActive || effects.length === 0) {
    return { effects: [...effects], runtime: runtime ?? null };
  }

  const [first, ...rest] = effects;
  const mods = first.modifiers;
  const dampenedFirst: UnstableCarriedEffectDefinition = {
    ...first,
    modifiers: {
      ...mods,
      healReceivedMultiplier: mods.healReceivedMultiplier != null
        ? 1 - (1 - mods.healReceivedMultiplier) * 0.25
        : mods.healReceivedMultiplier,
      eliteWeightDelta: mods.eliteWeightDelta != null
        ? mods.eliteWeightDelta * 0.75
        : mods.eliteWeightDelta,
      anomalyWeightDelta: mods.anomalyWeightDelta != null
        ? mods.anomalyWeightDelta * 0.75
        : mods.anomalyWeightDelta,
      anchorSignalMultiplier: mods.anchorSignalMultiplier != null
        ? 1 - (mods.anchorSignalMultiplier - 1) * 0.25
        : mods.anchorSignalMultiplier,
    },
  };

  return {
    effects: [dampenedFirst, ...rest],
    runtime: { ...runtime, safehouseCoinStabilizePayloadActive: false },
  };
}

export function resolveKeepsakeBankedResourceMultiplier(
  runtime: KeepsakeRuntime | null | undefined,
): number {
  return runtime?.safehouseCoinRouteCargoBonus ? 1 + ROUTE_CARGO_VALUE_BONUS_PCT / 100 : 1;
}

export function formatKeepsakeNextDepthPreviewLine(
  previewType: ProceduralNodeType | null | undefined,
): string | null {
  if (!previewType) return null;
  return `>> SAFEHOUSE INTEL — next depth first vector type: ${previewType}.`;
}

export function pickSafehouseCoinServiceForDev(
  runtime: KeepsakeRuntime | null,
  seed: string,
): SafehouseCoinService {
  const options: SafehouseCoinService[] = ['route_cargo', 'buy_information', 'stabilize_payload'];
  if (!runtime) return options[0]!;
  const index = hashSeed(`${runtime.keepsakeId}:${seed}`) % options.length;
  return options[index] ?? 'route_cargo';
}
