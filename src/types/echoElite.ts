import type { DepthStage } from './worldState';
import type { ClassType } from './game';
import type { EncounterUnitSpec } from '../data/synergyEncounterTypes';
import type { EliteCombatModifierId } from './game';

export type EchoTier = 'STANDARD' | 'LEGENDARY';

export type HostileEchoRewardProfileId =
  | 'AEGIS_ECHO'
  | 'HEX_SHOT_ECHO'
  | 'ENVOY_ECHO';

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
  /** Class-inspired runner echo — preferred when snapshot class matches. */
  isClassEcho?: boolean;
  sourceClass?: ClassType;
  rewardProfileId?: HostileEchoRewardProfileId;
  /** Future player snapshot hook — authored label in v1. */
  loadoutSummary?: string;
}
