import type { IncursionBiome } from '../types/game';
import { pickBiomeCombatDesignation } from './biomeCombat';
import { EnemyClass, EnemyCombatProfile, EnemyIntent, SectorDefinition } from '../types/run';

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

/** Scale = 1 + (currentNode * 0.15) where currentNode is 0-indexed encounter index. */
export function getNodeScale(nodeIndex: number): number {
  return 1 + nodeIndex * 0.15;
}

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

export function rollEnemyIntent(classType: EnemyClass, chargeTurns: number): EnemyIntent {
  if (classType === 'ABOMINATION') {
    if (chargeTurns >= 2) return 'WORLD_ENDER';
    if (chargeTurns > 0) return 'CHARGE';
    return Math.random() < 0.55 ? 'CHARGE' : 'STRIKE';
  }
  if (classType === 'GREMLIN') {
    return Math.random() < 0.45 ? 'STRIP_STAMINA' : 'STRIKE';
  }
  const roll = Math.random();
  if (roll < 0.35) return 'SIPHON_ABYSSAL';
  if (roll < 0.55) return 'EVADE';
  return 'STRIKE';
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
  };
  return labels[intent];
}

export function spawnBiomeEnemyProfile(
  biome: IncursionBiome,
  nodeIndex: number,
  isEliteAmbush = false,
): EnemyCombatProfile {
  const classType = pickEnemyClass(nodeIndex, isEliteAmbush);
  const scale = getNodeScale(nodeIndex);
  const designation = pickBiomeCombatDesignation(biome, false);
  const maxHp = Math.floor(CLASS_BASE_HP[classType] * scale);
  const baseDamage = Math.floor(CLASS_BASE_DAMAGE[classType] * scale);
  const intent = rollEnemyIntent(classType, 0);

  return {
    class: classType,
    designation,
    maxHp,
    currentHp: maxHp,
    baseDamage,
    intent,
    chargeTurns: 0,
    evadeActive: intent === 'EVADE',
    nodeIndex,
    scale,
  };
}

export function spawnEnemyProfile(
  sector: SectorDefinition,
  nodeIndex: number,
  isEliteAmbush = false,
): EnemyCombatProfile {
  const classType = pickEnemyClass(nodeIndex, isEliteAmbush);
  const scale = getNodeScale(nodeIndex);
  const designation = biomeSkin(classType, sector);
  const maxHp = Math.floor(CLASS_BASE_HP[classType] * scale);
  const baseDamage = Math.floor(CLASS_BASE_DAMAGE[classType] * scale);
  const intent = rollEnemyIntent(classType, 0);

  return {
    class: classType,
    designation,
    maxHp,
    currentHp: maxHp,
    baseDamage,
    intent,
    chargeTurns: 0,
    evadeActive: intent === 'EVADE',
    nodeIndex,
    scale,
  };
}

function rollHardTestIntent(): EnemyIntent {
  const roll = Math.random();
  if (roll < 0.3) return 'SIPHON_ABYSSAL';
  if (roll < 0.5) return 'EVADE';
  if (roll < 0.7) return 'STRIP_STAMINA';
  return 'STRIKE';
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

export function createHardTestEnemy(): EnemyCombatProfile {
  const intent = rollHardTestIntent();
  return {
    class: 'APPARITION',
    designation: 'TEST APPARITION // FULL KIT',
    maxHp: 200,
    currentHp: 200,
    baseDamage: 12,
    intent,
    chargeTurns: 0,
    evadeActive: intent === 'EVADE',
    nodeIndex: 0,
    scale: 1,
    testPreset: 'hard',
  };
}

export function advanceEnemyIntent(profile: EnemyCombatProfile): EnemyCombatProfile {
  if (profile.testPreset === 'easy') {
    return {
      ...profile,
      chargeTurns: 0,
      intent: 'STRIKE',
      evadeActive: false,
    };
  }

  if (profile.testPreset === 'hard') {
    const nextIntent = rollHardTestIntent();
    return {
      ...profile,
      chargeTurns: 0,
      intent: nextIntent,
      evadeActive: nextIntent === 'EVADE',
    };
  }

  let chargeTurns = profile.chargeTurns;
  if (profile.intent === 'CHARGE') chargeTurns += 1;
  else if (profile.intent !== 'WORLD_ENDER') chargeTurns = 0;

  const nextIntent = rollEnemyIntent(profile.class, chargeTurns);
  return {
    ...profile,
    chargeTurns,
    intent: nextIntent,
    evadeActive: nextIntent === 'EVADE',
  };
}
