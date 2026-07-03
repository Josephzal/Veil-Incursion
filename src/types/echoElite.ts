import type { DepthStage } from './worldState';
import type { EncounterUnitSpec } from '../data/synergyEncounterTypes';
import type { EliteCombatModifierId } from './game';

export type EchoTier = 'STANDARD' | 'LEGENDARY';

/** Authored echo residue encounter — not player-build AI snapshots. */
export interface EchoEliteTemplate {
  id: string;
  displayName: string;
  /** Combat log designation prefix for the whole squad. */
  designation: string;
  tier: EchoTier;
  allowedDepths: readonly (1 | 2 | 3)[];
  allowedDepthStages?: readonly DepthStage[];
  roster: readonly EncounterUnitSpec[];
  eliteModifier?: EliteCombatModifierId;
  hpScale?: number;
  damageScale?: number;
  engageLogLine: string;
}
