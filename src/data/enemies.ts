import type { DistrictId } from './districtPacing';
import {
  decideEnemyIntent,
  defaultPlayerAIState,
  enemyAIStateFromProfile,
  type PlayerAIState,
} from './AIDecisionEngine';
import { decideRosterIntent, syncRosterCombatState } from './combatRosterActions';
import { ENEMY_ROSTER, spawnRosterUnit } from './enemyRoster';
import { isRedundantBuffIntent } from './enemyIntentUtils';
import { getNodeScale } from './enemyNodeScale';
import { rollEnemyIntent } from './enemyIntentRoll';
import type { EnemyAffinity } from '../types/combatEnvironment';
import { EnemyClass, EnemyCombatProfile, EnemyIntent, SectorDefinition } from '../types/run';

export { getNodeScale } from './enemyNodeScale';
export { rollEnemyIntent, rollEnemyIntentForProfile } from './enemyIntentRoll';
export { isRedundantBuffIntent, resolveEffectiveEnemyIntent } from './enemyIntentUtils';

const CLASS_BASE_HP: Record<EnemyClass, number> = {
  GREMLIN: 40,
  APPARITION: 60,
  ABOMINATION: 90,
};

const CLASS_BASE_DAMAGE: Record<EnemyClass, number> = {
  GREMLIN: 8,
  APPARITION: 12,
  ABOMINATION: 16,
};

function pickEnemyClass(nodeIndex: number, isEliteAmbush: boolean): EnemyClass {
  if (isEliteAmbush) return 'ABOMINATION';
  const roll = Math.random();
  if (nodeIndex >= 5) return roll < 0.35 ? 'ABOMINATION' : roll < 0.7 ? 'APPARITION' : 'GREMLIN';
  if (nodeIndex >= 3) return roll < 0.25 ? 'ABOMINATION' : roll < 0.6 ? 'APPARITION' : 'GREMLIN';
  return roll < 0.45 ? 'GREMLIN' : 'APPARITION';
}

function biomeSkin(classType: EnemyClass, sector: SectorDefinition): string {
  const key = `${sector.name}|${sector.subsector}`;
  const skins: Record<string, Partial<Record<EnemyClass, string>>> = {
    'Flooded Sewers|Overflow Tunnels': { GREMLIN: 'Sludge Skitterer', APPARITION: 'Drowned Lamplighter', ABOMINATION: 'Overflow Leviathan' },
    'Neon Alleyways|Velvet Theater District': { GREMLIN: 'Ticket Stub Gremlin', APPARITION: 'Velvet Phantom', ABOMINATION: 'Stage-Collapse Golem' },
    'Hallowed Churches|Bell-Tower Nave': { GREMLIN: 'Pew Crawler', APPARITION: 'Processional Wraith', ABOMINATION: 'Bell-Tower Golem' },
    'Forgotten Forest|Breach Point': { GREMLIN: 'Root Skitter', APPARITION: 'Canopy Stalker', ABOMINATION: 'Hollow Treant' },
    'Sunken Swamps|Bog Cathedral': { GREMLIN: 'Bog Nymph', APPARITION: 'Mire Lich', ABOMINATION: 'Cathedral Mire-Heart' },
  };
  const fallback: Record<EnemyClass, string> = {
    GREMLIN: 'Veil Gremlin',
    APPARITION: 'Hostile Apparition',
    ABOMINATION: 'Incursion Abomination',
  };
  return skins[key]?.[classType] ?? `${sector.subsector} ${fallback[classType]}`;
}

export function intentLabel(intent: EnemyIntent, designation: string): string {
  const labels: Record<EnemyIntent, string> = {
    STRIKE: `${designation} intends to STRIKE`,
    STRIP_STAMINA: `${designation} intends to STRIP STAMINA`,
    SIPHON_ABYSSAL: `${designation} intends to SIPHON ABYSSAL ENERGY`,
    EVADE: `${designation} intends to EVADE (50% damage reduction)`,
    CHARGE: `${designation} is CHARGING a world-ender (turn ${1}/3)`,
    WORLD_ENDER: `${designation} intends WORLD-ENDER (UNBLOCKABLE)`,
    FORTIFY: `${designation} intends to FORTIFY`,
    OVERDRIVE_DISCHARGE: `${designation} intends OVERDRIVE DISCHARGE (18 DMG)`,
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
    MEMORY_LEECH: `${designation} leeches augment memory`,
    FIELD_REPAIR: `${designation} intends FIELD REPAIR`,
  };
  return labels[intent];
}

