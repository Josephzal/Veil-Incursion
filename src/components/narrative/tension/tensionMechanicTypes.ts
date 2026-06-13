import type { NarrativePenalty, TensionMechanic } from '../../../types/narrativeAssembly';

export interface TensionMechanicProps {
  onSuccess: () => void;
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
  return raw.replace('Mechanic_', '').replace(/_/g, ' ').toUpperCase();
}
