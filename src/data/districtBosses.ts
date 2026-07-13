import type { BossRuntimeProfile, DistrictBossVariant } from '../types/game';
import { getLevelsPerDistrict } from '../types/sectorPacing';
import { getDepthScale } from './descentScaling';
import { isDistrictGateDepth, isPrimeBossDepth } from './districtPacing';

export interface DistrictBossDefinition {
  name: string;
  maxHp: number;
  variant: DistrictBossVariant;
  bodyCount: number;
  kineticArmor: number;
  occultWards: number;
  baseDamage: number;
  logLine: string;
}

const GATE_BOSSES: Record<number, DistrictBossDefinition> = {
  15: {
    name: 'HOLLOWED PRECINCT',
    maxHp: 220,
    variant: 'STANDARD',
    bodyCount: 1,
    kineticArmor: 3,
    occultWards: 1,
    baseDamage: 11,
    logLine: '>> DISTRICT GATE — Hollowed Precinct manifest. Kinetic armor heavy.',
  },
  30: {
    name: 'CHOIR OF RUST',
    maxHp: 280,
    variant: 'SHARED_CHOIR',
    bodyCount: 3,
    kineticArmor: 1,
    occultWards: 2,
    baseDamage: 10,
    logLine: '>> DISTRICT GATE — Choir of Rust triptych. Shared anomaly HP pool.',
  },
  45: {
    name: 'PRIMEVAL RIFT-WALKER',
    maxHp: 360,
    variant: 'STANDARD',
    bodyCount: 1,
    kineticArmor: 2,
    occultWards: 3,
    baseDamage: 16,
    logLine: '>> PRIME NEST — Rift-Walker ascendant. Occult wards saturated.',
  },
};

const DEFAULT_BOSS_PHASES = [
  {
    phaseNumber: 1,
    phaseName: 'Standard Operations',
    triggerHpThreshold: 51,
    intentModifier: 'District gate assault pattern',
  },
  {
    phaseNumber: 2,
    phaseName: 'Rift Overdrive',
    triggerHpThreshold: 50,
    intentModifier: 'Catastrophic overdrive discharge',
  },
];

export function createDistrictGateBossProfile(depth: number): BossRuntimeProfile {
  const districtIndex = Math.max(1, Math.ceil(depth / getLevelsPerDistrict()));
  const scale = getDepthScale(districtIndex);
  if (isPrimeBossDepth(depth) && GATE_BOSSES[45]) {
    const def = GATE_BOSSES[45];
    return {
      name: def.name,
      maxHp: def.maxHp,
      currentHp: def.maxHp,
      currentPhase: 1,
      phases: DEFAULT_BOSS_PHASES,
      depth: 3,
      variant: def.variant,
      bodyCount: def.bodyCount,
    };
  }
  if (isDistrictGateDepth(depth) && GATE_BOSSES[depth]) {
    const def = GATE_BOSSES[depth];
    const scaledHp = Math.floor(def.maxHp * (depth === 30 ? scale : 1));
    return {
      name: def.name,
      maxHp: scaledHp,
      currentHp: scaledHp,
      currentPhase: 1,
      phases: DEFAULT_BOSS_PHASES,
      depth: depth === 15 ? 1 : 2,
      variant: def.variant,
      bodyCount: def.bodyCount,
    };
  }
  const fallback = GATE_BOSSES[15];
  return {
    name: fallback.name,
    maxHp: fallback.maxHp,
    currentHp: fallback.maxHp,
    currentPhase: 1,
    phases: DEFAULT_BOSS_PHASES,
    depth: 1,
    variant: 'STANDARD',
    bodyCount: 1,
  };
}

export function districtBossDefinitionForDepth(depth: number): DistrictBossDefinition {
  if (isPrimeBossDepth(depth)) return GATE_BOSSES[45];
  if (isDistrictGateDepth(depth) && GATE_BOSSES[depth]) return GATE_BOSSES[depth];
  return GATE_BOSSES[15];
}

export function districtBossLogLine(depth: number): string {
  return districtBossDefinitionForDepth(depth).logLine;
}
