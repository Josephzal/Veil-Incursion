import type { BoonSystemMode, NineStrainRuntimeState } from '../../types/nineStrain';

export interface LegacyClassCatalogSnapshot {
  leyLineMutations?: readonly unknown[] | null;
  hexShotBoons?: readonly unknown[] | null;
  envoyBoons?: readonly unknown[] | null;
}

export function hasLegacyClassCatalogOwnership(snapshot: LegacyClassCatalogSnapshot): boolean {
  return (snapshot.leyLineMutations?.length ?? 0) > 0
    || (snapshot.hexShotBoons?.length ?? 0) > 0
    || (snapshot.envoyBoons?.length ?? 0) > 0;
}

export function hasNineStrainOwnership(state: Pick<
  NineStrainRuntimeState,
  'cores' | 'supports' | 'manifestations' | 'convergences' | 'boundVerdict' | 'contactedStrains'
>): boolean {
  if (state.contactedStrains.length > 0) return true;
  if (state.boundVerdict) return true;
  if (state.supports.length > 0 || state.manifestations.length > 0 || state.convergences.length > 0) {
    return true;
  }
  return Object.values(state.cores).some((id) => typeof id === 'string' && id.length > 0);
}

export const BOON_SYSTEM_CONFLICT_MESSAGE =
  'Save contains owned rewards from both LEGACY_CLASS_CATALOG and NINE_STRAIN. Refusing silent conversion.';

export interface ResolvedBoonSystemMode {
  mode: BoonSystemMode;
  conflict: string | null;
}

/**
 * Missing mode → legacy. Nine-Strain ownership → Nine-Strain.
 * Both owned catalogs → conflict (visible, no silent choice).
 */
export function resolveBoonSystemMode(args: {
  storedMode?: unknown;
  runtime: Pick<
    NineStrainRuntimeState,
    'cores' | 'supports' | 'manifestations' | 'convergences' | 'boundVerdict' | 'contactedStrains'
  >;
  legacyCatalog: LegacyClassCatalogSnapshot;
}): ResolvedBoonSystemMode {
  const legacyOwned = hasLegacyClassCatalogOwnership(args.legacyCatalog);
  const strainOwned = hasNineStrainOwnership(args.runtime);
  if (legacyOwned && strainOwned) {
    return { mode: 'LEGACY_CLASS_CATALOG', conflict: BOON_SYSTEM_CONFLICT_MESSAGE };
  }
  if (strainOwned) {
    return { mode: 'NINE_STRAIN', conflict: null };
  }
  if (args.storedMode === 'NINE_STRAIN') {
    if (legacyOwned) {
      return { mode: 'NINE_STRAIN', conflict: BOON_SYSTEM_CONFLICT_MESSAGE };
    }
    return { mode: 'NINE_STRAIN', conflict: null };
  }
  return { mode: 'LEGACY_CLASS_CATALOG', conflict: null };
}

/** Stage B initialization: only legal when the run has no legacy class boons. */
export function activateNineStrainAcquisition(
  state: NineStrainRuntimeState,
  legacyCatalog: LegacyClassCatalogSnapshot,
): NineStrainRuntimeState {
  if (hasLegacyClassCatalogOwnership(legacyCatalog)) {
    return {
      ...state,
      boonSystemConflict: BOON_SYSTEM_CONFLICT_MESSAGE,
    };
  }
  return {
    ...state,
    boonSystemMode: 'NINE_STRAIN',
    boonSystemConflict: null,
  };
}
