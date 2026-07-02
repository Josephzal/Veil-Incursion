import type { ImageSourcePropType } from 'react-native';
import type { FactionType } from '../types/game';
import HubTerminalBackground from '../../assets/images/environment images/hub-terminal-bg.png';

/** Full-screen hub backdrop — hex grid terminal art. */
export const HUB_ATMOSPHERE_BACKGROUND: ImageSourcePropType = HubTerminalBackground;

/** Dark wash over backdrop art — preserves text contrast. */
export const HUB_ATMOSPHERE_SCRIM = 'rgba(0, 0, 0, 0.99)';

export const HUB_SLATE_OUTER_BORDER = '#3f3f46';
export const HUB_NAV_INACTIVE_BG = 'rgba(20, 20, 25, 0.6)';
export const HUB_NAV_INACTIVE_TOP_HIGHLIGHT = 'rgba(255, 255, 255, 0.08)';
export const HUB_NAV_INACTIVE_BORDER = 'rgba(255, 255, 255, 0.06)';

const FACTION_SLATE_BG: Record<FactionType, string> = {
  LEGION: 'rgba(10, 0, 21, 0.85)',
  TERRAN_GRID: 'rgba(8, 14, 24, 0.85)',
  SOLARIS: 'rgba(21, 6, 4, 0.85)',
};

const FACTION_SLATE_INNER_BORDER: Record<FactionType, string> = {
  LEGION: '#6b21a8',
  TERRAN_GRID: '#64748b',
  SOLARIS: '#991b1b',
};

export function resolveFactionSlateBackground(faction: FactionType | null): string {
  if (!faction) return 'rgba(8, 10, 18, 0.85)';
  return FACTION_SLATE_BG[faction];
}

/** Opaque slate fill for run screens without hub backdrop art. */
export function resolveFactionSlateBackgroundSolid(faction: FactionType | null): string {
  if (!faction) return '#080a12';
  const solid: Record<FactionType, string> = {
    LEGION: '#0a0015',
    TERRAN_GRID: '#080e18',
    SOLARIS: '#150604',
  };
  return solid[faction];
}

export function resolveFactionSlateInnerBorder(faction: FactionType | null): string {
  if (!faction) return '#64748b';
  return FACTION_SLATE_INNER_BORDER[faction];
}

/** Dimmed label tone (~60% of muted channel). */
export function hubKeyColor(mutedColor: string): string {
  if (mutedColor.startsWith('#') && mutedColor.length >= 7) {
    return `${mutedColor.slice(0, 7)}99`;
  }
  return 'rgba(148, 163, 184, 0.6)';
}
