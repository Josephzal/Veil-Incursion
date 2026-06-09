import type { EnvironmentType } from './sector';

export type EnemyAffinity = 'SPECTRAL' | 'CORPOREAL' | 'CHRONO';

export const BLOOD_FRENZY_RESONANCE_THRESHOLD = 70;
export const BLOOD_FRENZY_LIFESTEAL_PCT = 0.15;

export const AFFINITY_DISPLAY_LABEL: Record<EnemyAffinity, string> = {
  SPECTRAL: 'Spectral',
  CORPOREAL: 'Corporeal',
  CHRONO: 'Chrono',
};

export interface EnvironmentCombatProfile {
  hazardLabel: string;
  advantageLabel: string;
  meleeDamageBonusPct: number;
  staminaCostReductionPct: number;
  blindBreachSoulAnchorLoss: number;
  blindBreachSoulAnchorLossPct: number;
  blindBreachResonanceSpike: number;
}

export const ENVIRONMENT_COMBAT_PROFILE: Record<EnvironmentType, EnvironmentCombatProfile> = {
  SUBWAY_CHASM: {
    hazardLabel: 'COLLAPSED_CONCRETE // STATIC_SHRIEK',
    advantageLabel: 'Close quarters — melee tracking +15%',
    meleeDamageBonusPct: 15,
    staminaCostReductionPct: 0,
    blindBreachSoulAnchorLoss: 20,
    blindBreachSoulAnchorLossPct: 0,
    blindBreachResonanceSpike: 0,
  },
  BLEEDING_HIGH_RISE: {
    hazardLabel: 'WARDED_FIREWALLS // AUTOMATED_DEFENSES',
    advantageLabel: 'Tactical geometry — counter window +10%',
    meleeDamageBonusPct: 0,
    staminaCostReductionPct: 0,
    blindBreachSoulAnchorLoss: 0,
    blindBreachSoulAnchorLossPct: 0,
    blindBreachResonanceSpike: 25,
  },
  DESECRATED_SANCTUARY: {
    hazardLabel: 'HEX_WALLS // EMOTIONAL_FEEDBACK',
    advantageLabel: 'Occult nexus — melee stamina strain −25%',
    meleeDamageBonusPct: 0,
    staminaCostReductionPct: 25,
    blindBreachSoulAnchorLoss: 0,
    blindBreachSoulAnchorLossPct: 15,
    blindBreachResonanceSpike: 0,
  },
};

export interface AegisCombatContext {
  environmentType: EnvironmentType | null;
  resonancePercent: number;
  bloodFrenzyActive: boolean;
  meleeDamageBonusPct: number;
  staminaCostReductionPct: number;
  parryWindowBonusPct: number;
}
