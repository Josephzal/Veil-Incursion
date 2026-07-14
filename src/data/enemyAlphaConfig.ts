import type { EncounterEnemyKey } from './enemyCombatConfig';
import { ALPHA_MODIFIER } from './enemyCombatConfig';
import type { EnemyRosterId } from './enemyRoster';
import type { EnemyCombatProfile } from '../types/run';

export interface AlphaArmorOverride {
  kinetic: number;
  occult: number;
}

export interface AlphaMechanicOverrides {
  baseArmor?: AlphaArmorOverride;
  regenPerTurn?: number;
  adaptiveDamageMultiplier?: number;
  physicalReflectPercent?: number;
  heatThreshold?: number;
  desperationThreshold?: number;
  desperationDamageMult?: number;
  regeneratesArmor?: boolean;
  grantsFractureImmunity?: boolean;
  grantsArmor?: number;
  kineticDeathExplosionType?: string;
  explosionDamage?: number;
  staminaDrain?: number;
  appliesBleed?: boolean;
  tetherStaminaPenalty?: number;
  disabledAugmentCount?: number;
  disableDuration?: number;
  meleeStaminaMultiplier?: number;
  glitchApCostIncrease?: number;
  maxHpDrainPercent?: number;
  attacksPerTurn?: number;
  shieldDamage?: number;
  shieldCastTarget?: string;
  immuneToOccult?: boolean;
  teleportsOnHit?: boolean;
  staminaDrainOnTeleport?: number;
  evadeChance?: number;
  piercesDefend?: boolean;
  reviveTurns?: number;
  reviveHpPercent?: number;
  evadeBuffAfterSwap?: number;
  concussiveDamageToStamina?: number;
  interceptsSingleTarget?: boolean;
  interceptsAoE?: boolean;
  healPercent?: number;
  isAoEHeal?: boolean;
  lockOnTurns?: number;
  burnedButtonCount?: number;
  chargeTurns?: number;
  damageScalingPerTurn?: number;
  rootDuration?: number;
  requiresAllyKillToFire?: boolean;
  searingDamageMultiplier?: number;
  consumesOnlyCorpses?: boolean;
  unstoppable?: boolean;
}

export interface AlphaModifiers {
  namePrefix: string;
  hpMultiplier: number;
  ftMultiplier: number;
  dmgMultiplier: number;
  mechanicOverrides?: AlphaMechanicOverrides;
}

const DEFAULT_MULTIPLIERS = {
  hpMultiplier: 1.3,
  ftMultiplier: 1.5,
  dmgMultiplier: 1.25,
} as const;

function alpha(
  namePrefix: string,
  mechanicOverrides?: AlphaMechanicOverrides,
  multipliers?: Partial<Pick<AlphaModifiers, 'hpMultiplier' | 'ftMultiplier' | 'dmgMultiplier'>>,
): AlphaModifiers {
  return {
    namePrefix,
    hpMultiplier: multipliers?.hpMultiplier ?? DEFAULT_MULTIPLIERS.hpMultiplier,
    ftMultiplier: multipliers?.ftMultiplier ?? DEFAULT_MULTIPLIERS.ftMultiplier,
    dmgMultiplier: multipliers?.dmgMultiplier ?? DEFAULT_MULTIPLIERS.dmgMultiplier,
    mechanicOverrides,
  };
}

