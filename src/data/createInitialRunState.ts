/**
 * Fresh RunState factory — no legacy mid-run combat-trinket fields.
 */
import {
  BASE_MAX_SOUL_ANCHOR,
  BASE_MAX_STAMINA,
  RunState,
  TOTAL_RUN_NODES,
} from '../types/run';

export function createInitialRunState(): RunState {
  return {
    runActive: false,
    currentNode: 0,
    totalNodes: TOTAL_RUN_NODES,
    maxStamina: BASE_MAX_STAMINA,
    currentStamina: BASE_MAX_STAMINA,
    maxSoulAnchor: BASE_MAX_SOUL_ANCHOR,
    soulAnchorIntegrity: BASE_MAX_SOUL_ANCHOR,
    climateCluster: null,
    currentSector: null,
    pendingEncounter: null,
    pendingEnemy: null,
    pendingEnemies: [],
    pendingAmbush: false,
    // Generic combat params — narrative may patch startingAbyssalReservePercent;
    // legacy combat-trinket aggregation no longer writes these.
    parryWindowBonus: 0,
    parryMultiplierBonus: 0,
    sliceDamagePenalty: 0,
    startingAbyssalReservePercent: 0,
    combatNodesCleared: 0,
    combatTestPreset: null,
    devSandboxPreset: null,
  };
}
