import type { ResourceItemId } from './resourceItem';

/** Presentation-only cargo line for the run debrief receipt. */
export interface SettledCargoLine {
  resourceId: ResourceItemId;
  name: string;
  quantity: number;
  /** Magenta accent for rare / explicitly supernatural cargo. */
  supernatural?: boolean;
}

export type SettledContractStatus = 'COMPLETE' | 'INCOMPLETE' | 'FAILED';

export interface SettledContractResult {
  status: SettledContractStatus;
  title: string;
  detail: string;
}

export type SettledCargoMode =
  | 'RECOVERED'
  | 'SECURED_AND_LOST'
  | 'SECURED_ONLY'
  | 'NONE';

/**
 * Presentation model for the single-page Run Debrief.
 * Contains only fields the player needs after a run — no reputation,
 * unlocks, operation progress, build, or combat telemetry.
 */
export interface SettledRunResult {
  /** Fingerprint used for idempotent settlement. */
  runKey: string;
  survived: boolean;
  sectorName: string;
  /** EXTRACTION SECURED | RUNNER LOST */
  outcomeTitle: string;
  /** Readable cause line, e.g. "Defeated by Thrall". Null when unavailable. */
  causeOfDeathLine: string | null;
  /** Active contract title for header context only. */
  contractTitle: string | null;
  deepestReachLabel: string;
  runDurationLabel: string;
  cargoResultLabel: string;
  cargoMode: SettledCargoMode;
  recoveredCargo: SettledCargoLine[];
  securedCargo: SettledCargoLine[];
  lostCargo: SettledCargoLine[];
  /** Extra common material types beyond the visible cargo budget. */
  cargoOverflowCount: number;
  cargoSlotsSecured: number;
  cargoSlotsCapacity: number;
  contract: SettledContractResult | null;
  /** Total credits secured this run; null when zero. */
  creditsEarned: number | null;
  /**
   * Extraction type label only when Safe vs Dirty settlement differs.
   * Omitted (null) for normal results.
   */
  extractionTypeLabel: string | null;
}