export const ENEMY_ALPHA_CONFIG: Record<EncounterEnemyKey, AlphaModifiers> = {
  CONCRETE_GARGOYLE: alpha('Dread', { baseArmor: { kinetic: 8, occult: 2 } }),
  GUTTER_GOLIATH: alpha('Putrid', { regenPerTurn: 35 }),
  ECHOING_BRUTE: alpha('Resonant', { adaptiveDamageMultiplier: 2.0 }),
  IRON_MAIDEN: alpha('Gilded', { physicalReflectPercent: 0.40 }),
  GOLEM: alpha('Meltdown', { heatThreshold: 2 }),
  SLAG_BLOOD: alpha('Boiling', { desperationThreshold: 0.50, desperationDamageMult: 2.5 }),
  AMALGAM: alpha('Monstrous', { regeneratesArmor: true }),
  LEY_SIREN: alpha('Eclipse', { grantsArmor: 2 }),
  ASH_WEEPER: alpha('Cinder', { kineticDeathExplosionType: 'TRUE_DAMAGE', explosionDamage: 40 }),
  MIASMA_SWARM: alpha('Plague', { staminaDrain: 30, appliesBleed: true }),
  HOOK_WEAVER: alpha('Cruel', { tetherStaminaPenalty: 25 }),
  MEMORY_LEECH: alpha('Cognitive', { disabledAugmentCount: 2, disableDuration: 3 }),
  SMOG_CALLER: alpha('Suffocating', { meleeStaminaMultiplier: 3.0 }),
  WIRE_GHOUL: alpha('Neural', { glitchApCostIncrease: 2 }),
  HOLLOW_LUNG: alpha('Collapsed', { maxHpDrainPercent: 0.10 }),
  FRACTURE_HOUND: alpha('Rabid', { attacksPerTurn: 3, shieldDamage: 10 }),
  NULL_SHADE: alpha('Void', { shieldCastTarget: 'AOE' }),
  SPATIAL_GLITCH: alpha('Paradox', { staminaDrainOnTeleport: 15 }),
  SCUTTLER: alpha('Apex', { evadeChance: 0.50 }),
  SPALL: alpha('Volatile', { explosionDamage: 30, piercesDefend: true }),
  THRALL: alpha('Undying', { reviveTurns: 1, reviveHpPercent: 1.0 }),
  CUTTER: alpha('Phantom', { evadeBuffAfterSwap: 1.0 }),
  BREACHER: alpha('Siege', { concussiveDamageToStamina: 50 }),
  WARDEN: alpha('Bulwark', { interceptsAoE: true }),
  FIXER: alpha('Chief', { healPercent: 0.15, isAoEHeal: true }),
  SPOTTER: alpha('Vanguard', { lockOnTurns: 0 }),
  BURNER: alpha('Napalm', { burnedButtonCount: 2 }),
  RIVAL_HEXER: alpha('Hexed', { disabledAugmentCount: 1, disableDuration: 2 }),
  RIVAL_VEILBINDER: alpha('Bound', { grantsArmor: 1 }),
  RIVAL_REAVER: alpha('Bloodied', { attacksPerTurn: 2 }),
  SAPPER: alpha('Demolition', { chargeTurns: 0 }),
  COIL_SPIKE_SNIPER: alpha('Executioner', { lockOnTurns: 1 }),
  RESONANCE_CASTER: alpha('Harmonic', { damageScalingPerTurn: 1.0 }),
  TAR_SPITTER: alpha('Fossilizing', { rootDuration: 2 }),
  CHURN: alpha('Slaughter', { requiresAllyKillToFire: false }),
  SPLINTER: alpha('Scorching', { searingDamageMultiplier: 3.0 }),
  GRAVE_ROBBER: alpha('Gorging', { consumesOnlyCorpses: true }),
  WEEPING_GARGOYLE: alpha('Weeping', { baseArmor: { kinetic: 8, occult: 2 } }),
  PHASE_SCUTTLER: alpha('Phased', { evadeChance: 0.35, teleportsOnHit: true }),
  REMEMBERING_THRALL: alpha('Remembered', { reviveTurns: 1, reviveHpPercent: 0.45 }),
  TAR_CHOIR: alpha('Choir', { rootDuration: 2 }),
  STATIC_CALLER: alpha('Static', { meleeStaminaMultiplier: 2.5 }),
  BLOOD_RUSTED_GOLEM: alpha('Blood-Rusted', { heatThreshold: 2 }),
  ROOTBOUND_WEEPER: alpha('Rootbound', { kineticDeathExplosionType: 'TRUE_DAMAGE', explosionDamage: 22, rootDuration: 1 }),
  ANCHOR_HUSK: alpha('Anchored', { grantsArmor: 1 }),
  CORE_SICK_AMALGAM: alpha('Core-Sick', { regeneratesArmor: true }),
  VOID_LOCK_MEMORY_LEECH: alpha('Void-Lock', { disabledAugmentCount: 1, disableDuration: 2 }),
  GRAVE_ENGINE_CHURN: alpha('Grave-Engine', { requiresAllyKillToFire: true }),
  NULL_CROWN_SHADE: alpha('Null-Crown', { immuneToOccult: true, shieldCastTarget: 'AOE' }),
  CHOIR_BOUND_RESONANCE_CASTER: alpha('Choir-Bound', { damageScalingPerTurn: 0.75 }),
  RIFT_SPIKE_SNIPER: alpha('Rift', { lockOnTurns: 2 }),
  RIOT_VANGUARD: alpha('Resonant', { adaptiveDamageMultiplier: 2.0 }),
};

