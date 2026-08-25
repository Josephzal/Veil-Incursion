import type {
  EligibilityRejection,
  NineStrainRuntimeState,
  OwnershipPreview,
  UniversalBoonDefinition,
} from '../../types/nineStrain';
import { CONVERGENCE_IDS } from '../../types/convergence';
import { MAX_NATURAL_CONTACTED_STRAINS } from './strainRegistry';
import { cloneNineStrainRuntimeState } from './persistence';
import { canFireWeaponUltimate } from '../weaponUltimateRegistry';
import type { WeaponFamilyId } from '../../types/weapon';
import { definitionAcquisitionWave } from './definitionCatalog';
import { loadoutCanProduceHostileOrdinaryTrace } from './sector3ConvergenceEngine';

export interface EligibilityOptions {
  allowTestOffers?: boolean;
  premiumVerdictSource?: boolean;
  allowVerdictReplace?: boolean;
  exceptionalSourceId?: string;
  combatDepth?: number;
  equippedWeaponFamilyId?: string;
  /** Test/dev only. Production acquisition never sets this. */
  allowSector2Wave?: boolean;
  /** Wave 4 (Gravemark) is direct-grant/fixture only — never a production offer wave. */
  maxAcquisitionWave?: 1 | 2 | 3 | 4;
}

function ownedIds(state: NineStrainRuntimeState): string[] {
  return [
    ...Object.values(state.cores).filter((id): id is string => typeof id === 'string'),
    ...state.supports,
    ...state.manifestations,
    ...state.convergences,
    ...(state.boundVerdict ? [state.boundVerdict] : []),
  ];
}

function isStrainCore(
  definitions: Map<string, UniversalBoonDefinition>,
  id: string | null | undefined,
  strainId?: UniversalBoonDefinition['strainId'],
): boolean {
  if (!id) return false;
  const def = definitions.get(id);
  if (def?.role !== 'CORE') return false;
  return strainId ? def.strainId === strainId : true;
}

function ownedStrainProducers(
  state: NineStrainRuntimeState,
  definitions: Map<string, UniversalBoonDefinition>,
  strainId: UniversalBoonDefinition['strainId'],
): string[] {
  return Object.values(state.cores).filter((id): id is string => isStrainCore(definitions, id, strainId));
}

function ownedStrainIds(state: NineStrainRuntimeState, definitions: Map<string, UniversalBoonDefinition>, strainId: UniversalBoonDefinition['strainId']): string[] {
  return ownedIds(state).filter((id) => definitions.get(id)?.strainId === strainId);
}

function producerRoleSatisfied(
  state: NineStrainRuntimeState,
  definitions: Map<string, UniversalBoonDefinition>,
  def: UniversalBoonDefinition,
): boolean {
  const roles = def.prerequisites.producerRoles ?? [];
  if (!roles.includes('CORE')) return true;
  return ownedIds(state).some((id) => {
    const owned = definitions.get(id);
    return owned?.role === 'CORE' && owned.strainId === def.strainId;
  });
}

function parentProducerLive(
  state: NineStrainRuntimeState,
  definitions: Map<string, UniversalBoonDefinition>,
  parentId: string,
): boolean {
  return ownedIds(state).includes(parentId) && definitions.has(parentId);
}

function strainDependentsNeedingProducer(
  state: NineStrainRuntimeState,
  definitions: Map<string, UniversalBoonDefinition>,
  strainId: UniversalBoonDefinition['strainId'],
): string[] {
  return ownedIds(state).filter((id) => {
    const def = definitions.get(id);
    if (!def || def.strainId !== strainId) return false;
    if (def.role === 'CORE') return false;
    return Boolean(def.prerequisites.producerRoles?.includes('CORE') || (def.prerequisites.parentCoreIds?.length ?? 0) > 0);
  });
}

function dependentsOfCore(
  state: NineStrainRuntimeState,
  definitions: Map<string, UniversalBoonDefinition>,
  coreId: string,
): string[] {
  return ownedIds(state).filter((id) => {
    const def = definitions.get(id);
    return Boolean(def?.prerequisites.parentCoreIds?.includes(coreId));
  });
}

function strainContacted(state: NineStrainRuntimeState, strainId: UniversalBoonDefinition['strainId']): boolean {
  return state.contactedStrains.some((row) => row.strainId === strainId);
}

function naturalContactCount(state: NineStrainRuntimeState): number {
  return state.contactedStrains.filter((row) => !row.exceptional).length;
}

