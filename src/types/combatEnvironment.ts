export type EnemyAffinity = 'SPECTRAL' | 'CORPOREAL' | 'CHRONO';

export const BLOOD_FRENZY_RESONANCE_THRESHOLD = 70;
export const BLOOD_FRENZY_LIFESTEAL_PCT = 0.15;

export const AFFINITY_DISPLAY_LABEL: Record<EnemyAffinity, string> = {
  SPECTRAL: 'Spectral',
  CORPOREAL: 'Corporeal',
  CHRONO: 'Chrono',
};
