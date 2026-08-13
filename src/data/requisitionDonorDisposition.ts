import {
  DEFERRED_REQUISITION_IDS,
  type RecognizedRequisitionId,
} from '../types/expeditionRequisition';
import { isRequisitionId } from './expeditionRequisitionRegistry';

export type RequisitionDonorKind = 'boundRequisition' | 'expeditionRelic';
export type RequisitionDonorDisposition =
  | 'enabled_self'
  | 'map_to_enabled'
  | 'deferred_compat'
  | 'map_to_deferred'
  | 'strip';

export interface RequisitionDonorDispositionEntry {
  donorKind: RequisitionDonorKind;
  donorId: string;
  canonicalId: RecognizedRequisitionId | null;
  disposition: RequisitionDonorDisposition;
  equipPolicy: 'enabled' | 'deferred' | 'none';
}

const D = (
  donorKind: RequisitionDonorKind,
  donorId: string,
  canonicalId: RecognizedRequisitionId | null,
  disposition: RequisitionDonorDisposition,
  equipPolicy: RequisitionDonorDispositionEntry['equipPolicy'],
): RequisitionDonorDispositionEntry =>
  Object.freeze({ donorKind, donorId, canonicalId, disposition, equipPolicy });

export const REQUISITION_DONOR_DISPOSITIONS: readonly RequisitionDonorDispositionEntry[] =
  Object.freeze([
    D('boundRequisition', 'HAZARD_PAY', 'hazard_pay', 'map_to_enabled', 'enabled'),
    D(
      'boundRequisition',
      'STANDARD_ISSUE_COAGULANT',
      'standard_issue_coagulant',
      'deferred_compat',
      'deferred',
    ),
    D(
      'boundRequisition',
      'ADRENALINE_PRIMER',
      'adrenaline_primer',
      'map_to_enabled',
      'enabled',
    ),
    D(
      'boundRequisition',
      'REINFORCED_TRENCH_COAT',
      'reinforced_trench_coat',
      'map_to_enabled',
      'enabled',
    ),
    D(
      'boundRequisition',
      'SMUGGLERS_POCKETS',
      'smugglers_wrap',
      'map_to_enabled',
      'enabled',
    ),
    D(
      'boundRequisition',
      'CHALK_LINE_WARD',
      'chalk_line_ward',
      'map_to_enabled',
      'enabled',
    ),
    D('boundRequisition', 'BLOOD_PRICE', null, 'strip', 'none'),
    D(
      'boundRequisition',
      'SCAVENGERS_MARK',
      'black_market_mark',
      'map_to_enabled',
      'enabled',
    ),
    D(
      'boundRequisition',
      'WIRETAP_OVERRIDE',
      'signal_compass',
      'map_to_enabled',
      'enabled',
    ),
    D(
      'boundRequisition',
      'BRIBE_THE_FERRYMAN',
      'extraction_token',
      'map_to_enabled',
      'enabled',
    ),
    D(
      'boundRequisition',
      'DEAD_DROP_TRACKER',
      'dead_drop_receiver',
      'map_to_enabled',
      'enabled',
    ),
    D(
      'boundRequisition',
      'KINETIC_BATTERY',
      'kinetic_battery',
      'map_to_enabled',
      'enabled',
    ),
    D(
      'boundRequisition',
      'HOLLOW_POINT_REQUISITION',
      'hollow_point_requisition',
      'map_to_enabled',
      'enabled',
    ),
    D('boundRequisition', 'VOID_TOUCHED_ARTIFACT', null, 'strip', 'none'),
    D('boundRequisition', 'APEX_BAIT', 'apex_bait', 'deferred_compat', 'deferred'),
    D(
      'boundRequisition',
      'MARTYRS_BARGAIN',
      'martyrs_bargain',
      'deferred_compat',
      'deferred',
    ),
    D('boundRequisition', 'IRONCLAD_LOGISTICS', null, 'strip', 'none'),
    D('boundRequisition', 'SUNKEN_RITE', null, 'strip', 'none'),
    D('boundRequisition', 'ENDLESS_MARCH', null, 'strip', 'none'),
    D('expeditionRelic', 'signal_compass', 'signal_compass', 'enabled_self', 'enabled'),
    D(
      'expeditionRelic',
      'ashen_cartograph',
      'ashen_cartograph',
      'enabled_self',
      'enabled',
    ),
    D(
      'expeditionRelic',
      'dead_drop_receiver',
      'dead_drop_receiver',
      'enabled_self',
      'enabled',
    ),
    D(
      'expeditionRelic',
      'ley_siphon_needle',
      'ley_siphon_needle',
      'deferred_compat',
      'deferred',
    ),
    D('expeditionRelic', 'cargo_seal', 'cargo_seal', 'enabled_self', 'enabled'),
    D(
      'expeditionRelic',
      'smugglers_wrap',
      'smugglers_wrap',
      'enabled_self',
      'enabled',
    ),
    D(
      'expeditionRelic',
      'black_market_mark',
      'black_market_mark',
      'enabled_self',
      'enabled',
    ),
    D('expeditionRelic', 'null_ledger', 'null_ledger', 'enabled_self', 'enabled'),
    D(
      'expeditionRelic',
      'extraction_token',
      'extraction_token',
      'enabled_self',
      'enabled',
    ),
    D(
      'expeditionRelic',
      'last_light_matchbook',
      'last_light_matchbook',
      'deferred_compat',
      'deferred',
    ),
    D(
      'expeditionRelic',
      'contract_seal',
      'contract_seal',
      'enabled_self',
      'enabled',
    ),
    D(
      'expeditionRelic',
      'anchor_charm',
      'anchor_charm',
      'deferred_compat',
      'deferred',
    ),
    D(
      'expeditionRelic',
      'mourners_bell',
      'mourners_bell',
      'deferred_compat',
      'deferred',
    ),
    D(
      'expeditionRelic',
      'grave_polaroid',
      'mourners_bell',
      'map_to_deferred',
      'deferred',
    ),
    D(
      'expeditionRelic',
      'hollow_keyring',
      'hollow_keyring',
      'deferred_compat',
      'deferred',
    ),
    D(
      'expeditionRelic',
      'bloodhound_tag',
      'bloodhound_tag',
      'deferred_compat',
      'deferred',
    ),
    D(
      'expeditionRelic',
      'false_evac_beacon',
      'false_evac_beacon',
      'deferred_compat',
      'deferred',
    ),
    D(
      'expeditionRelic',
      'gutter_crown',
      'gutter_crown',
      'deferred_compat',
      'deferred',
    ),
    D(
      'expeditionRelic',
      'mirror_writ',
      'contract_seal',
      'map_to_enabled',
      'enabled',
    ),
    D(
      'expeditionRelic',
      'bent_nail',
      'bent_nail',
      'deferred_compat',
      'deferred',
    ),
  ]);

