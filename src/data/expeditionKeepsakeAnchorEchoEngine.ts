import type { CargoRunState } from '../types/cargoGrid';
import type { ActiveIncursionState } from '../types/game';
import type { KeepsakeRuntime } from '../types/expeditionKeepsake';
import type { ResourceItemId } from '../types/resourceItem';
import type { EchoEncounterKind } from '../types/echoEncounter';
import type { EnemyCombatProfile } from '../types/run';
import type { AnchorAssaultCombatContext } from './anchorAssaultEngine';
import type { EchoRecoveryCombatContext } from './echoRecoveryEngine';
import { addLootToContainment } from './cargoGridEngine';
import { normalizeSquad } from './combatSpawnEngine';
import { ENEMY_ROSTER, spawnRosterUnit } from './enemyRoster';
import {
  formatKeepsakeLogLine,
  tryKeepsakeTrigger,
} from './expeditionKeepsakeEngine';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';
import { patchKeepsakeStats } from './keepsakeRunState';
import { seededRandom } from './encounterGenerator';

const ANCHOR_CHARM_OPERATION_PROGRESS = 2;
const ANCHOR_CHARM_RESOURCE_ID: ResourceItemId = 'ossified-ley-knot';
const ECHO_LURE_REWARD_MULTIPLIER = 1.15;
const GRAVE_POLAROID_STABLE_RESOURCE: ResourceItemId = 'ley-slag';

export interface KeepsakeAnchorEchoApplyResult {
  runtime: KeepsakeRuntime | null;
  cargo?: CargoRunState;
  operationProgressDelta?: number;
  incursionPatch?: Partial<ActiveIncursionState>;
  extraCombatUnits?: number;
  logLines: string[];
}

export interface KeepsakeEchoRewardAdjustments {
  runtime: KeepsakeRuntime | null;
  extraEchoGlass: number;
  creditMultiplier: number;
  logLines: string[];
}

function hashPick(seed: string, salt: string): number {
  const rand = seededRandom(`${seed}:${salt}`);
  return rand();
}

/** Anchor Charm — first anchor encounter spawns +1 hostile. */
export function applyKeepsakeAnchorCharmOnCombatEngage(
  runtime: KeepsakeRuntime | null,
  anchorCtx: AnchorAssaultCombatContext | null,
): KeepsakeAnchorEchoApplyResult {
  if (!runtime || runtime.keepsakeId !== 'anchor_charm' || !anchorCtx) {
    return { runtime, logLines: [] };
  }

  const trigger = tryKeepsakeTrigger(runtime, 'anchor_charm_encounter_threat', 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, logLines: [] };
  }

  const def = getKeepsakeDefinition('anchor_charm');
  return {
    runtime: trigger.runtime,
    extraCombatUnits: 1,
    logLines: [
      formatKeepsakeLogLine(def.shortName, 'Anchor backlash — hostile reinforcement inbound.'),
    ],
  };
}

/** Anchor Charm — first anchor signal clear: +2 operation progress, +1 anchor resource. */
export function applyKeepsakeAnchorCharmOnSignalClear(
  runtime: KeepsakeRuntime | null,
  cargo: CargoRunState,
  operationRelevant: boolean,
): KeepsakeAnchorEchoApplyResult {
  if (!runtime || runtime.keepsakeId !== 'anchor_charm') {
    return { runtime, logLines: [] };
  }

  const def = getKeepsakeDefinition('anchor_charm');
  const trigger = tryKeepsakeTrigger(runtime, def.primaryTriggerKey, 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, logLines: [] };
  }

  const staged: string[] = [];
  const nextCargo = addLootToContainment(cargo, ANCHOR_CHARM_RESOURCE_ID, 1, staged);
  const operationProgressDelta = operationRelevant ? ANCHOR_CHARM_OPERATION_PROGRESS : 0;

  const nextRuntime = patchKeepsakeStats(trigger.runtime, {
    bonusResourcesGenerated: trigger.runtime.stats.bonusResourcesGenerated + 1,
    operationProgressAdded: trigger.runtime.stats.operationProgressAdded + operationProgressDelta,
  });

  return {
    runtime: nextRuntime,
    cargo: nextCargo,
    operationProgressDelta,
    logLines: [
      formatKeepsakeLogLine(def.shortName, def.triggerMessage),
      `>> ANCHOR CHARM BONUS — +1 ${ANCHOR_CHARM_RESOURCE_ID.replace(/-/g, ' ').toUpperCase()}.`,
      ...(operationProgressDelta > 0
        ? [`>> ANCHOR CHARM BONUS — +${operationProgressDelta} operation progress transmitted.`]
        : []),
    ],
  };
}

/** Echo Lure — first hostile echo encounter spawns +1 hostile. */
export function applyKeepsakeEchoLureOnCombatEngage(
  runtime: KeepsakeRuntime | null,
  echoCtx: EchoRecoveryCombatContext | null,
  echoKind: EchoEncounterKind | null | undefined,
): KeepsakeAnchorEchoApplyResult {
  if (!runtime || runtime.keepsakeId !== 'echo_lure' || !echoCtx || echoKind !== 'HOSTILE_ECHO') {
    return { runtime, logLines: [] };
  }

  const trigger = tryKeepsakeTrigger(runtime, 'echo_lure_hostile_threat', 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, logLines: [] };
  }

  const def = getKeepsakeDefinition('echo_lure');
  return {
    runtime: trigger.runtime,
    extraCombatUnits: 1,
    logLines: [
      formatKeepsakeLogLine(def.shortName, 'Hostile echo pattern amplified — reinforcement inbound.'),
    ],
  };
}

