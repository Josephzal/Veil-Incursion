/**
 * Phase D.2 — shared hit-absorb protection presentation (Martyr graft / Juggernaut Plating).
 * Runtime absorb semantics stay hit-count based; this module owns provenance + labels.
 */

export type HitAbsorbProtectionSource = 'MARTYR_GRAFT' | 'JUGGERNAUT_PLATING';

export type HitAbsorbProtectionState = {
  hitsRemaining: number;
  source: HitAbsorbProtectionSource | null;
};

export const MARTYR_PROTECTION_HITS = 2;
export const JUGGERNAUT_PROTECTION_HITS = 1;

export function createDefaultHitAbsorbProtectionState(): HitAbsorbProtectionState {
  return { hitsRemaining: 0, source: null };
}

export function isHitAbsorbProtectionSource(value: unknown): value is HitAbsorbProtectionSource {
  return value === 'MARTYR_GRAFT' || value === 'JUGGERNAUT_PLATING';
}

/**
 * Safe hydrate from incomplete / legacy snapshots.
 * Never invents Martyr merely because hits > 0.
 */
export function hydrateHitAbsorbProtectionState(raw: {
  hitsRemaining?: unknown;
  juggernautShieldHits?: unknown;
  source?: unknown;
  hitAbsorbProtectionSource?: unknown;
} | null | undefined): HitAbsorbProtectionState {
  if (!raw || typeof raw !== 'object') return createDefaultHitAbsorbProtectionState();
  const hitsRaw = raw.hitsRemaining ?? raw.juggernautShieldHits;
  const hits = typeof hitsRaw === 'number' && Number.isFinite(hitsRaw)
    ? Math.max(0, Math.floor(hitsRaw))
    : 0;
  if (hits <= 0) return createDefaultHitAbsorbProtectionState();
  const sourceRaw = raw.source ?? raw.hitAbsorbProtectionSource;
  const source = isHitAbsorbProtectionSource(sourceRaw) ? sourceRaw : null;
  return { hitsRemaining: hits, source };
}

/** Preserve Math.max arm semantics; only adopt a new source when charges increase. */
export function armHitAbsorbProtection(
  state: HitAbsorbProtectionState,
  source: HitAbsorbProtectionSource,
  charges: number,
): { next: HitAbsorbProtectionState; applied: boolean } {
  const nextCharges = Math.max(0, Math.floor(charges));
  if (nextCharges <= 0) {
    const cleared = clearHitAbsorbProtection(state);
    return {
      next: cleared,
      applied: state.hitsRemaining > 0 || state.source != null,
    };
  }
  if (nextCharges > state.hitsRemaining) {
    return { next: { hitsRemaining: nextCharges, source }, applied: true };
  }
  // Equal or lower charge offer — keep existing counter; refresh source only if unset.
  if (state.hitsRemaining > 0 && state.source == null) {
    return { next: { hitsRemaining: state.hitsRemaining, source }, applied: true };
  }
  return { next: state, applied: false };
}

export function absorbHitAbsorbProtection(
  state: HitAbsorbProtectionState,
): {
  next: HitAbsorbProtectionState;
  absorbed: boolean;
  remaining: number;
  source: HitAbsorbProtectionSource | null;
} {
  if (state.hitsRemaining <= 0) {
    return {
      next: createDefaultHitAbsorbProtectionState(),
      absorbed: false,
      remaining: 0,
      source: null,
    };
  }
  const remaining = state.hitsRemaining - 1;
  const source = state.source;
  if (remaining <= 0) {
    return {
      next: createDefaultHitAbsorbProtectionState(),
      absorbed: true,
      remaining: 0,
      source,
    };
  }
  return {
    next: { hitsRemaining: remaining, source },
    absorbed: true,
    remaining,
    source,
  };
}

export function clearHitAbsorbProtection(
  _state?: HitAbsorbProtectionState,
): HitAbsorbProtectionState {
  return createDefaultHitAbsorbProtectionState();
}

export function hitAbsorbProtectionDisplayName(
  source: HitAbsorbProtectionSource | null,
): string {
  if (source === 'MARTYR_GRAFT') return 'MARTYR';
  if (source === 'JUGGERNAUT_PLATING') return 'JUGGERNAUT PLATING';
  return 'PROTECTION';
}

export function formatHitAbsorbProtectionAbsorbLog(
  source: HitAbsorbProtectionSource | null,
  remaining: number,
): string {
  const label = hitAbsorbProtectionDisplayName(source);
  if (remaining > 0) {
    return `[${label}] >> Hit absorbed (${remaining} charge${remaining === 1 ? '' : 's'} remaining).`;
  }
  return `[${label}] >> Final charge absorbed the hit.`;
}

export function formatHitAbsorbProtectionArmedLog(
  source: HitAbsorbProtectionSource,
  charges: number,
): string {
  if (source === 'MARTYR_GRAFT') {
    return `>> [MARTYR GRAFT] — ${charges}-hit graft shield online.`;
  }
  return `[JUGGERNAUT PLATING] >> Mobility shield primed (${charges} hit).`;
}

/** Compact HUD/status chip label; null when inactive. */
export function formatHitAbsorbProtectionStatusChip(
  state: HitAbsorbProtectionState,
): { id: string; label: string; tone: 'ready' } | null {
  if (state.hitsRemaining <= 0) return null;
  const name = hitAbsorbProtectionDisplayName(state.source);
  return {
    id: `hit-absorb-${state.source ?? 'unknown'}`,
    label: `${name} ×${state.hitsRemaining}`,
    tone: 'ready',
  };
}

/** Sync boon encounter fields ↔ protection state (single source of truth helpers). */
export function readHitAbsorbProtectionFromBoonEncounter(encounter: {
  juggernautShieldHits?: number;
  hitAbsorbProtectionSource?: HitAbsorbProtectionSource | null;
}): HitAbsorbProtectionState {
  return hydrateHitAbsorbProtectionState({
    juggernautShieldHits: encounter.juggernautShieldHits,
    hitAbsorbProtectionSource: encounter.hitAbsorbProtectionSource,
  });
}

export function writeHitAbsorbProtectionToBoonEncounter<T extends {
  juggernautShieldHits: number;
  hitAbsorbProtectionSource: HitAbsorbProtectionSource | null;
}>(encounter: T, state: HitAbsorbProtectionState): T {
  encounter.juggernautShieldHits = state.hitsRemaining;
  encounter.hitAbsorbProtectionSource = state.hitsRemaining > 0 ? state.source : null;
  return encounter;
}
