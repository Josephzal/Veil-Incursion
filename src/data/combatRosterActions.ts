import type { DistrictId } from './districtPacing';
import type { PlayerAIState } from './AIDecisionEngine';
import type { EnemyCombatProfile, EnemyIntent } from '../types/run';
import { getAlphaMechanic, resolveCoilSniperLockWindUp } from './enemyAlphaConfig';
import { isEvadePostureActive } from './enemyIntentUtils';
import {
  decideRosterIntent as decideRosterIntentFromAI,
  isRosterSpecificIntent,
  NULL_SHADE_SINKING_COOLDOWN_TURNS,
  ROSTER_AI_WEIGHTS,
  ROSTER_QUEUED_ACTION,
  syncRosterCombatState,
} from './combatRosterAI';

export {
  ROSTER_AI_WEIGHTS,
  ROSTER_ENRAGE_THRESHOLDS,
  ROSTER_QUEUED_ACTION,
  NULL_SHADE_SINKING_COOLDOWN_TURNS,
  syncRosterCombatState,
} from './combatRosterAI';

export { isRosterSpecificIntent };

export const CONCRETE_GARGOYLE_FRACTURE_MAX = 200;
export const PAVEMENT_CRUSHER_DAMAGE_MULT = 2.75;
export const VOID_AMBUSH_DAMAGE_MULT = 2.2;
export const VOID_AMBUSH_CRIT_CHANCE = 0.45;
export const VOID_AMBUSH_INTERRUPT_THRESHOLD = 25;
export const RESONANCE_OVERLOAD_DAMAGE_MULT = 0.85;

export function isNullShadeVoidAmbush(profile: EnemyCombatProfile): boolean {
  return profile.rosterId === 'null-shade' && profile.intent === 'VOID_AMBUSH';
}

export function decideRosterIntent(
  profile: EnemyCombatProfile,
  district: DistrictId = 1,
  playerState?: PlayerAIState,
  squad?: EnemyCombatProfile[],
  options?: {
    hasAshToken?: boolean;
    combatRound?: number;
    isLastEnemyAlive?: boolean;
  },
): EnemyIntent | null {
  return decideRosterIntentFromAI(profile, district, playerState, squad, options);
}

export function resolveRosterEnemyDamage(profile: EnemyCombatProfile, intent: EnemyIntent): number {
  let base = profile.baseDamage;

  if (intent === 'PAVEMENT_CRUSHER') {
    return Math.floor(base * PAVEMENT_CRUSHER_DAMAGE_MULT);
  }
  if (intent === 'VOID_AMBUSH') {
    return Math.floor(base * VOID_AMBUSH_DAMAGE_MULT);
  }
  if (intent === 'DOUBLE_STRIKE') {
    return base;
  }
  if (intent === 'RESONANCE_OVERLOAD') {
    return Math.floor(base * RESONANCE_OVERLOAD_DAMAGE_MULT);
  }
  if (profile.rosterId === 'echoing-brute' && profile.adaptedElement === 'Kinetic' && !profile.isEnraged) {
    const adaptiveMult = getAlphaMechanic(profile, 'adaptiveDamageMultiplier', 1.65);
    return Math.floor(base * adaptiveMult);
  }
  if (profile.rosterId === 'gutter-goliath' && profile.isEnraged) {
    return Math.floor(base * ROSTER_AI_WEIGHTS.GOLIATH_ENRAGE_DAMAGE_MULT);
  }
  if (profile.rosterId === 'resonance-caster') {
    const stack = profile.resonanceStack ?? 0;
    const scalingPerTurn = getAlphaMechanic(profile, 'damageScalingPerTurn', 0.5);
    return Math.floor(base * (1 + stack * scalingPerTurn));
  }
  if (intent === 'ARTILLERY_FIRE') {
    return Math.floor(base * 1.75);
  }
  return base;
}