function effectiveAcquisitionWave(
  state: NineStrainRuntimeState,
  options: EligibilityOptions,
): 1 | 2 | 3 | 4 {
  if (
    options.maxAcquisitionWave === 1
    || options.maxAcquisitionWave === 2
    || options.maxAcquisitionWave === 3
    || options.maxAcquisitionWave === 4
  ) {
    return options.maxAcquisitionWave;
  }
  if (options.allowSector2Wave) return 2;
  const stored = state.maxAcquisitionWave;
  if (stored === 1 || stored === 2 || stored === 3 || stored === 4) return stored;
  return 1;
}

export function evaluateEligibility(
  state: NineStrainRuntimeState,
  definitions: Map<string, UniversalBoonDefinition>,
  definitionId: string,
  options: EligibilityOptions = {},
): EligibilityRejection[] {
  const def = definitions.get(definitionId);
  if (!def) return ['UNKNOWN_DEFINITION'];
  const reasons: EligibilityRejection[] = [];
  if (def.testOnly && !options.allowTestOffers) reasons.push('TEST_ONLY_BLOCKED');
  if (definitionAcquisitionWave(def) > effectiveAcquisitionWave(state, options) && !def.testOnly) {
    reasons.push('WAVE_LOCKED');
  }
  if (!def.testOnly && state.boonSystemMode !== 'NINE_STRAIN') {
    reasons.push('BOON_SYSTEM_INACTIVE');
  }
  if (state.boonSystemConflict) reasons.push('BOON_SYSTEM_CONFLICT');
  if (ownedIds(state).includes(definitionId)) reasons.push('ALREADY_OWNED');

  const needsNewStrain = !strainContacted(state, def.strainId)
    && (!def.secondaryStrainId || !strainContacted(state, def.secondaryStrainId) || def.role === 'CONVERGENCE');
  if (def.role !== 'VERDICT' && !strainContacted(state, def.strainId)) {
    const overrideAllows = state.exceptionalOverride?.strainId === def.strainId;
    if (naturalContactCount(state) >= MAX_NATURAL_CONTACTED_STRAINS && !overrideAllows) {
      reasons.push('STRAIN_CAP');
    }
  }
  if (def.secondaryStrainId && !strainContacted(state, def.secondaryStrainId) && def.role === 'CONVERGENCE') {
    const missingParents = [def.strainId, def.secondaryStrainId].filter((id) => !strainContacted(state, id));
    if (missingParents.length) reasons.push('CONVERGENCE_PARENTS');
  }
  void needsNewStrain;

  if (def.role === 'CORE') {
    const occupant = def.imprint ? state.cores[def.imprint] : null;
    if (occupant && def.imprint) {
      const blocked = dependencyProtectionBlocks(state, definitions, occupant, def.id);
      if (blocked) reasons.push('DEPENDENCY_PROTECTION');
    }
  } else if (def.imprint) {
    reasons.push('WRONG_ROLE');
  }

  if (def.role === 'SUPPORT' || def.role === 'MANIFESTATION') {
    const parents = def.prerequisites.parentCoreIds ?? [];
    const missing = parents.some((parentId) => !parentProducerLive(state, definitions, parentId));
    if (missing && !def.prerequisites.producerRoles?.length) reasons.push('MISSING_PARENT');
    if (def.prerequisites.producerRoles?.length && !producerRoleSatisfied(state, definitions, def)) {
      reasons.push('MISSING_PRODUCER');
    }
  }
  if (def.prerequisites.minDepth) {
    const depth = options.combatDepth ?? state.counterfate?.combatDepth ?? 1;
    if (depth < def.prerequisites.minDepth) reasons.push('DEPTH_GATE');
  }
  if (def.prerequisites.minOwnedFromStrain) {
    const owned = ownedStrainIds(state, definitions, def.strainId);
    if (owned.length < def.prerequisites.minOwnedFromStrain) reasons.push('MISSING_PARENT');
  }
  if (def.prerequisites.requireCorePlusExtraFromStrain) {
    const owned = ownedStrainIds(state, definitions, def.strainId)
      .map((id) => definitions.get(id))
      .filter((row): row is UniversalBoonDefinition => Boolean(row));
    const hasCore = owned.some((row) => row.role === 'CORE');
    const extra = owned.some((row) => row.role === 'CORE' || row.role === 'SUPPORT');
    const extraBeyondOneCore = owned.filter((row) => row.role === 'CORE' || row.role === 'SUPPORT').length >= 2 && hasCore;
    if (!hasCore || !extra || !extraBeyondOneCore) reasons.push('MISSING_PARENT');
  }
  if (def.prerequisites.minOwnedCoresFromStrain) {
    const cores = ownedStrainProducers(state, definitions, def.strainId);
    if (cores.length < def.prerequisites.minOwnedCoresFromStrain) reasons.push('MISSING_PRODUCER');
  }
  if (def.role === 'CONVERGENCE') {
    const parentStrains = def.prerequisites.parentStrainIds
      ?? ([def.strainId, def.secondaryStrainId].filter((id): id is NonNullable<typeof id> => Boolean(id)));
    if (parentStrains.some((strainId) => ownedStrainProducers(state, definitions, strainId).length === 0)) {
      reasons.push('CONVERGENCE_PARENTS');
    }
    const parents = def.prerequisites.parentCoreIds ?? [];
    if (parents.some((parentId) => !parentProducerLive(state, definitions, parentId))) {
      reasons.push('CONVERGENCE_PARENTS');
    }
    if (
      definitionId === CONVERGENCE_IDS.ECHOED_FAULT
      && !loadoutCanProduceHostileOrdinaryTrace(ownedIds(state), [...definitions.values()])
    ) {
      reasons.push('MISSING_PRODUCER');
    }
    if (
      definitionId === CONVERGENCE_IDS.PARALLAX_ECHO
      && !loadoutCanProduceHostileOrdinaryTrace(ownedIds(state), [...definitions.values()])
    ) {
      reasons.push('MISSING_PRODUCER');
    }
  }
  if (def.role === 'VERDICT') {
    if (state.boundVerdict && state.boundVerdict !== def.id && !options.allowVerdictReplace) {
      reasons.push('VERDICT_OCCUPIED');
    }
    if (!options.premiumVerdictSource) reasons.push('WRONG_ROLE');
    if (def.prerequisites.producerRoles?.length && !producerRoleSatisfied(state, definitions, def)) {
      reasons.push('MISSING_PRODUCER');
    }
    if (!def.testOnly) {
      const family = options.equippedWeaponFamilyId as WeaponFamilyId | undefined;
      if (!family || !canFireWeaponUltimate(family)) reasons.push('ULTIMATE_INCOMPATIBLE');
    }
  }
  return reasons;
}

