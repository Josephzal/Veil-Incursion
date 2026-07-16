import type { NarrativePenalty, TensionMechanic } from '../../../types/narrativeAssembly';

export interface TensionMechanicSuccessResult {
  /** Extra run credits earned inside a tension mini-game (e.g. ScavengeBar). */
  bonusCredits?: number;
}

export interface TensionMechanicProps {
  onSuccess: (result?: TensionMechanicSuccessResult) => void;
  onFailure: () => void;
  defaultPenalty?: NarrativePenalty;
  /** Shared difficulty — defaults to MEDIUM inside each engine when omitted. */
  difficulty?: import('../../../data/narrative/narrativeTensionDifficulty').NarrativeTensionDifficulty;
  /** Optional event id for debug telemetry. */
  narrativeEventId?: string;
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
  if (raw === 'Mechanic_SigilTrace') return 'Ritual Echo';
  if (raw === 'Mechanic_ConcealSlider') return 'Scanner Sweep';
  if (raw === 'Mechanic_CipherRite') return 'CIPHER RITE';
  if (raw === 'Mechanic_SignalAlignment') return 'Veil Lock';
  // Deprecated narrative loot bar — not the Hex Shot Dead-Man's Switch combat graft.
  if (raw === 'Mechanic_ScavengeBar') {
    return 'Scavenge Bar / Instability Protocol (Deprecated)';
  }
  return raw.replace('Mechanic_', '').replace(/_/g, ' ').toUpperCase();
}