export interface SpawnEnemyOptions {
  resonancePercent?: number;
  forcedAffinity?: EnemyAffinity;
  district?: DistrictId;
  /** Operative snapshot for opening intent selection. */
  playerState?: PlayerAIState;
}

export function spawnEnemyProfile(
  sector: SectorDefinition,
  nodeIndex: number,
  isEliteAmbush = false,
  options?: SpawnEnemyOptions,
): EnemyCombatProfile {
  const classType = pickEnemyClass(nodeIndex, isEliteAmbush);
  const scale = getNodeScale(nodeIndex);
  const designation = biomeSkin(classType, sector);
  const maxHp = Math.floor(CLASS_BASE_HP[classType] * scale);
  const baseDamage = Math.floor(CLASS_BASE_DAMAGE[classType] * scale);
  const district = options?.district ?? 1;
  const intent = rollEnemyIntent(classType, 0, district, options?.playerState);

  return {
    class: classType,
    designation,
    maxHp,
    currentHp: maxHp,
    baseDamage,
    intent,
    chargeTurns: 0,
    evadeActive: false,
    nodeIndex,
    scale,
  };
}

const HARD_TEST_INTENTS: EnemyIntent[] = ['STRIKE', 'STRIP_STAMINA', 'EVADE'];

function rollHardTestIntent(playerState?: PlayerAIState): EnemyIntent {
  const profile = {
    class: 'APPARITION' as const,
    currentHp: 200,
    maxHp: 200,
    baseDamage: 12,
    chargeTurns: 0,
    intent: 'STRIKE' as const,
    evadeActive: false,
  };
  const enemyState = enemyAIStateFromProfile(
    { ...profile, designation: '', nodeIndex: 0, scale: 1 },
    1,
  );
  const valid = HARD_TEST_INTENTS.filter((intent) => {
    const ctx = {
      enemy: enemyState,
      player: playerState ?? defaultPlayerAIState(),
    };
    if (intent === 'STRIP_STAMINA' && ctx.player.stamina <= 0) return false;
    if (intent === 'EVADE' && enemyState.activeBuffs.includes('Evade')) return false;
    return true;
  });
  const pool = valid.length > 0 ? valid : ['STRIKE' as const];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Defend-the-Rift horde — survive N enemy turns; near-indestructible gutter goliath shell. */
export function spawnDefendRiftHordeProfile(nodeIndex: number): EnemyCombatProfile {
  const profile = spawnRosterUnit(ENEMY_ROSTER['gutter-goliath'], nodeIndex, { forcedElite: true });
  return {
    ...profile,
    designation: 'GUTTER GOLIATH // RIFT DEFENSE HORDE',
    maxHp: 9999,
    currentHp: 9999,
    baseDamage: Math.floor(profile.baseDamage * 1.2),
  };
}

/** Resonance hunter ambush — null shade from the established roster. */
export function spawnVeilStalkerProfile(nodeIndex: number): EnemyCombatProfile {
  return {
    ...spawnRosterUnit(ENEMY_ROSTER['null-shade'], nodeIndex, { forcedElite: true }),
    isVeilStalker: true,
  };
}

/** Grid-Hound apex ambush — mandatory fight when caught on overworld at 75%+ resonance. */
export function spawnGridHoundProfile(nodeIndex: number): EnemyCombatProfile {
  const depth = nodeIndex + 1;
  const district = depth <= 15 ? 1 : depth <= 30 ? 2 : 3;
  return {
    ...spawnRosterUnit(ENEMY_ROSTER['fracture-hound'], nodeIndex, {
      forcedElite: true,
      isApex: true,
      apexBudget: 8,
      district: district as 1 | 2 | 3,
    }),
    isGridHound: true,
    designation: 'GRID-HOUND // APEX VEIL PREDATOR',
  };
}

export function createEasyTestEnemy(): EnemyCombatProfile {
  return {
    class: 'GREMLIN',
    designation: 'TEST DRONE // STRIKE ONLY',
    maxHp: 40,
    currentHp: 40,
    baseDamage: 8,
    intent: 'STRIKE',
    chargeTurns: 0,
    evadeActive: false,
    nodeIndex: 0,
    scale: 1,
    testPreset: 'easy',
  };
}

export function createHardTestEnemy(playerState?: PlayerAIState): EnemyCombatProfile {
  const intent = rollHardTestIntent(playerState);
  return {
    class: 'APPARITION',
    designation: 'TEST APPARITION // FULL KIT',
    maxHp: 200,
    currentHp: 200,
    baseDamage: 12,
    intent,
    chargeTurns: 0,
    evadeActive: false,
    nodeIndex: 0,
    scale: 1,
    testPreset: 'hard',
  };
}

export function advanceEnemyIntent(
  profile: EnemyCombatProfile,
  district: DistrictId = 1,
  playerState?: PlayerAIState,
  squad?: EnemyCombatProfile[],
  options?: { hasAshToken?: boolean },
): EnemyCombatProfile {
  if (profile.testPreset === 'easy') {
    return {
      ...profile,
      chargeTurns: 0,
      intent: 'STRIKE',
      evadeActive: false,
    };
  }

  if (profile.testPreset === 'hard') {
    let nextIntent = rollHardTestIntent(playerState);
    if (isRedundantBuffIntent(nextIntent, profile)) nextIntent = 'STRIKE';
    return {
      ...profile,
      chargeTurns: 0,
      intent: nextIntent,
      evadeActive: false,
    };
  }

  const synced = syncRosterCombatState(profile);

  let chargeTurns = synced.chargeTurns;
  if (synced.intent === 'CHARGE') chargeTurns += 1;
  else if (synced.intent !== 'WORLD_ENDER') chargeTurns = 0;

  let nextIntent = synced.rosterId
    ? (decideRosterIntent({ ...synced, chargeTurns }, district, playerState, squad, options) ?? decideEnemyIntent({
        enemy: enemyAIStateFromProfile({ ...synced, chargeTurns }, district),
        player: playerState ?? defaultPlayerAIState(),
      }))
    : decideEnemyIntent({
        enemy: enemyAIStateFromProfile({ ...synced, chargeTurns }, district),
        player: playerState ?? defaultPlayerAIState(),
      });

  if (isRedundantBuffIntent(nextIntent, synced)) {
    nextIntent = 'STRIKE';
  }

  const clearsEvadePosture = nextIntent === 'STRIKE'
    || nextIntent === 'DOUBLE_STRIKE'
    || nextIntent === 'WORLD_ENDER'
    || nextIntent === 'PAVEMENT_CRUSHER';

  const telegraphLocked = synced.rosterId === 'concrete-gargoyle'
    && (synced.queuedAction === 'SLAM' || synced.isCharging);
  const nextCharging = synced.rosterId === 'concrete-gargoyle'
    ? nextIntent === 'PAVEMENT_CRUSHER_CHARGE'
      ? true
      : nextIntent === 'PAVEMENT_CRUSHER'
        ? false
        : synced.isCharging
    : synced.isCharging;

  return syncRosterCombatState({
    ...synced,
    chargeTurns,
    intent: nextIntent,
    evadeActive: telegraphLocked ? false : clearsEvadePosture ? false : synced.evadeActive,
    isCharging: nextCharging,
    rosterAbilityCooldown: synced.rosterId === 'null-shade' && (synced.rosterAbilityCooldown ?? 0) > 0
      ? (synced.rosterAbilityCooldown ?? 0) - 1
      : synced.rosterAbilityCooldown,
  });
}
