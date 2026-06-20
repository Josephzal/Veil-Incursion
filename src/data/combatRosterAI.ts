import type { DistrictId } from './districtPacing';
import {
  defaultPlayerAIState,
  enemyAIStateFromProfile,
  filterValidIntents,
  selectWeightedIntent,
  weightValidIntents,
  type PlayerAIState,
  type WeightedIntent,
} from './AIDecisionEngine';
import { aliveUnits } from './combatSquadEngine';
import type { EnemyCombatProfile, EnemyIntent } from '../types/run';
import { squadNeedsFixerRepair } from './fixerRepairEngine';
import { isRedundantBuffIntent } from './enemyIntentUtils';

/** Playtest-tunable hostile enrage thresholds — adjust ratios/absolute HP here. */
export const ROSTER_ENRAGE_THRESHOLDS = {
  'gutter-goliath': { mode: 'ratio' as const, value: 0.30 },
  'echoing-brute': { mode: 'absolute' as const, value: 20 },
  'ash-weeper': { mode: 'absolute' as const, value: 15 },
  'fracture-hound': { mode: 'ratio' as const, value: 0.35 },
  'slag-blood': { mode: 'ratio' as const, value: 0.30 },
} as const;

export const ROSTER_QUEUED_ACTION = {
  SLAM: 'SLAM',
  VOID_AMBUSH: 'VOID_AMBUSH',
  BUNKER_BUSTER: 'BUNKER_BUSTER',
  LASER_FIRE: 'LASER_FIRE',
} as const;

export type RosterQueuedAction =
  | typeof ROSTER_QUEUED_ACTION.SLAM
  | typeof ROSTER_QUEUED_ACTION.VOID_AMBUSH
  | null;

export const ROSTER_AI_WEIGHTS = {
  VEIL_STATIC_HEAVY: 12,
  STAMINA_DRAIN_LEAP_BOOST: 2,
  GOLIATH_ENRAGE_DAMAGE_MULT: 1.5,
  FRACTURE_HOUND_SHIELD_DRAIN: 8,
} as const;

/** Enemy turns Null-Shade must use basic actions before Sinking into the Grid again. */
export const NULL_SHADE_SINKING_COOLDOWN_TURNS = 2;

const NULL_SHADE_TELEGRAPH_INTENTS: EnemyIntent[] = ['SINKING_INTO_GRID', 'VOID_AMBUSH'];

const ROSTER_INTENTS: Partial<Record<string, EnemyIntent[]>> = {
  'concrete-gargoyle': ['PAVEMENT_CRUSHER_CHARGE', 'PAVEMENT_CRUSHER', 'STRIKE'],
  'gutter-goliath': ['STRIKE', 'FORTIFY'],
  'echoing-brute': ['STRIKE', 'KINETIC_AFTERSHOCK', 'FORTIFY', 'RESONANCE_OVERLOAD'],
  'ley-siren': ['OCCULT_TETHER', 'TARGET_LOCK', 'VEIL_STATIC', 'SIPHON_ABYSSAL', 'STRIKE'],
  'ash-weeper': ['STRIKE', 'SIPHON_ABYSSAL', 'PREMATURE_IGNITION', 'SCAVENGE'],
  'miasma-tick-swarm': ['SWARM_BITE', 'STAMINA_DRAIN_LEAP', 'STRIKE', 'SCAVENGE'],
  'fracture-hound': ['STRIKE'],
  'null-shade': ['SINKING_INTO_GRID', 'VOID_AMBUSH', 'STRIKE', 'EVADE', 'VEIL_BARRIER', 'ASHEN_ROT'],
  'spatial-glitch': ['STRIKE', 'SENSORY_JAM', 'FORTIFY', 'SIPHON_ABYSSAL'],
  'spall': ['STRIKE'],
  'scuttler': ['STRIKE', 'EVADE'],
  'thrall': ['STRIKE'],
  'hook-weaver': ['STAMINA_TETHER', 'STRIKE'],
  'memory-leech': ['JAM_AUGMENT', 'STRIKE'],
  'smog-caller': ['STRIKE', 'SIPHON_ABYSSAL'],
  'iron-maiden': ['STRIKE', 'FORTIFY'],
  'golem': ['STRIKE', 'FORTIFY'],
  'slag-blood': ['STRIKE', 'DOUBLE_STRIKE'],
  'sapper': ['ARTILLERY_CHARGE', 'ARTILLERY_FIRE', 'STRIKE'],
  'coil-spike-sniper': ['LASER_SIGHT', 'ARTILLERY_FIRE', 'STRIKE'],
  'resonance-caster': ['ARTILLERY_CHARGE', 'ARTILLERY_FIRE'],
  'tar-spitter': ['ARTILLERY_CHARGE', 'TAR_BIND', 'STRIKE'],
  'churn': ['STRIKE'],
  'splinter': ['ARTILLERY_CHARGE', 'ARTILLERY_FIRE', 'STRIKE'],
  'breacher': ['STRIKE', 'FORTIFY'],
  'cutter': ['STRIKE', 'EVADE'],
  'warden': ['STRIKE', 'FORTIFY'],
  'fixer': ['FIELD_REPAIR', 'EVADE'],
  'spotter': ['TARGET_LOCK', 'ARTILLERY_FIRE'],
  'burner': ['STRIKE'],
  'amalgam': ['STRIKE', 'FORTIFY'],
  'wire-ghoul': ['STRIKE', 'EVADE'],
  'hollow-lung': ['STRIKE'],
  'grave-robber': ['SCAVENGE', 'STRIKE'],
};

