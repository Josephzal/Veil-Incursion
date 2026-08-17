import type {
  CoreImprintId,
  NineStrainRuntimeState,
  TriggerGuardState,
} from '../../types/nineStrain';
import { CORE_IMPRINTS, NINE_STRAIN_SCHEMA_VERSION, isStrainId } from './strainRegistry';
import { createDefaultCounterfateState, hydrateCounterfateState } from './counterfateEngine';
import { createDefaultRitualCadenceState, hydrateRitualCadenceState } from './ritualCadenceEngine';
import { createDefaultAfterimageState, hydrateAfterimageState } from './afterimageEngine';
import { createDefaultConvergenceState, hydrateConvergenceState } from './convergenceEngine';
import { createDefaultStillpointState, hydrateStillpointState } from './stillpointEngine';
import { createDefaultWoundweaveState, hydrateWoundweaveState } from './woundweaveEngine';
import { createDefaultFaultlineState, hydrateFaultlineState } from './faultlineEngine';
import { createDefaultSoulwakeState, hydrateSoulwakeState } from './soulwakeEngine';
import { createDefaultAcquisitionState, hydrateAcquisitionState } from './acquisitionState';
import { NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE } from './contentConfiguration';

export function emptyTriggerGuards(): TriggerGuardState {
  return {
    perRootAction: {},
    perTargetPerRoot: {},
    perNativeHit: {},
    perPlayerTurn: [],
    perEnemyCycle: [],
    perCombatCycle: [],
    perEncounter: [],
    instinctPositiveUsedThisCombatCycle: false,
  };
}

export function createDefaultNineStrainRuntimeState(): NineStrainRuntimeState {
  return {
    schemaVersion: NINE_STRAIN_SCHEMA_VERSION,
    boonSystemMode: 'LEGACY_CLASS_CATALOG',
    boonSystemConflict: null,
    contactedStrains: [],
    exceptionalOverride: null,
    cores: {
      ARMAMENT: null,
      DISCIPLINE: null,
      INSTINCT: null,
      CURRENT: null,
    },
    supports: [],
    manifestations: [],
    convergences: [],
    boundVerdict: null,
    overwriteHistory: [],
    definitionOwnedState: {},
    pendingEffects: [],
    triggerGuards: emptyTriggerGuards(),
    metrics: {},
    orderingSeed: 0,
    nextPendingOrder: 1,
    counterfate: createDefaultCounterfateState(),
    ritualCadence: createDefaultRitualCadenceState(),
    afterimage: createDefaultAfterimageState(),
    convergence: createDefaultConvergenceState(),
    stillpoint: createDefaultStillpointState(),
    woundweave: createDefaultWoundweaveState(),
    faultline: createDefaultFaultlineState(),
    soulwake: createDefaultSoulwakeState(),
    acquisition: createDefaultAcquisitionState(),
    maxAcquisitionWave: 1,
  };
}

/** Brand-new live deployment only. Hydrate fallbacks stay legacy. */
export function createLiveNineStrainRuntimeState(): NineStrainRuntimeState {
  return {
    ...createDefaultNineStrainRuntimeState(),
    boonSystemMode: 'NINE_STRAIN',
    boonSystemConflict: null,
    maxAcquisitionWave: NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE,
  };
}

function resolveMaxAcquisitionWave(row: Record<string, unknown>): 1 | 2 | 3 {
  const storedSchema = typeof row.schemaVersion === 'number' ? row.schemaVersion : 0;
  const raw = row.maxAcquisitionWave;
  if (storedSchema < 9) return 1;
  if (raw === 2 || raw === 3 || raw === 1) return raw;
  return 1;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((row): row is string => typeof row === 'string') : [];
}

function cloneGuards(raw: unknown): TriggerGuardState {
  const empty = emptyTriggerGuards();
  if (!raw || typeof raw !== 'object') return empty;
  const row = raw as Record<string, unknown>;
  return {
    perRootAction: (row.perRootAction && typeof row.perRootAction === 'object')
      ? row.perRootAction as TriggerGuardState['perRootAction']
      : {},
    perTargetPerRoot: (row.perTargetPerRoot && typeof row.perTargetPerRoot === 'object')
      ? row.perTargetPerRoot as TriggerGuardState['perTargetPerRoot']
      : {},
    perNativeHit: (row.perNativeHit && typeof row.perNativeHit === 'object')
      ? row.perNativeHit as TriggerGuardState['perNativeHit']
      : {},
    perPlayerTurn: asStringArray(row.perPlayerTurn),
    perEnemyCycle: asStringArray(row.perEnemyCycle),
    perCombatCycle: asStringArray(row.perCombatCycle),
    perEncounter: asStringArray(row.perEncounter),
    instinctPositiveUsedThisCombatCycle: row.instinctPositiveUsedThisCombatCycle === true,
  };
}

function canonicalizeRoleToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value === 'AUTHORITY') return 'STRAIN';
  if (value === 'REVELATION') return 'MANIFESTATION';
  return value;
}

/**
 * Versioned hydrate. Observed class catalogs (leyLineMutations / hexShotBoons / envoyBoons)
 * are not mapped onto Strains — that mapping is ambiguous.
 */
