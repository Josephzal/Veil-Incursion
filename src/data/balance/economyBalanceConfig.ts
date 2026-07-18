/**
 * Hub / sealed / craft economy knobs.
 * Sealed container sell/fee tables are defined here and consumed by sealedCargoEngine.
 */

import type { AppraisalValueBand, SealedCargoAppraisalConfig } from '../../types/sealedCargo';
import {
  BLACKSITE_SPECIMEN_JAR_ID,
  SEALED_CONTAINMENT_CASKET_ID,
} from '../../types/sealedCargo';

/** Global crafting cost multiplier (1.0 = recipes as authored). */
export const ECONOMY_CRAFTING_COST_MULTIPLIER = 1.0;

/** Black market fence payout multiplier on top of resource sellValue. */
export const ECONOMY_BLACK_MARKET_SELL_MULTIPLIER = 1.0;

export const ECONOMY_CASKET_CONFIG: SealedCargoAppraisalConfig = {
  resourceId: SEALED_CONTAINMENT_CASKET_ID,
  appraisalTableId: 'sealed-containment-casket-v1',
  sealedSellValue: 150,
  appraisalFee: 50,
  openingFee: 100,
  openingFeeWaivedIfAppraised: true,
  canOpenInRun: false,
  canOpenAtHub: true,
  canDeliverSealed: true,
  canSellSealed: true,
};

export const ECONOMY_SPECIMEN_JAR_CONFIG: SealedCargoAppraisalConfig = {
  resourceId: BLACKSITE_SPECIMEN_JAR_ID,
  appraisalTableId: 'blacksite-specimen-jar-v1',
  sealedSellValue: 80,
  appraisalFee: 30,
  openingFee: 50,
  openingFeeWaivedIfAppraised: true,
  canOpenInRun: false,
  canOpenAtHub: true,
  canDeliverSealed: true,
  canSellSealed: true,
};

export const ECONOMY_CASKET_APPRAISED_SELL: Record<AppraisalValueBand, number> = {
  LOW_VALUE: 125,
  STANDARD_VALUE: 175,
  HIGH_VALUE: 250,
  RARE_VALUE: 375,
  APEX_VALUE: 500,
};

export const ECONOMY_JAR_APPRAISED_SELL: Record<AppraisalValueBand, number> = {
  LOW_VALUE: 60,
  STANDARD_VALUE: 90,
  HIGH_VALUE: 130,
  RARE_VALUE: 180,
  APEX_VALUE: 250,
};

/** Sponsor payout soft multipliers (also mirrored in contractBalanceConfig). */
export const ECONOMY_SPONSOR_PAYOUT_NOTES = {
  TERRAN_GRID: 'Baseline credits',
  LEGION: 'Slightly lower credits, small rare-loot perk',
  SOLARIS: 'Higher credits + reputational spice',
} as const;

/** Phase 2M — hard/soft tuning thresholds (audit + design rails). */
export const ECONOMY_TUNING_THRESHOLDS = {
  /** Share of craft/unlock/upgrade sinks that may include Ley-Slag. */
  maxLeySlagRecipeShare: 0.35,
  /** Share of tech-tagged sinks that may include Encrypted Grid-Drive. */
  maxGridDriveTechShare: 0.65,
  /** Share of power-tagged sinks that may include Ossified Ley-Knot. */
  maxLeyKnotPowerShare: 0.55,
  /** Max Ley-Slag units for Standard Coagulant. */
  maxBasicHealLeySlag: 1,
  /** Soft cap on Anomalous Core craft/unlock sinks (masterwork reserved). */
  maxAnomalousCoreSinks: 2,
  /** D1 NORMAL_COMBAT SECTOR packet fire chance (sector identity at Threshold). */
  d1SectorPacketFireChance: 0.55,
  /** D1 NORMAL_COMBAT STABLE packet fire chance. */
  d1StablePacketFireChance: 0.85,
} as const;

export function formatEconomyTuningConfigBrief(): string {
  const t = ECONOMY_TUNING_THRESHOLDS;
  return [
    'TUNING THRESHOLDS (2M)',
    `  max Ley-Slag recipe share: ${Math.round(t.maxLeySlagRecipeShare * 100)}%`,
    `  max Grid-Drive tech share: ${Math.round(t.maxGridDriveTechShare * 100)}%`,
    `  max Ley-Knot power share: ${Math.round(t.maxLeyKnotPowerShare * 100)}%`,
    `  basic heal Ley-Slag ≤ ${t.maxBasicHealLeySlag}`,
    `  D1 combat: STABLE@${Math.round(t.d1StablePacketFireChance * 100)}% + SECTOR@${Math.round(t.d1SectorPacketFireChance * 100)}%`,
  ].join('\n');
}

export function formatEconomyBalanceConfigSummary(): string {
  return [
    'ECONOMY BALANCE CONFIG',
    `  crafting cost ×: ${ECONOMY_CRAFTING_COST_MULTIPLIER}`,
    `  fence sell ×: ${ECONOMY_BLACK_MARKET_SELL_MULTIPLIER}`,
    '  value lanes: STABLE×0.85 INTEL×1.15 UNSTABLE×1.0 CONTRABAND×1.30',
    `  casket: sell ${ECONOMY_CASKET_CONFIG.sealedSellValue} / appraise ${ECONOMY_CASKET_CONFIG.appraisalFee} / open ${ECONOMY_CASKET_CONFIG.openingFee}`,
    `  jar: sell ${ECONOMY_SPECIMEN_JAR_CONFIG.sealedSellValue} / appraise ${ECONOMY_SPECIMEN_JAR_CONFIG.appraisalFee} / open ${ECONOMY_SPECIMEN_JAR_CONFIG.openingFee}`,
    formatEconomyTuningConfigBrief(),
  ].join('\n');
}
