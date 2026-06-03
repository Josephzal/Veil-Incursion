import type { FactionType } from './game';

export type ScannerCabal = FactionType;

export type ScannerAnomalyLabel =
  | 'DISTORTION_REMNANT'
  | 'VEIL_BREACH_ECHO'
  | 'CORE_SIGNATURE'
  | 'PHASE_LOCK_SPIKE'
  | 'GRAVITIC_PULSE'
  | 'SPECTRAL_CASCADE';

export interface ScannerAnomaly {
  id: string;
  x: number;
  y: number;
  label: ScannerAnomalyLabel;
  /** Absolute bearing 0–360° from scanner center (clockwise from +X). */
  angleDeg: number;
}

export interface CabalScannerTheme {
  primary: string;
  line: string;
  backdrop: string;
  text: string;
  blipAccent: string;
  borderStyle: 'solid' | 'dashed';
  sweepGlow: string;
}
