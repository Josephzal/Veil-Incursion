import type { BossRuntimeProfile, DistrictBossVariant } from '../types/game';
import { getDepthScale } from './descentEngine';
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
  10: {
    name: 'HOLLOWED PRECINCT // GATE WARDEN',
    maxHp: 220,
    variant: 'STANDARD',
    bodyCount: 1,
    kineticArmor: 3,
    occultWards: 1,
    baseDamage: 11,
    logLine: '>> DISTRICT GATE — Hollowed Precinct manifest. Kinetic armor heavy.',
  },
  20: {
    name: 'CHOIR OF RUST // TRIPTYCH ANCHOR',
    maxHp: 280,
    variant: 'SHARED_CHOIR',
    bodyCount: 3,
    kineticArmor: 1,
    occultWards: 2,
    baseDamage: 10,
    logLine: '>> DISTRICT GATE — Choir of Rust triptych. Shared anomaly HP pool.',
  },
  30: {
    name: 'RIFT-WALKER PRIME // DEEP VEIL CORE',
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
  const scale = getDepthScale(Math.max(1, Math.floor(depth / 10)));
  if (isPrimeBossDepth(depth) && GATE_BOSSES[30]) {
    const def = GATE_BOSSES[30];
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
    return {
      name: def.name,
      maxHp: Math.floor(def.maxHp * (depth === 20 ? scale : 1)),
      currentHp: Math.floor(def.maxHp * (depth === 20 ? scale : 1)),
      currentPhase: 1,
      phases: DEFAULT_BOSS_PHASES,
      depth: depth === 10 ? 1 : 2,
      variant: def.variant,
      bodyCount: def.bodyCount,
    };
  }
  const fallback = GATE_BOSSES[10];
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
  if (isPrimeBossDepth(depth)) return GATE_BOSSES[30];
  if (isDistrictGateDepth(depth) && GATE_BOSSES[depth]) return GATE_BOSSES[depth];
  return GATE_BOSSES[10];
}

export function districtBossLogLine(depth: number): string {
  return districtBossDefinitionForDepth(depth).logLine;
}