function isHpBelowEnrageThreshold(profile: EnemyCombatProfile, rosterId: string): boolean {
  const rule = ROSTER_ENRAGE_THRESHOLDS[rosterId as keyof typeof ROSTER_ENRAGE_THRESHOLDS];
  if (!rule) return false;
  if (profile.currentHp <= 0) return false;
  if (rule.mode === 'ratio') {
    return profile.maxHp > 0 && profile.currentHp / profile.maxHp < rule.value;
  }
  return profile.currentHp < rule.value;
}

/** Latch enrage + apply roster stat toggles when thresholds are crossed. */
export function syncRosterCombatState(profile: EnemyCombatProfile): EnemyCombatProfile {
  const rosterId = profile.rosterId;
  if (!rosterId) return profile;

  let next: EnemyCombatProfile = {
    ...profile,
    isEnraged: profile.isEnraged ?? false,
    queuedAction: profile.queuedAction ?? null,
    isUntargetable: profile.isUntargetable ?? false,
    rosterAbilityCooldown: profile.rosterAbilityCooldown ?? 0,
  };

  if (!next.isEnraged && isHpBelowEnrageThreshold(next, rosterId)) {
    next = { ...next, isEnraged: true };
  }

  if (rosterId === 'gutter-goliath' && next.isEnraged) {
    next = {
      ...next,
      kineticArmor: 0,
      occultWards: 0,
    };
  }

  if (rosterId === 'slag-blood' && next.isEnraged) {
    next = {
      ...next,
      kineticArmor: 0,
      occultWards: 0,
      baseDamage: Math.floor((profile.baseDamage ?? next.baseDamage) * 2),
    };
  }

  return next;
}

function frontlineNeedsOccultTether(squad: EnemyCombatProfile[]): boolean {
  return aliveUnits(squad).some(
    (unit) => unit.gridSlot?.startsWith('FL') && unit.fractureImmune !== true,
  );
}

function applyRosterIntentWeights(
  weights: WeightedIntent[],
  profile: EnemyCombatProfile,
  squad: EnemyCombatProfile[],
  player: PlayerAIState,
): WeightedIntent[] {
  const rosterId = profile.rosterId;
  if (!rosterId) return weights;

  if (rosterId === 'ley-siren') {
    const ap = player.actionPoints ?? 0;
    const tetherNeeded = frontlineNeedsOccultTether(squad);
    if (ap >= 3 && !tetherNeeded) {
      return weights.map((entry) => ({
        ...entry,
        weight: entry.intent === 'VEIL_STATIC'
          ? entry.weight * ROSTER_AI_WEIGHTS.VEIL_STATIC_HEAVY
          : entry.weight,
      }));
    }
  }

  if (rosterId === 'miasma-tick-swarm' && player.stamina < 20) {
    return weights.map((entry) => ({
      ...entry,
      weight: entry.intent === 'STAMINA_DRAIN_LEAP'
        ? entry.weight * ROSTER_AI_WEIGHTS.STAMINA_DRAIN_LEAP_BOOST
        : entry.weight,
    }));
  }

  return weights;
}

function filterNullShadeCooldown(pool: EnemyIntent[], profile: EnemyCombatProfile): EnemyIntent[] {
  if (profile.rosterId !== 'null-shade') return pool;
  const cooldown = profile.rosterAbilityCooldown ?? 0;
  if (cooldown <= 0) return pool;
  return pool.filter((intent) => !NULL_SHADE_TELEGRAPH_INTENTS.includes(intent));
}

