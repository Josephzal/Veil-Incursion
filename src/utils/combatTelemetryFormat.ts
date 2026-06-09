import type { EnemyAffinity } from '../types/combatEnvironment';
import type { EnemyIntent } from '../types/run';

export const GAUGE_SOUL_ANCHOR = '#FF453A';
export const GAUGE_ABYSSAL = '#00D2C4';
export const GAUGE_STAMINA = '#5C2D91';
export const GAUGE_HOSTILE_HP = '#FF453A';
export const GAUGE_TRACK_BORDER = 'rgba(139, 92, 246, 0.45)';

const INTENT_READOUT: Record<EnemyIntent, string> = {
  STRIKE: 'STRIKE',
  STRIP_STAMINA: 'TARGETING STAMINA RES',
  SIPHON_ABYSSAL: 'SIPHON ABYSSAL RES',
  EVADE: 'EVADE POSTURE',
  CHARGE: 'CHARGING WORLD-ENDER',
  WORLD_ENDER: 'WORLD-ENDER UNBLOCK',
  FORTIFY: 'FORTIFY',
  OVERDRIVE_DISCHARGE: 'OVERDRIVE DISCHARGE',
};

export function formatHostileId(designation: string): string {
  const slug = designation
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return slug.length > 28 ? slug.slice(0, 28) : slug;
}

export function formatIntentReadout(intent: EnemyIntent): string {
  return INTENT_READOUT[intent] ?? intent.replace(/_/g, ' ');
}

export type EnemyDeckStrikeVariant = 'hp' | 'stamina' | 'abyssal';

const HP_STRIKE_INTENTS: EnemyIntent[] = ['STRIKE', 'WORLD_ENDER', 'OVERDRIVE_DISCHARGE'];

/** Maps hostile intents to the transparent strike overlay shown on the operative deck. */
export function getEnemyDeckStrikeVariant(intent: EnemyIntent): EnemyDeckStrikeVariant | null {
  if (HP_STRIKE_INTENTS.includes(intent)) return 'hp';
  if (intent === 'STRIP_STAMINA') return 'stamina';
  if (intent === 'SIPHON_ABYSSAL') return 'abyssal';
  return null;
}

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(1, ratio));
}

export interface CombatEnemyTelemetry {
  designation: string;
  currentHp: number;
  maxHp: number;
  intent: EnemyIntent;
  affinity?: EnemyAffinity;
}
