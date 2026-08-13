import type {
  RequisitionRuntime,
} from '../types/expeditionRequisition';
import { isRequisitionId } from './expeditionRequisitionRegistry';
import {
  resolveRequisitionDonorId,
  warnUnknownRequisitionDonorId,
} from './requisitionDonorDisposition';
import {
  createKeepsakeRuntime,
  mergeKeepsakeRuntime,
} from './keepsakeRunState';

export interface StoredActiveRunRequisitionInput {
  requisitionRuntime?: RequisitionRuntime | null;
  keepsakeRuntime?: ({ keepsakeId?: unknown; requisitionId?: unknown } &
    Partial<RequisitionRuntime>) | null;
  boundRequisition?: { id?: unknown } | null;
  requisitionFullyInterpretedNodeIds?: readonly string[];
  keepsakeFullyInterpretedNodeIds?: readonly string[];
  requisitionCartographGhostNodeId?: string | null;
  keepsakeCartographGhostNodeId?: string | null;
  requisitionCartographGhostNodeIds?: readonly string[];
  keepsakeCartographGhostNodeIds?: readonly string[];
  requisitionJettisonLockedInstanceIds?: readonly string[];
  keepsakeJettisonLockedInstanceIds?: readonly string[];
  requisitionStampedExtractionNodeId?: string | null;
  keepsakeStampedExtractionNodeId?: string | null;
}

export interface NormalizedActiveRunRequisition {
  requisitionRuntime: RequisitionRuntime | null;
  requisitionFullyInterpretedNodeIds: readonly string[];
  requisitionCartographGhostNodeId: string | null;
  requisitionCartographGhostNodeIds: readonly string[];
  requisitionJettisonLockedInstanceIds: readonly string[];
  requisitionStampedExtractionNodeId: string | null;
  winner: 'requisition' | 'keepsake' | 'bound_cleared' | 'none';
  replayRunStartEffects: false;
}

/**
 * Compatibility normalizer for legacy active-run fixtures.
 * A valid canonical/legacy Keepsake runtime wins over the Bound slot. Bound-only
 * runs are cleared because reconstructing their consumed state would replay or
 * infer effects that were never persisted.
 */
export function normalizeActiveRunRequisition(
  input: StoredActiveRunRequisitionInput,
): NormalizedActiveRunRequisition {
  const sourceRuntime = input.requisitionRuntime ?? input.keepsakeRuntime ?? null;
  const rawId = sourceRuntime
    ? ('requisitionId' in sourceRuntime && sourceRuntime.requisitionId) ||
      ('keepsakeId' in sourceRuntime && sourceRuntime.keepsakeId)
    : null;
  const canonicalId = resolveRequisitionDonorId(rawId);
  if (rawId != null && !canonicalId) {
    warnUnknownRequisitionDonorId(rawId, 'activeRunRequisitionRuntime');
  }
  const enabledId = canonicalId && isRequisitionId(canonicalId)
    ? canonicalId
    : null;
  const runtime = enabledId && sourceRuntime
    ? mergeKeepsakeRuntime(
        createKeepsakeRuntime(enabledId),
        { ...sourceRuntime, requisitionId: enabledId },
      )
    : null;

  if (!runtime) {
    return {
      requisitionRuntime: null,
      requisitionFullyInterpretedNodeIds: [],
      requisitionCartographGhostNodeId: null,
      requisitionCartographGhostNodeIds: [],
      requisitionJettisonLockedInstanceIds: [],
      requisitionStampedExtractionNodeId: null,
      winner: input.boundRequisition ? 'bound_cleared' : 'none',
      replayRunStartEffects: false,
    };
  }

  const requisitionId = runtime.requisitionId;
  return {
    requisitionRuntime: runtime,
    requisitionFullyInterpretedNodeIds:
      requisitionId === 'signal_compass'
        ? input.requisitionFullyInterpretedNodeIds ??
          input.keepsakeFullyInterpretedNodeIds ??
          []
        : [],
    requisitionCartographGhostNodeId:
      requisitionId === 'ashen_cartograph'
        ? input.requisitionCartographGhostNodeId ??
          input.keepsakeCartographGhostNodeId ??
          null
        : null,
    requisitionCartographGhostNodeIds:
      requisitionId === 'ashen_cartograph'
        ? input.requisitionCartographGhostNodeIds ??
          input.keepsakeCartographGhostNodeIds ??
          []
        : [],
    requisitionJettisonLockedInstanceIds:
      requisitionId === 'cargo_seal'
        ? input.requisitionJettisonLockedInstanceIds ??
          input.keepsakeJettisonLockedInstanceIds ??
          []
        : [],
    requisitionStampedExtractionNodeId:
      requisitionId === 'extraction_token'
        ? input.requisitionStampedExtractionNodeId ??
          input.keepsakeStampedExtractionNodeId ??
          null
        : null,
    winner: input.requisitionRuntime ? 'requisition' : 'keepsake',
    replayRunStartEffects: false,
  };
}
