import type { CabalEmployerId } from '../types/worldState';

/**
 * Shared occult-terminal visual tokens for hub surfaces.
 * Presentation only — does not alter gameplay or persistence.
 *
 * Foundation is charcoal-black. Mint is reserved for live system activity.
 */
export const VEIL = {
  bg: '#040505',
  bgSoft: '#070908',
  surface1: '#0A0C0B',
  surface2: '#0E1110',
  surface3: '#131615',
  surfaceRaised: '#171A18',
  lineFaint: '#1B211F',
  line: '#29312E',
  lineStrong: '#3B4742',
  text: '#DEE3DF',
  textSoft: '#B9C1BC',
  textMuted: '#77827D',
  textDim: '#4F5955',
  bone: '#B9B5A7',
  mint: '#62CDB5',
  mintBright: '#BFF5E6',
  focus: '#BFF5E6',
  occult: '#8C739F',
  occultPale: '#B3A2C0',
  occultUnstable: '#8C739F',
  blood: '#A35C66',
  riskExtreme: '#A35C66',
  riskHigh: '#9F5963',
  riskMedium: '#77827D',
  riskLow: '#668E80',
} as const;

export type VeilToneId =
  | CabalEmployerId
  | 'BLACK_CHANNEL'
  | 'MINT'
  | 'NEUTRAL'
  | 'OCCULT'
  | 'DANGER';

export type CabalMarkKind = 'bar' | 'stamp' | 'arc' | 'fracture';

export interface VeilTone {
  id: VeilToneId;
  accent: string;
  accentSoft: string;
  accentDim: string;
  rgb: string;
  mark: CabalMarkKind;
}

const tone = (
  id: VeilToneId,
  accent: string,
  rgb: string,
  mark: CabalMarkKind = 'bar',
): VeilTone => ({
  id,
  accent,
  accentSoft: `rgba(${rgb}, 0.1)`,
  accentDim: `rgba(${rgb}, 0.28)`,
  rgb,
  mark,
});

/** Stable Cabal / channel identity → restrained accent + abstract mark. */
export const VEIL_CABAL_TONES: Record<CabalEmployerId, VeilTone> = {
  TERRAN_GRID: tone('TERRAN_GRID', '#668E80', '102, 142, 128', 'bar'),
  LEGION: tone('LEGION', '#7084A7', '112, 132, 167', 'stamp'),
  SOLARIS: tone('SOLARIS', '#927890', '146, 120, 144', 'arc'),
};

export const VEIL_BLACK_CHANNEL_TONE = tone('BLACK_CHANNEL', '#9F5963', '159, 89, 99', 'fracture');
export const VEIL_MINT_TONE = tone('MINT', VEIL.mint, '98, 205, 181', 'bar');
export const VEIL_NEUTRAL_TONE = tone('NEUTRAL', VEIL.textMuted, '119, 130, 125', 'bar');
export const VEIL_OCCULT_TONE = tone('OCCULT', VEIL.occult, '140, 115, 159', 'arc');
export const VEIL_DANGER_TONE = tone('DANGER', VEIL.blood, '163, 92, 102', 'fracture');

export function resolveCabalTone(sponsorId: CabalEmployerId): VeilTone {
  return VEIL_CABAL_TONES[sponsorId] ?? VEIL_NEUTRAL_TONE;
}

export function resolveChannelTone(
  channel: CabalEmployerId | 'BLACK_CHANNEL' | 'INDEPENDENT',
): VeilTone {
  if (channel === 'BLACK_CHANNEL' || channel === 'INDEPENDENT') return VEIL_BLACK_CHANNEL_TONE;
  return resolveCabalTone(channel);
}

export const VEIL_CHANNEL_CODES: Record<CabalEmployerId, { label: string; code: string }> = {
  TERRAN_GRID: { label: 'TERRAN CHANNEL', code: 'TG-01' },
  LEGION: { label: 'LEGION CHANNEL', code: 'LG-01' },
  SOLARIS: { label: 'SOLARIS CHANNEL', code: 'SL-01' },
};