export function dependencyProtectionBlocks(
  state: NineStrainRuntimeState,
  definitions: Map<string, UniversalBoonDefinition>,
  outgoingCoreId: string,
  incomingCoreId: string,
): boolean {
  const outgoing = definitions.get(outgoingCoreId);
  const incoming = definitions.get(incomingCoreId);
  if (!outgoing || !incoming) return true;
  const dependents = dependentsOfCore(state, definitions, outgoingCoreId);
  const lastProducerDependents = outgoing.role === 'CORE'
    ? strainDependentsNeedingProducer(state, definitions, outgoing.strainId)
    : [];
  const remainingProducers = ownedStrainProducers(state, definitions, outgoing.strainId)
    .filter((id) => id !== outgoingCoreId);
  const incomingKeepsProducer = incoming.role === 'CORE' && incoming.strainId === outgoing.strainId;
  const remainingAfter = remainingProducers.length + (incomingKeepsProducer ? 1 : 0);
  for (const id of ownedIds(state)) {
    const owned = definitions.get(id);
    const need = owned?.prerequisites.minOwnedCoresFromStrain;
    if (owned && owned.strainId === outgoing.strainId && need && remainingAfter < need) {
      return true;
    }
    if (
      owned?.role === 'CONVERGENCE'
      && remainingAfter === 0
      && (owned.strainId === outgoing.strainId || owned.secondaryStrainId === outgoing.strainId)
    ) {
      return true;
    }
  }
  if (lastProducerDependents.length > 0 && remainingProducers.length === 0 && !incomingKeepsProducer) {
    return true;
  }
  if (dependents.length === 0) return false;
  if (incoming.strainId === outgoing.strainId) return false;
  if (incoming.refinementHooks.includes('FALLBACK') || outgoing.refinementHooks.includes('FALLBACK')) return false;
  return true;
}

function applyContact(
  next: NineStrainRuntimeState,
  strainId: UniversalBoonDefinition['strainId'],
  exceptional: boolean,
): void {
  if (strainContacted(next, strainId)) return;
  next.contactedStrains = [
    ...next.contactedStrains,
    {
      strainId,
      order: next.contactedStrains.length,
      exceptional,
    },
  ];
}