function resolveForcedRosterIntent(profile: EnemyCombatProfile): EnemyIntent | null {
  const rosterId = profile.rosterId;
  if (!rosterId) return null;

  if (rosterId === 'concrete-gargoyle') {
    if (profile.queuedAction === ROSTER_QUEUED_ACTION.SLAM || profile.isCharging) {
      return 'PAVEMENT_CRUSHER';
    }
    return 'PAVEMENT_CRUSHER_CHARGE';
  }

  if (rosterId === 'null-shade') {
    if (profile.queuedAction === ROSTER_QUEUED_ACTION.VOID_AMBUSH) {
      return 'VOID_AMBUSH';
    }
  }

  const artilleryIds = [
    'sapper', 'coil-spike-sniper', 'resonance-caster', 'tar-spitter', 'splinter', 'spotter',
  ];
  if (rosterId && artilleryIds.includes(rosterId)) {
    if (profile.queuedAction === ROSTER_QUEUED_ACTION.BUNKER_BUSTER
      || profile.queuedAction === ROSTER_QUEUED_ACTION.LASER_FIRE) {
      return 'ARTILLERY_FIRE';
    }
    if (profile.isCharging) return 'ARTILLERY_FIRE';
    if (rosterId === 'spotter' && profile.spotterLockedOn) return 'ARTILLERY_FIRE';
    if (rosterId === 'spotter' && !profile.spotterLockedOn) return 'TARGET_LOCK';
    if (rosterId === 'coil-spike-sniper' && !profile.isCharging && profile.queuedAction !== ROSTER_QUEUED_ACTION.LASER_FIRE) {
      return 'LASER_SIGHT';
    }
    if (rosterId === 'tar-spitter' && profile.isCharging) return 'TAR_BIND';
    return 'ARTILLERY_CHARGE';
  }

  if (rosterId === 'echoing-brute' && profile.isEnraged) {
    return 'RESONANCE_OVERLOAD';
  }

  if (rosterId === 'ash-weeper' && profile.isEnraged && profile.currentHp > 0) {
    return 'PREMATURE_IGNITION';
  }

  return null;
}

export function decideRosterIntent(
  profile: EnemyCombatProfile,
  district: DistrictId = 1,
  playerState?: PlayerAIState,
  squad?: EnemyCombatProfile[],
  options?: { hasAshToken?: boolean },
): EnemyIntent | null {
  const synced = syncRosterCombatState(profile);
  const rosterId = synced.rosterId;
  if (!rosterId) return null;

  if (
    options?.hasAshToken
    && (rosterId === 'ash-weeper' || rosterId === 'miasma-tick-swarm')
    && synced.currentHp < synced.maxHp
  ) {
    return 'SCAVENGE';
  }

  if (rosterId === 'fixer') {
    if (squad && synced.unitId && squadNeedsFixerRepair(squad, synced.unitId)) {
      return 'FIELD_REPAIR';
    }
    return 'EVADE';
  }

  if (rosterId === 'grave-robber' && squad) {
    const hasCorpse = squad.some(
      (u) => u.unitId !== synced.unitId && (u.isSlumped || u.currentHp <= 0),
    );
    if (hasCorpse) return 'STRIKE';
  }

  const forced = resolveForcedRosterIntent(synced);
  if (forced) return forced;

  const pool = ROSTER_INTENTS[rosterId];
  if (!pool) return null;

  const cooledPool = filterNullShadeCooldown(pool, synced);

  const ctx = {
    enemy: enemyAIStateFromProfile(synced, district),
    player: playerState ?? defaultPlayerAIState(),
  };
  const valid = filterValidIntents(cooledPool, ctx);
  const withoutRedundantBuffs = cooledPool.filter((intent) => !isRedundantBuffIntent(intent, synced));
  const fallbackPool = valid.length > 0
    ? valid
    : withoutRedundantBuffs.length > 0
      ? withoutRedundantBuffs
      : (['STRIKE'] as EnemyIntent[]);
  const weighted = weightValidIntents(fallbackPool, ctx);
  const rosterWeighted = applyRosterIntentWeights(
    weighted,
    synced,
    squad ?? [synced],
    ctx.player,
  );
  return selectWeightedIntent(rosterWeighted.length > 0 ? rosterWeighted : weighted);
}

export function isRosterSpecificIntent(intent: EnemyIntent): boolean {
  return intent === 'PAVEMENT_CRUSHER_CHARGE'
    || intent === 'PAVEMENT_CRUSHER'
    || intent === 'OCCULT_TETHER'
    || intent === 'SWARM_BITE'
    || intent === 'STAMINA_DRAIN_LEAP'
    || intent === 'DOUBLE_STRIKE'
    || intent === 'VEIL_STATIC'
    || intent === 'PREMATURE_IGNITION'
    || intent === 'RESONANCE_OVERLOAD'
    || intent === 'SINKING_INTO_GRID'
    || intent === 'VOID_AMBUSH'
    || intent === 'KINETIC_AFTERSHOCK'
    || intent === 'SCAVENGE'
    || intent === 'SENSORY_JAM'
    || intent === 'VEIL_BARRIER'
    || intent === 'TARGET_LOCK'
    || intent === 'ASHEN_ROT'
    || intent === 'ARTILLERY_CHARGE'
    || intent === 'ARTILLERY_FIRE'
    || intent === 'TAR_BIND'
    || intent === 'LASER_SIGHT'
    || intent === 'STAMINA_TETHER'
    || intent === 'JAM_AUGMENT';
}
