/** Veil Front scanner overlay signal kinds — no territory / faction control data. */
export type ScannerSignalKind =
  | 'ANCHOR_TRACE'
  | 'ANCHOR_BREACH'
  | 'ANCHOR_CORE'
  | 'ECHO_RESIDUE'
  | 'OPERATION'
  | 'HIGH_RISK';

export interface RadarVeilSignal {
  kind: ScannerSignalKind;
  label: string;
  color: string;
  /** 0–1 visual emphasis */
  intensity: number;
}

export const SCANNER_SIGNAL_COLORS: Record<ScannerSignalKind, string> = {
  ANCHOR_TRACE: '#a78bfa',
  ANCHOR_BREACH: '#c084fc',
  ANCHOR_CORE: '#e879f9',
  ECHO_RESIDUE: '#22d3ee',
  OPERATION: '#fbbf24',
  HIGH_RISK: '#f87171',
};
