import type { ResourceItemId } from './resourceItem';

export type AppraisalValueBand =
  | 'LOW_VALUE'
  | 'STANDARD_VALUE'
  | 'HIGH_VALUE'
  | 'RARE_VALUE'
  | 'APEX_VALUE';

export type SealedCargoState = 'SEALED' | 'APPRAISED' | 'OPENED';

export const SEALED_CONTAINMENT_CASKET_ID = 'sealed-containment-casket' as const;
export const BLACKSITE_SPECIMEN_JAR_ID = 'blacksite-specimen-jar' as const;

export type SealedContainerResourceId =
  | typeof SEALED_CONTAINMENT_CASKET_ID
  | typeof BLACKSITE_SPECIMEN_JAR_ID;

export const APPRAISABLE_SEALED_RESOURCE_IDS: readonly SealedContainerResourceId[] = [
  SEALED_CONTAINMENT_CASKET_ID,
  BLACKSITE_SPECIMEN_JAR_ID,
];

export interface SealedCargoAppraisalConfig {
  resourceId: SealedContainerResourceId;
  appraisalTableId: string;
  sealedSellValue: number;
  appraisalFee: number;
  openingFee: number;
  openingFeeWaivedIfAppraised: boolean;
  canOpenInRun: boolean;
  canOpenAtHub: boolean;
  canDeliverSealed: boolean;
  canSellSealed: boolean;
}

export interface SealedCargoStackMeta {
  stackId: string;
  resourceId: SealedContainerResourceId;
  state: SealedCargoState;
  valueBand?: AppraisalValueBand;
  appraisedAt?: number;
}

export interface CasketAppraisalResult {
  resourceId: ResourceItemId;
  quantity: number;
  valueBand: AppraisalValueBand;
  displayLabel: string;
  feePaid: number;
}

export interface CasketOpenResult {
  resourceId: ResourceItemId;
  quantity: number;
  tierId: string;
  tierLabel: string;
  summaryLabel: string;
  dudFlavor?: string;
  resources: Partial<Record<ResourceItemId, number>>;
  credits: number;
  openingFeePaid: number;
  valueBand?: AppraisalValueBand;
}

export interface CareerSealedCargoStats {
  appraised: number;
  opened: number;
  soldSealed: number;
  deliveredSealed: number;
}

export function createDefaultCareerSealedCargoStats(): CareerSealedCargoStats {
  return {
    appraised: 0,
    opened: 0,
    soldSealed: 0,
    deliveredSealed: 0,
  };
}

export function isSealedContainerResourceId(id: string): id is SealedContainerResourceId {
  return (APPRAISABLE_SEALED_RESOURCE_IDS as readonly string[]).includes(id);
}