export function rosterIntentLabel(intent: EnemyIntent, designation: string): string | null {
  const labels: Partial<Record<EnemyIntent, string>> = {
    PAVEMENT_CRUSHER_CHARGE: `${designation} winds PAVEMENT CRUSHER CHARGE`,
    PAVEMENT_CRUSHER: `${designation} intends PAVEMENT CRUSHER (MASSIVE KINETIC)`,
    OCCULT_TETHER: `${designation} casts OCCULT TETHER`,
    SWARM_BITE: `${designation} intends SWARM BITE (STAMINA DRAIN)`,
    STAMINA_DRAIN_LEAP: `${designation} intends STAMINA DRAIN LEAP`,
    DOUBLE_STRIKE: `${designation} intends DOUBLE STRIKE`,
    VEIL_STATIC: `${designation} casts VEIL STATIC (AP DISRUPTION)`,
    PREMATURE_IGNITION: `${designation} triggers PREMATURE IGNITION`,
    RESONANCE_OVERLOAD: `${designation} intends RESONANCE OVERLOAD`,
    SINKING_INTO_GRID: `${designation} sinks into the GRID (PHASE)`,
    VOID_AMBUSH: `${designation} intends VOID AMBUSH (CRITICAL)`,
    KINETIC_AFTERSHOCK: `${designation} intends KINETIC AFTERSHOCK`,
    SCAVENGE: `${designation} intends SCAVENGE (ASH HEAL)`,
    SENSORY_JAM: `${designation} casts SENSORY JAM`,
    VEIL_BARRIER: `${designation} raises VEIL BARRIER`,
    TARGET_LOCK: `${designation} applies TARGET LOCK`,
    ASHEN_ROT: `${designation} inflicts ASHEN ROT`,
    ARTILLERY_CHARGE: `${designation} charges artillery`,
    ARTILLERY_FIRE: `${designation} fires charged ordnance`,
    TAR_BIND: `${designation} binds target in sludge`,
    LASER_SIGHT: `${designation} paints LASER SIGHT`,
    STAMINA_TETHER: `${designation} casts STAMINA TETHER`,
    JAM_AUGMENT: `${designation} jams operative augment`,
  };
  return labels[intent] ?? null;
}

export function nullShadeVoidAmbushCleanupPatch(
  profile: EnemyCombatProfile,
): Partial<EnemyCombatProfile> {
  if (profile.rosterId !== 'null-shade') return {};
  return {
    queuedAction: null,
    isUntargetable: false,
    rosterAbilityCooldown: NULL_SHADE_SINKING_COOLDOWN_TURNS,
  };
}

export function patchRosterAfterIntentExec(
  profile: EnemyCombatProfile,
  intent: EnemyIntent,
): Partial<EnemyCombatProfile> {
  const patch: Partial<EnemyCombatProfile> = {};

  if (profile.rosterId === 'concrete-gargoyle') {
    if (intent === 'PAVEMENT_CRUSHER_CHARGE') {
      patch.queuedAction = ROSTER_QUEUED_ACTION.SLAM;
      patch.isCharging = true;
    }
    if (intent === 'PAVEMENT_CRUSHER') {
      patch.queuedAction = null;
      patch.isCharging = false;
    }
  }

  if (profile.rosterId === 'null-shade') {
    if (intent === 'SINKING_INTO_GRID') {
      patch.isUntargetable = true;
      patch.queuedAction = ROSTER_QUEUED_ACTION.VOID_AMBUSH;
    }
    if (intent === 'VOID_AMBUSH') {
      return nullShadeVoidAmbushCleanupPatch(profile);
    }
  }

  const artilleryChargeIds = ['sapper', 'coil-spike-sniper', 'resonance-caster', 'tar-spitter', 'splinter'];
  if (profile.rosterId && artilleryChargeIds.includes(profile.rosterId)) {
    if (intent === 'ARTILLERY_CHARGE' || intent === 'LASER_SIGHT') {
      patch.isCharging = true;
      patch.queuedAction = profile.rosterId === 'sapper'
        ? ROSTER_QUEUED_ACTION.BUNKER_BUSTER
        : ROSTER_QUEUED_ACTION.LASER_FIRE;
    }
    if (profile.rosterId === 'coil-spike-sniper' && intent === 'LASER_SIGHT') {
      patch.laserLockTurnsRemaining = resolveCoilSniperLockWindUp(profile);
    }
    if (profile.rosterId === 'coil-spike-sniper' && intent === 'ARTILLERY_CHARGE') {
      patch.laserLockTurnsRemaining = Math.max(0, (profile.laserLockTurnsRemaining ?? 0) - 1);
    }
    if (intent === 'ARTILLERY_FIRE' || intent === 'TAR_BIND') {
      patch.isCharging = false;
      patch.queuedAction = null;
      if (profile.rosterId === 'coil-spike-sniper') {
        patch.laserLockTurnsRemaining = 0;
      }
    }
  }

  if (intent === 'EVADE' && !isEvadePostureActive(profile)) {
    patch.evadeActive = true;
    patch.evadeTurnsRemaining = 2;
  }
  if (
    intent === 'STRIKE'
    || intent === 'DOUBLE_STRIKE'
    || intent === 'WORLD_ENDER'
    || intent === 'PAVEMENT_CRUSHER'
    || intent === 'VOID_AMBUSH'
    || intent === 'RESONANCE_OVERLOAD'
    || intent === 'ARTILLERY_FIRE'
  ) {
    patch.evadeActive = false;
    patch.evadeTurnsRemaining = 0;
  }

  return patch;
}
