import type { NarrativePenalty, TensionMechanic } from '../../../types/narrativeAssembly';

export interface TensionMechanicSuccessResult {
  /** Extra run credits earned inside a tension mini-game (e.g. ScavengeBar). */
  bonusCredits?: number;
}

export interface TensionMechanicProps {
  onSuccess: (result?: TensionMechanicSuccessResult) => void;
  onFailure: () => void;
  defaultPenalty?: NarrativePenalty;
}

export interface TensionMechanicHostProps extends TensionMechanicProps {
  tensionMechanic?: TensionMechanic;
  /** Shown when `tensionMechanic` is missing or unrecognized. */
  fallbackLabel?: string;
  penaltyPreview?: string;
  borderColor?: string;
  mutedColor?: string;
  primaryColor?: string;
}

export function formatTensionMechanicLabel(raw?: TensionMechanic | string): string {
  if (!raw) return 'TENSION PROTOCOL';
  if (raw === 'Mechanic_SigilTrace') return 'GRID CIPHER';
  return raw.replace('Mechanic_', '').replace(/_/g, ' ').toUpperCase();
}
