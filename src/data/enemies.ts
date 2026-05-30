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
  if (roll < 0.35) return 'SIPHON_KINETIC';
  if (roll < 0.55) return 'EVADE';
  return 'STRIKE';
}

export function intentLabel(intent: EnemyIntent, designation: string): string {
  const labels: Record<EnemyIntent, string> = {
    STRIKE: `${designation} intends to STRIKE`,
    STRIP_STAMINA: `${designation} intends to STRIP STAMINA`,
    SIPHON_KINETIC: `${designation} intends to SIPHON KINETIC ENERGY`,
    EVADE: `${designation} intends to EVADE (50% damage reduction)`,
    CHARGE: `${designation} is CHARGING a world-ender (turn ${1}/3)`,
    WORLD_ENDER: `${designation} intends WORLD-ENDER (UNBLOCKABLE)`,
    FORTIFY: `${designation} intends to FORTIFY`,
  };
  return labels[intent];
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

export function advanceEnemyIntent(profile: EnemyCombatProfile): EnemyCombatProfile {
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