/** Echo Lure — first echo signal clear: +1 echo-glass and +15% echo reward value. */
export function applyKeepsakeOnEchoSignalResolved(
  runtime: KeepsakeRuntime | null,
): KeepsakeEchoRewardAdjustments {
  if (!runtime || runtime.keepsakeId !== 'echo_lure') {
    return { runtime, extraEchoGlass: 0, creditMultiplier: 1, logLines: [] };
  }

  const def = getKeepsakeDefinition('echo_lure');
  const trigger = tryKeepsakeTrigger(runtime, def.primaryTriggerKey, 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, extraEchoGlass: 0, creditMultiplier: 1, logLines: [] };
  }

  const nextRuntime = patchKeepsakeStats(trigger.runtime, {
    echoGlassBonus: trigger.runtime.stats.echoGlassBonus + 1,
  });

  return {
    runtime: nextRuntime,
    extraEchoGlass: 1,
    creditMultiplier: ECHO_LURE_REWARD_MULTIPLIER,
    logLines: [
      formatKeepsakeLogLine(def.shortName, def.triggerMessage),
      '>> ECHO LURE BONUS — +1 ECHO-GLASS; echo salvage yield +15%.',
    ],
  };
}

export function applyKeepsakeEchoLureCargoBonus(
  runtime: KeepsakeRuntime | null,
  cargo: CargoRunState,
  seed: string,
): KeepsakeAnchorEchoApplyResult {
  const lure = applyKeepsakeOnEchoSignalResolved(runtime);
  if (!lure.runtime || lure.extraEchoGlass <= 0) {
    return { runtime: lure.runtime, logLines: lure.logLines };
  }

  const staged: string[] = [];
  let nextCargo = cargo;
  for (let i = 0; i < lure.extraEchoGlass; i += 1) {
    nextCargo = addLootToContainment(nextCargo, 'echo-glass-shard', 1, staged);
  }

  return {
    runtime: lure.runtime,
    cargo: nextCargo,
    logLines: lure.logLines,
  };
}

export function scaleKeepsakeEchoCredits(
  credits: number,
  creditMultiplier: number,
): number {
  if (creditMultiplier <= 1 || credits <= 0) return credits;
  return Math.floor(credits * creditMultiplier);
}

export function appendKeepsakeThreatReinforcement(
  squad: readonly EnemyCombatProfile[],
  nodeIndex: number,
  extraUnits: number,
): EnemyCombatProfile[] {
  if (extraUnits <= 0 || squad.length >= 4) {
    return [...squad];
  }

  let next = [...squad];
  for (let i = 0; i < extraUnits && next.length < 4; i += 1) {
    const reinforcement = spawnRosterUnit(ENEMY_ROSTER['null-shade'], nodeIndex);
    next = [...next, reinforcement];
  }

  return normalizeSquad(next);
}

/** Grave Polaroid — clearing the imprinted node grants echo-glass or stable salvage. */
export function applyKeepsakeGravePolaroidOnNodeClear(
  inc: ActiveIncursionState,
  runtime: KeepsakeRuntime | null,
  cargo: CargoRunState,
  completedNodeId: string,
): KeepsakeAnchorEchoApplyResult {
  if (!runtime || runtime.keepsakeId !== 'grave_polaroid') {
    return { runtime, logLines: [] };
  }

  const preview = inc.keepsakeGravePolaroidPreview;
  if (!preview || preview.nodeId !== completedNodeId) {
    return { runtime, logLines: [] };
  }

  const trigger = tryKeepsakeTrigger(runtime, 'grave_polaroid_clear_reward', 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, logLines: [] };
  }

  const preferGlass = hashPick(`${completedNodeId}:polaroid`, 'reward') < 0.55;
  const resourceId: ResourceItemId = preferGlass
    ? 'echo-glass-shard'
    : GRAVE_POLAROID_STABLE_RESOURCE;
  const staged: string[] = [];
  const nextCargo = addLootToContainment(cargo, resourceId, 1, staged);

  const nextRuntime = patchKeepsakeStats(trigger.runtime, {
    bonusResourcesGenerated: trigger.runtime.stats.bonusResourcesGenerated + 1,
    ...(preferGlass
      ? { echoGlassBonus: trigger.runtime.stats.echoGlassBonus + 1 }
      : {}),
  });

  const def = getKeepsakeDefinition('grave_polaroid');
  return {
    runtime: nextRuntime,
    cargo: nextCargo,
    incursionPatch: { keepsakeGravePolaroidPreview: null },
    logLines: [
      formatKeepsakeLogLine(def.shortName, 'Polaroid imprint fulfilled — salvage recovered.'),
      `>> POLAROID PAYOFF — +1 ${resourceId.replace(/-/g, ' ').toUpperCase()}.`,
    ],
  };
}
