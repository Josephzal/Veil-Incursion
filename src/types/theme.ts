import { CabalAlignment } from './index';

export interface FactionTheme {
  primaryColor: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  bootLog: string;
}

export const FACTION_THEMES: Record<CabalAlignment, FactionTheme> = {
  TERRAN_GRID: {
    primaryColor: '#FFFFFF',      // Crisp white primary fonts
    backgroundColor: '#1E293B',   // Deep matte slate-gray layouts
    borderColor: '#475569',       // Heavy brutalist borders
    textColor: '#F8FAFC',
    mutedColor: '#64748B',        // Slate data grids
    bootLog: 'TERRAN_GRID_OS v9.1 // TACTICAL SECURE NODE // SYSTEMS LOCK' //
  },
  LEGION: {
    primaryColor: '#8B5CF6',      // Shifting deep-violet primary fonts
    backgroundColor: '#090514',   // Void-black backdrops
    borderColor: '#4C1D95',       // Thin non-Euclidean geometric vectors
    textColor: '#DDD6FE',
    mutedColor: '#5B21B6',
    bootLog: 'LEGION.NETWORK // OVERRIDING FREQUENCY // WE ARE MANY // LISTEN TO THE COLD' //
  },
  SOLARIS: {
    primaryColor: '#EF4444',      // High-energy warning-crimson alerts
    backgroundColor: '#0B0F12',   // Deep charcoal-black backdrops
    borderColor: '#D97706',       // Burnished solar-gold reactor plasma indicators
    textColor: '#FEE2E2',
    mutedColor: '#991B1B',
    bootLog: 'SOLARIS CORE // THERMAL ENERGY HARVEST // WARNING: KINETIC FRICTION AT CAPACITY' //
  }
};