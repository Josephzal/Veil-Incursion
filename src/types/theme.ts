import { FactionType } from './game';
import { CabalAlignment } from './profile';

export interface TerminalTheme {
  primaryColor: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  statusColor: string;
  bootLog: string;
  borderWidth: number;
  borderStyle: 'solid' | 'dashed';
  logoGlyph: string;
}

export const FACTION_THEMES: Record<CabalAlignment, TerminalTheme> = {
  TERRAN_GRID: {
    primaryColor: '#FFFFFF',
    backgroundColor: '#1A1C1E',
    borderColor: '#475569',
    textColor: '#F8FAFC',
    mutedColor: '#94A3B8',
    statusColor: '#CBD5E1',
    bootLog: 'TERRAN_GRID_OS v9.1 // TACTICAL SECURE NODE // SYSTEMS LOCK',
    borderWidth: 2,
    borderStyle: 'solid',
    logoGlyph: [
      '╔══════════════════╗',
      '║  TERRAN GRID OS  ║',
      '║  ▓▓▓ SECURE ▓▓▓  ║',
      '╚══════════════════╝',
    ].join('\n'),
  },
  LEGION: {
    primaryColor: '#A349A4',
    backgroundColor: '#050505',
    borderColor: '#6B21A8',
    textColor: '#DDD6FE',
    mutedColor: '#7C3AED',
    statusColor: '#A349A4',
    bootLog: 'LEGION.NETWORK // OVERRIDING FREQUENCY // WE ARE MANY // LISTEN TO THE COLD',
    borderWidth: 1,
    borderStyle: 'dashed',
    logoGlyph: [
      '    ◇ ╱ ◇',
      '  ◇   ◇   ◇',
      ' LEGION.NET',
      '  ◇   ◇   ◇',
      '    ◇ ╲ ◇',
    ].join('\n'),
  },
  SOLARIS: {
    primaryColor: '#FF3333',
    backgroundColor: '#111111',
    borderColor: '#FFD700',
    textColor: '#FEE2E2',
    mutedColor: '#991B1B',
    statusColor: '#FFD700',
    bootLog: 'SOLARIS CORE // THERMAL ENERGY HARVEST // WARNING: KINETIC FRICTION AT CAPACITY',
    borderWidth: 2,
    borderStyle: 'solid',
    logoGlyph: [
      '   ☀ SOLARIS ☀',
      '  ╱╲╱╲╱╲╱╲╱╲',
      ' THERMAL CORE',
      '  ╲╱╲╱╲╱╲╱╲╱',
    ].join('\n'),
  },
};

export type FactionTheme = TerminalTheme;

export function getTerminalTheme(faction: FactionType): TerminalTheme {
  return FACTION_THEMES[faction];
}

export function getVictoriousFaction(influence: Record<FactionType, number>): FactionType {
  const entries = (Object.entries(influence) as [FactionType, number][]).sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}