const ROSTER_TO_ENCOUNTER: Partial<Record<EnemyRosterId, EncounterEnemyKey>> = {
  'fracture-hound': 'FRACTURE_HOUND',
  'echoing-brute': 'ECHOING_BRUTE',
  'ley-siren': 'LEY_SIREN',
  'ash-weeper': 'ASH_WEEPER',
  'miasma-tick-swarm': 'MIASMA_SWARM',
  'null-shade': 'NULL_SHADE',
  'spatial-glitch': 'SPATIAL_GLITCH',
  'gutter-goliath': 'GUTTER_GOLIATH',
  'concrete-gargoyle': 'CONCRETE_GARGOYLE',
  'spall': 'SPALL',
  'scuttler': 'SCUTTLER',
  'thrall': 'THRALL',
  'hook-weaver': 'HOOK_WEAVER',
  'memory-leech': 'MEMORY_LEECH',
  'smog-caller': 'SMOG_CALLER',
  'iron-maiden': 'IRON_MAIDEN',
  'golem': 'GOLEM',
  'slag-blood': 'SLAG_BLOOD',
  'sapper': 'SAPPER',
  'coil-spike-sniper': 'COIL_SPIKE_SNIPER',
  'resonance-caster': 'RESONANCE_CASTER',
  'tar-spitter': 'TAR_SPITTER',
  'churn': 'CHURN',
  'splinter': 'SPLINTER',
  'breacher': 'BREACHER',
  'cutter': 'CUTTER',
  'warden': 'WARDEN',
  'fixer': 'FIXER',
  'spotter': 'SPOTTER',
  'burner': 'BURNER',
  'rival-hexer': 'RIVAL_HEXER',
  'rival-veilbinder': 'RIVAL_VEILBINDER',
  'rival-reaver': 'RIVAL_REAVER',
  'amalgam': 'AMALGAM',
  'wire-ghoul': 'WIRE_GHOUL',
  'hollow-lung': 'HOLLOW_LUNG',
  'grave-robber': 'GRAVE_ROBBER',
  'weeping-gargoyle': 'WEEPING_GARGOYLE',
  'phase-scuttler': 'PHASE_SCUTTLER',
  'remembering-thrall': 'REMEMBERING_THRALL',
  'tar-choir': 'TAR_CHOIR',
  'static-caller': 'STATIC_CALLER',
  'blood-rusted-golem': 'BLOOD_RUSTED_GOLEM',
  'rootbound-weeper': 'ROOTBOUND_WEEPER',
  'anchor-husk': 'ANCHOR_HUSK',
  'core-sick-amalgam': 'CORE_SICK_AMALGAM',
  'void-lock-memory-leech': 'VOID_LOCK_MEMORY_LEECH',
  'grave-engine-churn': 'GRAVE_ENGINE_CHURN',
  'null-crown-shade': 'NULL_CROWN_SHADE',
  'choir-bound-resonance-caster': 'CHOIR_BOUND_RESONANCE_CASTER',
  'rift-spike-sniper': 'RIFT_SPIKE_SNIPER',
};

export function getAlphaConfigForRoster(rosterId: EnemyRosterId): AlphaModifiers | null {
  const key = ROSTER_TO_ENCOUNTER[rosterId];
  if (!key) return null;
  return ENEMY_ALPHA_CONFIG[key] ?? null;
}

export function getAlphaMechanic<T>(
  profile: Pick<EnemyCombatProfile, 'alphaMechanics'>,
  key: keyof AlphaMechanicOverrides,
  fallback: T,
): T {
  const value = profile.alphaMechanics?.[key];
  return (value as T | undefined) ?? fallback;
}

/** Charge cycles after LASER_SIGHT before TRUE SHOT (standard = 1, alpha Executioner = 0). */
export function resolveCoilSniperLockWindUp(
  profile: Pick<EnemyCombatProfile, 'alphaMechanics'>,
): number {
  const lockTurns = getAlphaMechanic(profile, 'lockOnTurns', 2);
  return Math.max(0, lockTurns - 1);
}

