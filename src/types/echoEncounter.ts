import type { ClassType } from './game';

/** Authored echo encounter resolution kinds (v1). */
export type EchoEncounterKind =
  | 'FALLEN_RUNNER_ECHO'
  | 'HOSTILE_ECHO'
  | 'ASSIST_ECHO'
  | 'CARGO_ECHO'
  | 'EXTRACTION_ECHO';

/** Placeholder for future player-build snapshot echoes — not populated in v1. */
export interface EchoSnapshotPlaceholder {
  sourcePlayerId?: string;
  sourceRunId?: string;
  sourceClass?: ClassType;
  sourceLoadoutSummary?: string;
  sourceDeathDepth?: number;
  sourceCargoSummary?: string;
  echoRarity?: 'COMMON' | 'RARE' | 'CORRUPTED';
}

/** Scanner-layer echo overlay stamped before breach context roll. */
export interface ProceduralEchoOverlay {
  echoSignal: true;
  echoSignalLabel: string;
}

export const ECHO_SIGNAL_DISPLAY_LABELS = [
  'ECHO SIGNAL',
  'RESIDUAL RUNNER SIGNATURE',
  'FALLEN RUNNER TRACE',
  'UNSTABLE ECHO',
] as const;

export type EchoSignalDisplayLabel = (typeof ECHO_SIGNAL_DISPLAY_LABELS)[number];