const dispositionByDonorId = new Map(
  REQUISITION_DONOR_DISPOSITIONS.map((entry) => [entry.donorId, entry]),
);
const deferredIdSet = new Set<string>(DEFERRED_REQUISITION_IDS);
const warnedUnknownIds = new Set<string>();

export function getRequisitionDonorDisposition(
  rawId: string,
): RequisitionDonorDispositionEntry | null {
  return dispositionByDonorId.get(rawId) ?? null;
}

export function isDeferredRequisitionId(value: unknown): value is RecognizedRequisitionId {
  return typeof value === 'string' && deferredIdSet.has(value);
}

export function resolveRequisitionDonorId(rawId: unknown): RecognizedRequisitionId | null {
  if (isRequisitionId(rawId)) return rawId;
  if (isDeferredRequisitionId(rawId)) return rawId;
  if (typeof rawId !== 'string') return null;
  return getRequisitionDonorDisposition(rawId)?.canonicalId ?? null;
}

export function warnUnknownRequisitionDonorId(rawId: unknown, source: string): void {
  const warningKey =
    typeof rawId === 'string'
      ? rawId
      : `${typeof rawId}:${String(rawId)}`;
  if (warnedUnknownIds.has(warningKey)) return;
  if (
    typeof rawId === 'string' &&
    (resolveRequisitionDonorId(rawId) || getRequisitionDonorDisposition(rawId))
  ) {
    return;
  }
  warnedUnknownIds.add(warningKey);
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[requisition_donor_unknown_id]', { rawId, source });
  }
}
