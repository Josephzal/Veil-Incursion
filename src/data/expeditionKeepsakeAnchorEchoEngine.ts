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
import { applyKeepsakeMournersBellOnEchoResolved } from './expeditionKeepsakePhaseDEngine';

const ANCHOR_CHARM_OPERATION_PROGRESS = 2;
const ANCHOR_CHARM_RESOURCE_ID: ResourceItemId = 'ossified-ley-knot';
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
    anchorTrailCleared: trigger.runtime.stats.anchorTrailCleared + 1,
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

/**
 * Echo reward hooks — retired with the Echo Lure relic (Trinkets v1.5).
 * Kept as neutral no-ops so the echo reward flow in RunContext stays intact;
 * Mourner's Bell / echo work reintroduces echo reward adjustments in a later phase.
 */
export function applyKeepsakeEchoLureOnCombatEngage(
  runtime: KeepsakeRuntime | null,
  _echoCtx: EchoRecoveryCombatContext | null,
  _echoKind: EchoEncounterKind | null | undefined,
): KeepsakeAnchorEchoApplyResult {
  return { runtime, logLines: [] };
}

export function applyKeepsakeOnEchoSignalResolved(
  runtime: KeepsakeRuntime | null,
): KeepsakeEchoRewardAdjustments {
  const mourners = applyKeepsakeMournersBellOnEchoResolved(runtime);
  return {
    runtime: mourners.runtime,
    extraEchoGlass: mourners.extraEchoGlass,
    creditMultiplier: mourners.creditMultiplier,
    logLines: mourners.logLines,
  };
}

export function applyKeepsakeEchoLureCargoBonus(
  runtime: KeepsakeRuntime | null,
  _cargo: CargoRunState,
  _seed: string,
): KeepsakeAnchorEchoApplyResult {
  return { runtime, logLines: [] };
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