export function applyAlphaToEnemyProfile(
  profile: EnemyCombatProfile,
  rosterId: EnemyRosterId,
  options: { isAlpha: boolean; baseDesignation: string },
): EnemyCombatProfile {
  if (!options.isAlpha) {
    return { ...profile, isAlpha: false };
  }

  const config = getAlphaConfigForRoster(rosterId);
  if (!config) {
    return {
      ...profile,
      isAlpha: true,
      enemyActionPoints: 2,
      enemyMaxActionPoints: 2,
    };
  }

  const overrides = config.mechanicOverrides ?? {};
  let next: EnemyCombatProfile = {
    ...profile,
    isAlpha: true,
    designation: `${config.namePrefix} ${options.baseDesignation}`,
    enemyActionPoints: 2,
    enemyMaxActionPoints: 2,
    alphaMechanics: { ...overrides },
    fractureMax: Math.floor((profile.fractureMax ?? 100) * (config.ftMultiplier ?? ALPHA_MODIFIER.ftMult)),
    fractureGauge: profile.fractureGauge ?? 0,
  };

  if (overrides.baseArmor) {
    next = {
      ...next,
      kineticArmor: overrides.baseArmor.kinetic,
      occultWards: overrides.baseArmor.occult,
      baseKineticArmor: overrides.baseArmor.kinetic,
      baseOccultWards: overrides.baseArmor.occult,
    };
  }

  if (typeof overrides.evadeChance === 'number') {
    next = { ...next, evadeChance: overrides.evadeChance };
  }

  if (overrides.interceptsAoE === true) {
    next = { ...next, wardenInterceptsAoE: true };
  }

  if (typeof overrides.heatThreshold === 'number') {
    next = { ...next, golemHeatVentThreshold: overrides.heatThreshold };
  }

  if (overrides.chargeTurns === 0) {
    next = { ...next, alphaInstantArtillery: true };
  }

  if (overrides.lockOnTurns === 0) {
    next = { ...next, alphaInstantLockOn: true };
    if (rosterId === 'spotter') {
      next = { ...next, spotterLockedOn: true, isCharging: true };
    }
  }

  if (typeof overrides.lockOnTurns === 'number' && overrides.lockOnTurns > 0) {
    next = { ...next, alphaLockOnTurns: overrides.lockOnTurns };
    if (rosterId === 'coil-spike-sniper' && overrides.lockOnTurns === 1) {
      next = {
        ...next,
        isCharging: true,
        queuedAction: 'LASER_FIRE',
        laserLockTurnsRemaining: 0,
      };
    }
  }

  if (overrides.isAoEHeal === true) {
    next = { ...next, fixerAoEHeal: true };
  }

  if (overrides.requiresAllyKillToFire === false) {
    next = { ...next, churnSelfFiring: true };
  }

  if (typeof overrides.grantsArmor === 'number') {
    next = { ...next, leySirenGrantArmor: overrides.grantsArmor };
  }

  if (overrides.regeneratesArmor === true) {
    next = { ...next, regeneratesArmor: true };
  }

  return next;
}

/** @deprecated Alias — merges alpha modifiers onto a spawned combat profile. */
export function initializeEnemyUnit(
  profile: EnemyCombatProfile,
  rosterId: EnemyRosterId,
  isAlpha = false,
  baseDesignation?: string,
): EnemyCombatProfile {
  return applyAlphaToEnemyProfile(profile, rosterId, {
    isAlpha,
    baseDesignation: baseDesignation ?? profile.designation,
  });
}

export function resolveAlphaStatMultipliers(rosterId: EnemyRosterId): {
  hpMultiplier: number;
  dmgMultiplier: number;
  ftMultiplier: number;
} {
  const config = getAlphaConfigForRoster(rosterId);
  if (!config) {
    return { hpMultiplier: 1.3, dmgMultiplier: 1.25, ftMultiplier: 1.5 };
  }
  return {
    hpMultiplier: config.hpMultiplier,
    dmgMultiplier: config.dmgMultiplier,
    ftMultiplier: config.ftMultiplier,
  };
}
