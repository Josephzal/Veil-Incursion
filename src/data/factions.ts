import { FactionModifiers, FactionType } from '../types/game';

export interface FactionDefinition {
  id: FactionType;
  displayName: string;
  tagline: string;
  perks: FactionModifiers;
  /** One-time Cabal Credit bonus on allegiance commit. */
  alignmentBonusCredits: number;
  accentColor: string;
  secondaryColor: string;
  backgroundColor: string;
  borderColor: string;
  typographyColor: string;
}

const NEUTRAL_MODIFIERS: FactionModifiers = {
  maxHpBonus: 0,
  damageMitigation: 0,
  maxStaminaBonus: 0,
  critChanceBonus: 0,
  staminaRegenBonus: 0,
  calibrationBonus: 0,
};

export const FACTION_DEFINITIONS: Record<FactionType, FactionDefinition> = {
  TERRAN_GRID: {
    id: 'TERRAN_GRID',
    displayName: 'TERRAN GRID',
    tagline: 'High-tech counter-espionage network caging the Veil.',
    perks: {
      ...NEUTRAL_MODIFIERS,
      maxHpBonus: 25,
      damageMitigation: 0.15,
    },
    alignmentBonusCredits: 200,
    accentColor: '#94a3b8',
    secondaryColor: '#cbd5e1',
    backgroundColor: '#1e293b',
    borderColor: '#64748b',
    typographyColor: '#f8fafc',
  },
  LEGION: {
    id: 'LEGION',
    displayName: 'LEGION',
    tagline: 'Interdimensional void collective worshiping the rift vacuum.',
    perks: {
      ...NEUTRAL_MODIFIERS,
      maxStaminaBonus: 15,
      critChanceBonus: 0.1,
    },
    alignmentBonusCredits: 200,
    accentColor: '#7c3aed',
    secondaryColor: '#a78bfa',
    backgroundColor: '#0a0612',
    borderColor: '#4c1d95',
    typographyColor: '#ddd6fe',
  },
  SOLARIS: {
    id: 'SOLARIS',
    displayName: 'SOLARIS',
    tagline: 'Astrophysics star-fire collective splitting reality with fusion.',
    perks: {
      ...NEUTRAL_MODIFIERS,
      staminaRegenBonus: 0.2,
      calibrationBonus: 5,
    },
    alignmentBonusCredits: 200,
    accentColor: '#dc2626',
    secondaryColor: '#fbbf24',
    backgroundColor: '#1a0a0a',
    borderColor: '#991b1b',
    typographyColor: '#fef3c7',
  },
};

export function getFactionDefinition(faction: FactionType): FactionDefinition {
  return FACTION_DEFINITIONS[faction];
}

export function getFactionAccent(faction: FactionType | null): string {
  if (!faction) return '#00ff33';
  return FACTION_DEFINITIONS[faction].accentColor;
}

/** Dossier left accent stripe — distinct from UI accent chips. */
export function getDossierFactionAccent(faction: FactionType | null): string {
  if (!faction) return '#64748B';
  const accents: Record<FactionType, string> = {
    TERRAN_GRID: '#64748B',
    LEGION: '#7C3AED',
    SOLARIS: '#D97706',
  };
  return accents[faction];
}
