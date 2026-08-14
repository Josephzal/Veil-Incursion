import type { NineStrainRuntimeState } from '../types/nineStrain';
import { resolveBoonSystemMode } from './nineStrain/boonSystemMode';
import {
  createDefaultNineStrainRuntimeState,
  hydrateNineStrainRuntimeState,
} from './nineStrain/persistence';

export interface StoredNineStrainIncursionFields {
  nineStrainRuntime?: unknown;
  leyLineMutations?: readonly unknown[] | null;
  hexShotBoons?: readonly unknown[] | null;
  envoyBoons?: readonly unknown[] | null;
}

export interface NormalizedNineStrainIncursionFields {
  nineStrainRuntime: NineStrainRuntimeState;
}

export function normalizeNineStrainIncursionFields(
  input: object,
): NormalizedNineStrainIncursionFields {
  const stored = input as StoredNineStrainIncursionFields;
  const runtime = stored.nineStrainRuntime
    ? hydrateNineStrainRuntimeState(stored.nineStrainRuntime)
    : createDefaultNineStrainRuntimeState();
  const resolved = resolveBoonSystemMode({
    storedMode: runtime.boonSystemMode,
    runtime,
    legacyCatalog: {
      leyLineMutations: stored.leyLineMutations,
      hexShotBoons: stored.hexShotBoons,
      envoyBoons: stored.envoyBoons,
    },
  });
  return {
    nineStrainRuntime: {
      ...runtime,
      boonSystemMode: resolved.mode,
      boonSystemConflict: resolved.conflict,
    },
  };
}

export function hydrateNineStrainIncursionFields<T extends object>(
  incursion: T,
): T & NormalizedNineStrainIncursionFields {
  return {
    ...incursion,
    ...normalizeNineStrainIncursionFields(incursion),
  };
}
