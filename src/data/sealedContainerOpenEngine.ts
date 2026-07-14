import type { AppraisalValueBand } from '../types/sealedCargo';
import {
  BLACKSITE_SPECIMEN_JAR_ID,
  SEALED_CONTAINMENT_CASKET_ID,
  type SealedContainerResourceId,
} from '../types/sealedCargo';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import {
  rollSealedCasketOpenReward,
  type SealedCasketOpenReward,
} from './sealedCasketOpenEngine';
import {
  rollSpecimenJarOpenReward,
  type SpecimenJarOpenReward,
} from './sealedSpecimenJarOpenEngine';

export type SealedContainerOpenReward = SealedCasketOpenReward | SpecimenJarOpenReward;

export function rollSealedContainerOpenReward(
  resourceId: ResourceItemId,
  opts: {
    valueBand?: AppraisalValueBand;
    rng?: () => number;
  } = {},
): SealedContainerOpenReward {
  if (resourceId === BLACKSITE_SPECIMEN_JAR_ID) {
    return rollSpecimenJarOpenReward(opts);
  }
  return rollSealedCasketOpenReward(opts);
}

export function isSealedContainerOpenable(resourceId: ResourceItemId): resourceId is SealedContainerResourceId {
  return resourceId === SEALED_CONTAINMENT_CASKET_ID || resourceId === BLACKSITE_SPECIMEN_JAR_ID;
}

export type { ResourceQuantity };