function displayNames(
  definitions: Map<string, UniversalBoonDefinition>,
  ids: readonly string[],
): string[] {
  return ids.map((id) => definitions.get(id)?.displayName ?? id);
}

export function applyAcquire(
  state: NineStrainRuntimeState,
  definitions: Map<string, UniversalBoonDefinition>,
  definitionId: string,
  options: EligibilityOptions = {},
): OwnershipPreview {
  const before = cloneNineStrainRuntimeState(state);
  const reasons = evaluateEligibility(state, definitions, definitionId, options);
    if (options.exceptionalSourceId && !state.exceptionalOverride) {
      const capIndex = reasons.indexOf('STRAIN_CAP');
      if (capIndex >= 0) reasons.splice(capIndex, 1);
    }
  const def = definitions.get(definitionId);
  if (!def || reasons.length > 0) {
    const occupant = def?.role === 'CORE' && def.imprint ? state.cores[def.imprint] : null;
    const blockedDependents = occupant
      ? [
        ...dependentsOfCore(state, definitions, occupant),
        ...ownedIds(state).filter((id) => {
          const owned = definitions.get(id);
          return owned?.role === 'CONVERGENCE'
            && (owned.strainId === definitions.get(occupant)?.strainId
              || owned.secondaryStrainId === definitions.get(occupant)?.strainId);
        }),
      ]
      : [];
    const unique = [...new Set(blockedDependents)];
    return {
      before,
      after: cloneNineStrainRuntimeState(state),
      overwrittenCoreId: occupant,
      overwrittenVerdictId: null,
      dependentEffects: unique,
      dependentDisplayNames: displayNames(definitions, unique),
      rejectionReasons: reasons,
      eligible: false,
    };
  }
  const after = cloneNineStrainRuntimeState(state);
  const exceptional = Boolean(options.exceptionalSourceId);
  if (exceptional && options.exceptionalSourceId && !strainContacted(after, def.strainId)) {
    after.exceptionalOverride = { sourceId: options.exceptionalSourceId, strainId: def.strainId };
  }
  applyContact(after, def.strainId, exceptional && !strainContacted(state, def.strainId));
  if (def.secondaryStrainId) applyContact(after, def.secondaryStrainId, false);

  let overwrittenCoreId: string | null = null;
  let overwrittenVerdictId: string | null = null;
  const dependentEffects: string[] = [];
  if (def.role === 'CORE' && def.imprint) {
    overwrittenCoreId = after.cores[def.imprint];
    if (overwrittenCoreId) {
      dependentEffects.push(...dependentsOfCore(after, definitions, overwrittenCoreId));
      for (const ownedId of [
        ...after.convergences,
      ]) {
        const owned = definitions.get(ownedId);
        if (
          owned?.role === 'CONVERGENCE'
          && (owned.strainId === definitions.get(overwrittenCoreId)?.strainId
            || owned.secondaryStrainId === definitions.get(overwrittenCoreId)?.strainId)
        ) {
          if (!dependentEffects.includes(ownedId)) dependentEffects.push(ownedId);
        }
      }
      after.overwriteHistory.push({
        imprint: def.imprint,
        outgoingId: overwrittenCoreId,
        incomingId: def.id,
        preservedDependents: dependentEffects,
        transmutedDependents: [],
      });
    }
    after.cores[def.imprint] = def.id;
  } else if (def.role === 'SUPPORT') {
    after.supports = [...after.supports, def.id];
  } else if (def.role === 'MANIFESTATION') {
    after.manifestations = [...after.manifestations, def.id];
  } else if (def.role === 'CONVERGENCE') {
    after.convergences = [...after.convergences, def.id];
  } else if (def.role === 'VERDICT') {
    overwrittenVerdictId = after.boundVerdict && after.boundVerdict !== def.id ? after.boundVerdict : null;
    if (overwrittenVerdictId) dependentEffects.push(overwrittenVerdictId);
    after.boundVerdict = def.id;
  }
  after.definitionOwnedState[def.id] = after.definitionOwnedState[def.id] ?? {};
  return {
    before,
    after,
    overwrittenCoreId,
    overwrittenVerdictId,
    dependentEffects,
    dependentDisplayNames: displayNames(definitions, dependentEffects),
    rejectionReasons: [],
    eligible: true,
  };
}

export function previewAcquire(
  state: NineStrainRuntimeState,
  definitions: Map<string, UniversalBoonDefinition>,
  definitionId: string,
  options: EligibilityOptions = {},
): OwnershipPreview {
  return applyAcquire(state, definitions, definitionId, options);
}
