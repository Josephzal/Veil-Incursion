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

export function formatEconomyBalanceConfigSummary(): string {
  return [
    'ECONOMY BALANCE CONFIG',
    `  crafting cost ×: ${ECONOMY_CRAFTING_COST_MULTIPLIER}`,
    `  fence sell ×: ${ECONOMY_BLACK_MARKET_SELL_MULTIPLIER}`,
    `  casket: sell ${ECONOMY_CASKET_CONFIG.sealedSellValue} / appraise ${ECONOMY_CASKET_CONFIG.appraisalFee} / open ${ECONOMY_CASKET_CONFIG.openingFee}`,
    `  jar: sell ${ECONOMY_SPECIMEN_JAR_CONFIG.sealedSellValue} / appraise ${ECONOMY_SPECIMEN_JAR_CONFIG.appraisalFee} / open ${ECONOMY_SPECIMEN_JAR_CONFIG.openingFee}`,
  ].join('\n');
}
