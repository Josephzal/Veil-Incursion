import type { StrainId } from '../../types/nineStrain';
import type { NineStrainAcquisitionState, PendingNineStrainOffer } from '../../types/convergence';

export function createDefaultAcquisitionState(): NineStrainAcquisitionState {
  return {
    firstOmenClaimed: false,
    firstOmenPending: false,
    combatVictories: 0,
    guaranteedContactClaimedByDepth: {},
    consumedRewardSourceIds: [],
    pendingOffer: null,
    acceptedSelectionCount: 0,
    lastFailClosedDiagnostic: null,
  };
}

function asStrain(value: unknown): StrainId | null {
  if (
    value === 'COUNTERFATE'
    || value === 'RITUAL_CADENCE'
    || value === 'AFTERIMAGE'
    || value === 'STILLPOINT'
    || value === 'WOUNDWEAVE'
    || value === 'FAULTLINE'
    || value === 'SOULWAKE'
    || value === 'GRAVEMARK'
    || value === 'SHARDSKIN'
  ) {
    return value;
  }
  return null;
}

export function hydrateAcquisitionState(raw: unknown): NineStrainAcquisitionState {
  const base = createDefaultAcquisitionState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  const pendingRaw = row.pendingOffer && typeof row.pendingOffer === 'object'
    ? row.pendingOffer as Record<string, unknown>
    : null;
  let pendingOffer: PendingNineStrainOffer | null = null;
  if (pendingRaw) {
    const kind = pendingRaw.kind;
    if (
      kind === 'FIRST_OMEN_STRAIN'
      || kind === 'CONTACT'
      || kind === 'ELITE_CONTACT'
      || kind === 'BOSS_PREMIUM'
    ) {
      pendingOffer = {
        kind,
        sourceId: typeof pendingRaw.sourceId === 'string' ? pendingRaw.sourceId : 'unknown',
        nodeId: typeof pendingRaw.nodeId === 'string' ? pendingRaw.nodeId : 'unknown',
        depth: typeof pendingRaw.depth === 'number' ? pendingRaw.depth : 1,
        strainId: asStrain(pendingRaw.strainId),
        cardIds: Array.isArray(pendingRaw.cardIds)
          ? pendingRaw.cardIds.filter((id): id is string => typeof id === 'string')
          : [],
        seed: typeof pendingRaw.seed === 'string' ? pendingRaw.seed : 'seed',
        rngCursor: typeof pendingRaw.rngCursor === 'number' ? pendingRaw.rngCursor : 0,
        replacementPreview: pendingRaw.replacementPreview && typeof pendingRaw.replacementPreview === 'object'
          ? Object.fromEntries(
            Object.entries(pendingRaw.replacementPreview as Record<string, unknown>)
              .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
          )
          : {},
        failClosedDiagnostic: typeof pendingRaw.failClosedDiagnostic === 'string'
          ? pendingRaw.failClosedDiagnostic
          : null,
      };
    }
  }
  const claimed: NineStrainAcquisitionState['guaranteedContactClaimedByDepth'] = {};
  if (row.guaranteedContactClaimedByDepth && typeof row.guaranteedContactClaimedByDepth === 'object') {
    const rec = row.guaranteedContactClaimedByDepth as Record<string, unknown>;
    if (rec['1'] === true) claimed[1] = true;
    if (rec['2'] === true) claimed[2] = true;
    if (rec['3'] === true) claimed[3] = true;
  }
  return {
    firstOmenClaimed: row.firstOmenClaimed === true,
    firstOmenPending: row.firstOmenPending === true,
    combatVictories: typeof row.combatVictories === 'number' ? row.combatVictories : 0,
    guaranteedContactClaimedByDepth: claimed,
    consumedRewardSourceIds: Array.isArray(row.consumedRewardSourceIds)
      ? row.consumedRewardSourceIds.filter((id): id is string => typeof id === 'string')
      : [],
    pendingOffer,
    acceptedSelectionCount: typeof row.acceptedSelectionCount === 'number' ? row.acceptedSelectionCount : 0,
    lastFailClosedDiagnostic: typeof row.lastFailClosedDiagnostic === 'string'
      ? row.lastFailClosedDiagnostic
      : null,
  };
}