export function hydrateNineStrainRuntimeState(raw: unknown): NineStrainRuntimeState {
  const base = createDefaultNineStrainRuntimeState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;

  const contacted = Array.isArray(row.contactedStrains)
    ? row.contactedStrains.flatMap((entry, index) => {
      if (typeof entry === 'string' && isStrainId(entry)) {
        return [{ strainId: entry, order: index, exceptional: false }];
      }
      if (entry && typeof entry === 'object') {
        const rec = entry as Record<string, unknown>;
        const strainId = rec.strainId;
        if (isStrainId(strainId)) {
          return [{
            strainId,
            order: typeof rec.order === 'number' ? rec.order : index,
            exceptional: rec.exceptional === true,
          }];
        }
      }
      return [];
    })
    : [];

  const overrideRaw = row.exceptionalOverride;
  let exceptionalOverride = base.exceptionalOverride;
  if (overrideRaw && typeof overrideRaw === 'object') {
    const rec = overrideRaw as Record<string, unknown>;
    if (typeof rec.sourceId === 'string' && isStrainId(rec.strainId)) {
      exceptionalOverride = { sourceId: rec.sourceId, strainId: rec.strainId };
    }
  }

  const cores = { ...base.cores };
  if (row.cores && typeof row.cores === 'object') {
    for (const imprint of CORE_IMPRINTS) {
      const value = (row.cores as Record<string, unknown>)[imprint];
      cores[imprint] = typeof value === 'string' ? value : null;
    }
  }
  const legacyVerdictImprint = (row.cores as Record<string, unknown> | undefined)?.VERDICT;
  const boundVerdict = typeof row.boundVerdict === 'string'
    ? row.boundVerdict
    : typeof legacyVerdictImprint === 'string'
      ? legacyVerdictImprint
      : null;

  canonicalizeRoleToken(row.role);

  return {
    schemaVersion: NINE_STRAIN_SCHEMA_VERSION,
    boonSystemMode: row.boonSystemMode === 'NINE_STRAIN' ? 'NINE_STRAIN' : 'LEGACY_CLASS_CATALOG',
    boonSystemConflict: typeof row.boonSystemConflict === 'string' ? row.boonSystemConflict : null,
    contactedStrains: contacted,
    exceptionalOverride,
    cores,
    supports: asStringArray(row.supports),
    manifestations: asStringArray(row.manifestations).concat(
      asStringArray(row.revelations),
    ),
    convergences: asStringArray(row.convergences),
    boundVerdict,
    overwriteHistory: Array.isArray(row.overwriteHistory)
      ? row.overwriteHistory.filter((entry): entry is NineStrainRuntimeState['overwriteHistory'][number] => {
        if (!entry || typeof entry !== 'object') return false;
        const rec = entry as Record<string, unknown>;
        return typeof rec.imprint === 'string'
          && (CORE_IMPRINTS as readonly string[]).includes(rec.imprint)
          && typeof rec.outgoingId === 'string'
          && typeof rec.incomingId === 'string';
      }).map((entry) => {
        const rec = entry as unknown as Record<string, unknown>;
        return {
          imprint: rec.imprint as CoreImprintId,
          outgoingId: rec.outgoingId as string,
          incomingId: rec.incomingId as string,
          preservedDependents: asStringArray(rec.preservedDependents),
          transmutedDependents: asStringArray(rec.transmutedDependents),
        };
      })
      : [],
    definitionOwnedState: (row.definitionOwnedState && typeof row.definitionOwnedState === 'object')
      ? row.definitionOwnedState as NineStrainRuntimeState['definitionOwnedState']
      : {},
    pendingEffects: Array.isArray(row.pendingEffects)
      ? row.pendingEffects.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const rec = entry as Record<string, unknown>;
        if (typeof rec.id !== 'string' || typeof rec.definitionId !== 'string') return [];
        return [{
          id: rec.id,
          definitionId: rec.definitionId,
          createdOrder: typeof rec.createdOrder === 'number' ? rec.createdOrder : 0,
          kind: rec.kind === 'TRACE' ? 'TRACE' as const : 'OTHER' as const,
        }];
      })
      : [],
    triggerGuards: cloneGuards(row.triggerGuards),
    metrics: (row.metrics && typeof row.metrics === 'object')
      ? Object.fromEntries(
        Object.entries(row.metrics as Record<string, unknown>)
          .filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
      )
      : {},
    orderingSeed: typeof row.orderingSeed === 'number' ? row.orderingSeed : 0,
    nextPendingOrder: typeof row.nextPendingOrder === 'number' ? row.nextPendingOrder : 1,
    counterfate: hydrateCounterfateState(row.counterfate),
    ritualCadence: hydrateRitualCadenceState(row.ritualCadence),
    afterimage: hydrateAfterimageState(row.afterimage),
    convergence: hydrateConvergenceState(row.convergence),
    stillpoint: hydrateStillpointState(row.stillpoint),
    woundweave: hydrateWoundweaveState(row.woundweave),
    faultline: hydrateFaultlineState(row.faultline),
    soulwake: hydrateSoulwakeState(row.soulwake),
    acquisition: hydrateAcquisitionState(row.acquisition),
    maxAcquisitionWave: resolveMaxAcquisitionWave(row),
  };
}

export function cloneNineStrainRuntimeState(state: NineStrainRuntimeState): NineStrainRuntimeState {
  return hydrateNineStrainRuntimeState(JSON.parse(JSON.stringify(state)));
}
