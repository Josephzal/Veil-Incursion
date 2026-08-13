import {
  DEFERRED_REQUISITION_IDS,
  ENABLED_REQUISITION_IDS,
  type RecognizedRequisitionId,
  type RequisitionAccountFields,
  type RequisitionAttunement,
  type RequisitionDeployment,
  type RequisitionRouteDoctrine,
  type StoredRequisitionAccountInput,
} from '../types/expeditionRequisition';
import { isRequisitionId } from './expeditionRequisitionRegistry';
import {
  getRequisitionDonorDisposition,
  resolveRequisitionDonorId,
  warnUnknownRequisitionDonorId,
} from './requisitionDonorDisposition';

const ATTUNEMENTS = new Set<RequisitionAttunement>([
  'HIGH_VALUE_RESOURCE',
  'ECHO_RESIDUE',
  'ANCHOR_SIGNAL',
  'EXTRACTION',
  'OPERATION_TARGET',
]);
const ROUTE_DOCTRINES = new Set<RequisitionRouteDoctrine>(['SAFE', 'GREED', 'HUNT']);
const REQUISITION_OWNERSHIP_ORDER: readonly RecognizedRequisitionId[] = [
  ...ENABLED_REQUISITION_IDS,
  ...DEFERRED_REQUISITION_IDS,
];

export const EMPTY_REQUISITION_DEPLOYMENT: RequisitionDeployment = Object.freeze({
  attunement: null,
  routeDoctrine: null,
});

function normalizeAttunement(value: unknown): RequisitionAttunement | null {
  return typeof value === 'string' && ATTUNEMENTS.has(value as RequisitionAttunement)
    ? (value as RequisitionAttunement)
    : null;
}

function normalizeRouteDoctrine(value: unknown): RequisitionRouteDoctrine | null {
  return typeof value === 'string' && ROUTE_DOCTRINES.has(value as RequisitionRouteDoctrine)
    ? (value as RequisitionRouteDoctrine)
    : null;
}

export function sanitizeRequisitionDeployment(
  requisitionId: RecognizedRequisitionId | null,
  raw: StoredRequisitionAccountInput['requisitionDeployment'] |
    StoredRequisitionAccountInput['keepsakeDeployment'],
): RequisitionDeployment {
  if (requisitionId === 'signal_compass') {
    return {
      attunement: normalizeAttunement(raw?.attunement),
      routeDoctrine: null,
    };
  }
  if (requisitionId === 'ashen_cartograph') {
    return {
      attunement: null,
      routeDoctrine: normalizeRouteDoctrine(raw?.routeDoctrine),
    };
  }
  return { ...EMPTY_REQUISITION_DEPLOYMENT };
}

function normalizeOwnership(
  input: StoredRequisitionAccountInput,
): readonly RecognizedRequisitionId[] {
  const recognized = new Set<RecognizedRequisitionId>();
  const sources: readonly [string, readonly unknown[]][] = [
    ['unlockedRequisitionIds', input.unlockedRequisitionIds ?? []],
    ['unlockedKeepsakeIds', input.unlockedKeepsakeIds ?? []],
    ['craftedAugments', input.craftedAugments ?? []],
  ];

  for (const [source, ids] of sources) {
    for (const rawId of ids) {
      const canonicalId = resolveRequisitionDonorId(rawId);
      if (canonicalId) {
        recognized.add(canonicalId);
      } else if (
        typeof rawId !== 'string' ||
        getRequisitionDonorDisposition(rawId) == null
      ) {
        warnUnknownRequisitionDonorId(rawId, source);
      }
    }
  }

  return REQUISITION_OWNERSHIP_ORDER.filter((id) => recognized.has(id));
}

function normalizeEquipped(
  input: StoredRequisitionAccountInput,
): (typeof ENABLED_REQUISITION_IDS)[number] | null {
  const hasCanonicalSelection = input.equippedRequisitionId !== undefined;
  const rawId = hasCanonicalSelection
    ? input.equippedRequisitionId
    : input.equippedKeepsakeId;
  if (rawId == null) return null;

  const canonicalId = resolveRequisitionDonorId(rawId);
  if (!canonicalId) {
    if (typeof rawId !== 'string' || getRequisitionDonorDisposition(rawId) == null) {
      warnUnknownRequisitionDonorId(
        rawId,
        hasCanonicalSelection ? 'equippedRequisitionId' : 'equippedKeepsakeId',
      );
    }
    return null;
  }
  return isRequisitionId(canonicalId) ? canonicalId : null;
}

export function normalizeRequisitionAccount(
  input: StoredRequisitionAccountInput,
): RequisitionAccountFields {
  const equippedRequisitionId = normalizeEquipped(input);
  const rawDeployment =
    input.requisitionDeployment !== undefined
      ? input.requisitionDeployment
      : input.keepsakeDeployment;

  return {
    equippedRequisitionId,
    unlockedRequisitionIds: normalizeOwnership(input),
    requisitionDeployment: sanitizeRequisitionDeployment(
      equippedRequisitionId,
      rawDeployment,
    ),
  };
}

export function createFreshProofRequisitionAccountFields(): RequisitionAccountFields {
  return {
    equippedRequisitionId: null,
    unlockedRequisitionIds: [...ENABLED_REQUISITION_IDS],
    requisitionDeployment: { ...EMPTY_REQUISITION_DEPLOYMENT },
  };
}

export function canDeployWithRequisition(
  fields: RequisitionAccountFields,
): boolean {
  return fields.equippedRequisitionId != null &&
    fields.unlockedRequisitionIds.includes(fields.equippedRequisitionId);
}
