/**
 * Occult Tactical Terminal — combat screen visual language.
 * Style-only tokens. Do not couple to combat logic.
 */

export const OTT = {
  bgBlack: '#050708',
  deepPanel: 'rgba(8, 12, 14, 0.72)',
  raisedPanel: 'rgba(10, 14, 16, 0.78)',
  borderSubtle: 'rgba(140, 170, 168, 0.32)',
  borderActive: 'rgba(98, 220, 229, 0.78)',
  borderMuted: 'rgba(120, 150, 150, 0.2)',
  textPrimary: '#D2DBD8',
  textSecondary: '#9AA8A4',
  textMuted: '#6A7874',
  terminalGreen: '#45F7A0',
  terminalGreenMuted: '#6FCF9A',
  terminalGreenDim: 'rgba(111, 207, 154, 0.55)',
  cyanSelect: '#62DCE5',
  cyanDim: 'rgba(98, 220, 229, 0.4)',
  soulRed: '#FF5A62',
  dangerRedDark: '#9E2830',
  fluxViolet: '#B07CFF',
  occultVioletMuted: '#8B6ED4',
  warningAmber: '#E0B45A',
  scanline: 'rgba(180, 200, 200, 0.035)',
  vignette: 'rgba(0, 0, 0, 0.4)',
  gridLine: 'rgba(120, 150, 150, 0.05)',
  mono: 'monospace',
  panelPad: 8,
  headerSize: 11,
  headerTracking: 1.4,
} as const;

export const OTT_LAYOUT = {
  consoleHeightPercent: '28%' as const,
  /** Matching left status + right turn chrome width so ability cards sit screen-center. */
  consoleSideWidth: 312,
  statusWidthFlex: 0.2,
  deckWidthFlex: 0.58,
  utilityWidthFlex: 0.22,
  rightRailWidthPercent: '18%' as const,
  missionTop: 8,
  missionLeft: 12,
  turnOrderTop: 8,
  turnOrderMaxWidthPercent: '42%' as const,
  railHeight: 5,
  overlayOpacity: 0.04,
} as const;

/** Cinematic battlefield staging (viewport-relative). */
export const OTT_STAGE = {
  playerLeftPercent: '15%' as const,
  playerBottomPercent: '28%' as const,
  enemyGridWidthPercent: '48%' as const,
  enemyGridRightInset: 210,
} as const;

export type OttLogTone = 'normal' | 'gain' | 'damage' | 'occult' | 'system' | 'intent';

export function resolveOttLogTone(line: string): OttLogTone {
  const upper = line.toUpperCase();
  if (
    upper.includes('NEXT //')
    || upper.includes('INTENT')
    || upper.includes('WINDUP')
    || upper.includes('TELEGRAPH')
  ) {
    return 'intent';
  }
  if (
    upper.includes('DMG')
    || upper.includes('DAMAGE')
    || upper.includes('STRIKE')
    || upper.includes('HIT')
    || upper.includes('LOST')
    || upper.includes('DEAD')
    || upper.includes('ERADICAT')
  ) {
    if (upper.includes('+') && (upper.includes('HP') || upper.includes('AP') || upper.includes('FLUX'))) {
      return 'gain';
    }
    if (
      upper.includes('DEALS')
      || upper.includes('DAMAGE')
      || upper.includes('−')
      || upper.includes('-')
      || upper.includes('LOST')
      || upper.includes('HIT FOR')
      || upper.includes('ERADICAT')
    ) {
      return 'damage';
    }
  }
  if (
    upper.includes('VEIL')
    || upper.includes('OCCULT')
    || upper.includes('WARD')
    || upper.includes('RITUAL')
    || upper.includes('CHANNEL')
    || upper.includes('HEX')
    || upper.includes('FRACTURE')
  ) {
    return 'occult';
  }
  if (
    upper.includes('+')
    || upper.includes('GAIN')
    || upper.includes('HEAL')
    || upper.includes('RECOVER')
    || upper.includes('READY')
  ) {
    return 'gain';
  }
  if (upper.startsWith('>>') || upper.includes('SYSTEM') || upper.includes('LINK')) {
    return 'system';
  }
  return 'normal';
}

export function ottLogColor(tone: OttLogTone): string {
  switch (tone) {
    case 'gain':
      return OTT.terminalGreenMuted;
    case 'damage':
      return OTT.soulRed;
    case 'occult':
      return OTT.fluxViolet;
    case 'intent':
      return OTT.warningAmber;
    case 'system':
      return OTT.textMuted;
    case 'normal':
    default:
      return OTT.textSecondary;
  }
}

/** UI-only feed polish — collapse setup noise, keep recent combat events. */
export function polishCombatFeedLines(lines: readonly string[], maxLines = 8): string[] {
  const setupRe =
    /DIRECTOR|THREAT BRIEF|BREACHING|SCANNING…|SYSTEM LINK|TELEMETRY|AWAITING|INITIALIZED|HOSTILES DETECTED|ENCOUNTER SEED/i;
  let encounterCollapsed = false;
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (setupRe.test(trimmed)) {
      if (!encounterCollapsed) {
        cleaned.push('> ENCOUNTER INITIALIZED // hostiles on grid');
        encounterCollapsed = true;
      }
      continue;
    }
    cleaned.push(trimmed);
  }

  return cleaned.slice(-maxLines);
}
