/**
 * Envoy E.3 — three-flex persisted loadout + pure migration from legacy 4-slot decks.
 */
import type {
  EnvoyAbilityId,
  EnvoyFlexAbilityId,
  EnvoyFlexLoadout,
  EnvoyLoadout,
} from '../types/operativeClass';
import {
  DEFAULT_ENVOY_FLEX_LOADOUT,
  DEFAULT_ENVOY_LOADOUT,
} from '../types/operativeClass';
import { isEnvoyProcUltimate } from './combatMasteryEngine';
import { migrateEnvoyAbilityId } from './envoyMigration';
import { isEnvoyWeaponActionId } from './envoyWeaponActionRegistry';
import {
  isEnvoyHistoricalAnchorId,
  isEnvoyCompatibilityOnlyId,
} from './envoyActionAliases';

/** Compatibility anchor — never a flex. Kept local to avoid circular unlock-engine imports. */
const ENVOY_ANCHOR_ID = 'VEIL_SPLINTER';
const ENVOY_INTRINSIC_IDS: readonly string[] = ['RIFT_WARD', 'CATACLYSM_SIGIL'];

export const ENVOY_FLEX_POOL: readonly EnvoyFlexAbilityId[] = [
  'ASTRAL_LANCE',
  'ENTROPY_HEX',
  'NECROTIC_BLOOM',
  'FLUX_PURGE',
  'DIMENSIONAL_SHEAR',
  'PHASE_STEP',
  'AETHERIC_TRANSFUSION',
  'SOUL_TETHER',
  'FLESH_WARP',
  'PARALYTIC_MIASMA',
  'MIND_SUNDER',
];

Object.freeze(ENVOY_FLEX_POOL);
Object.freeze(DEFAULT_ENVOY_FLEX_LOADOUT);

export function isEnvoyFlexAbilityId(id: string): id is EnvoyFlexAbilityId {
  return (ENVOY_FLEX_POOL as readonly string[]).includes(id);
}

function isValidFlexCandidate(id: string, used: Set<string>): id is EnvoyFlexAbilityId {
  if (used.has(id)) return false;
  if (id === ENVOY_ANCHOR_ID) return false;
  if (ENVOY_INTRINSIC_IDS.includes(id)) return false;
  if (isEnvoyProcUltimate(id)) return false;
  if (isEnvoyWeaponActionId(id)) return false;
  if (isEnvoyHistoricalAnchorId(id)) return false;
  if (isEnvoyCompatibilityOnlyId(id)) return false;
  return isEnvoyFlexAbilityId(id);
}

function nextDefaultFlex(used: Set<string>): EnvoyFlexAbilityId {
  for (const id of DEFAULT_ENVOY_FLEX_LOADOUT) {
    if (!used.has(id)) return id;
  }
  for (const id of ENVOY_FLEX_POOL) {
    if (!used.has(id)) return id;
  }
  return 'ASTRAL_LANCE';
}

/**
 * Collect ordered flex candidates from unknown/legacy input without mutating it.
 * Does not yet filter illegals — sanitizeEnvoyFlexLoadout applies eligibility.
 */
export function extractEnvoyFlexCandidates(
  loadout: readonly string[] | null | undefined,
): string[] {
  if (!loadout || !Array.isArray(loadout) || loadout.length === 0) {
    return [...DEFAULT_ENVOY_FLEX_LOADOUT];
  }
  const migrated = loadout.map((id) => migrateEnvoyAbilityId(String(id)));
  // Drop every historical slot-zero / anchor / WA / compat-only id from the stream,
  // then keep remaining order (supports anchors in any slot + 3-flex / 4-slot / oversized).
  const withoutAnchors = migrated.filter(
    (id) =>
      id !== ENVOY_ANCHOR_ID
      && !isEnvoyHistoricalAnchorId(id)
      && !isEnvoyWeaponActionId(id)
      && !isEnvoyCompatibilityOnlyId(id),
  );
  if (withoutAnchors.length > 0) return withoutAnchors;
  return [...DEFAULT_ENVOY_FLEX_LOADOUT];
}

/**
 * Pure, idempotent three-flex sanitize.
 * Accepts legacy 4-tuples, 3-tuples, oversized/short arrays, and frozen inputs.
 * Never mutates the input array.
 */
export function sanitizeEnvoyFlexLoadout(
  loadout: readonly string[] | EnvoyFlexLoadout | EnvoyLoadout | null | undefined,
): EnvoyFlexLoadout {
  const candidates = extractEnvoyFlexCandidates(
    Array.isArray(loadout) ? loadout : undefined,
  );
  const used = new Set<string>();
  const flex: EnvoyFlexAbilityId[] = [];
  for (const raw of candidates) {
    if (flex.length >= 3) break;
    if (isValidFlexCandidate(raw, used)) {
      used.add(raw);
      flex.push(raw);
    }
  }
  while (flex.length < 3) {
    const replacement = nextDefaultFlex(used);
    used.add(replacement);
    flex.push(replacement);
  }
  return [flex[0]!, flex[1]!, flex[2]!];
}

/**
 * @deprecated E.5 — live surface is 4+3; persistence is three-flex.
 * Kept for migration fixtures / historical projection tests only.
 * Always `[VEIL_SPLINTER, f1, f2, f3]` from the canonical flex triple.
 */
export function projectEnvoyLiveFourSlotDeck(
  loadout: readonly string[] | EnvoyFlexLoadout | EnvoyLoadout | null | undefined,
): readonly [EnvoyAbilityId, EnvoyFlexAbilityId, EnvoyFlexAbilityId, EnvoyFlexAbilityId] {
  const flex = sanitizeEnvoyFlexLoadout(loadout);
  return [ENVOY_ANCHOR_ID as EnvoyAbilityId, flex[0], flex[1], flex[2]];
}

export function validateEnvoyFlexLoadoutCommit(
  loadout: readonly string[],
  unlocked?: readonly string[],
): string | null {
  if (loadout.length !== 3) {
    return '>> LOADOUT REJECTED — THREE FLEX SLOTS REQUIRED.';
  }
  if (loadout.some((id) => isEnvoyWeaponActionId(id))) {
    return '>> LOADOUT REJECTED — WEAPON ACTIONS ARE NOT SELECTABLE FLEXES.';
  }
  if (loadout.some((id) => id === ENVOY_ANCHOR_ID || isEnvoyHistoricalAnchorId(id))) {
    return '>> LOADOUT REJECTED — WEAPON ANCHOR IS NOT A FLEX SLOT.';
  }
  if (loadout.some((id) => isEnvoyProcUltimate(id) || id === 'CATACLYSM_SIGIL')) {
    return '>> LOADOUT REJECTED — NULL CIRCUIT is a weapon ultimate, not a deck slot.';
  }
  if (loadout.some((id) => ENVOY_INTRINSIC_IDS.includes(id))) {
    return '>> LOADOUT REJECTED — INTRINSIC ABILITY CANNOT OCCUPY A FLEX SLOT.';
  }
  const illegal = loadout.find((id) => !isEnvoyFlexAbilityId(id));
  if (illegal) {
    return `>> LOADOUT REJECTED — ${String(illegal).replace(/_/g, ' ')} NOT AN ASSIGNABLE FLEX ABILITY.`;
  }
  if (new Set(loadout).size < loadout.length) {
    return '>> LOADOUT REJECTED — DUPLICATE ABILITY SLOTS DETECTED.';
  }
  if (unlocked) {
    const locked = loadout.find((id) => !unlocked.includes(id));
    if (locked) {
      return `>> LOADOUT REJECTED — ${locked.replace(/_/g, ' ')} NOT UNLOCKED.`;
    }
  }
  return null;
}

/** Combinatorics helpers for validation / tests. */
export function countEnvoyUnorderedFlexSets(): number {
  const n = ENVOY_FLEX_POOL.length;
  return (n * (n - 1) * (n - 2)) / 6;
}

export function countEnvoyOrderedFlexTriples(): number {
  const n = ENVOY_FLEX_POOL.length;
  return n * (n - 1) * (n - 2);
}

export function enumerateEnvoyOrderedFlexTriples(): EnvoyFlexLoadout[] {
  const out: EnvoyFlexLoadout[] = [];
  for (const a of ENVOY_FLEX_POOL) {
    for (const b of ENVOY_FLEX_POOL) {
      if (b === a) continue;
      for (const c of ENVOY_FLEX_POOL) {
        if (c === a || c === b) continue;
        out.push([a, b, c]);
      }
    }
  }
  return out;
}

export function enumerateEnvoyUnorderedFlexSets(): readonly (readonly EnvoyFlexAbilityId[])[] {
  const out: EnvoyFlexAbilityId[][] = [];
  for (let i = 0; i < ENVOY_FLEX_POOL.length; i += 1) {
    for (let j = i + 1; j < ENVOY_FLEX_POOL.length; j += 1) {
      for (let k = j + 1; k < ENVOY_FLEX_POOL.length; k += 1) {
        out.push([ENVOY_FLEX_POOL[i]!, ENVOY_FLEX_POOL[j]!, ENVOY_FLEX_POOL[k]!]);
      }
    }
  }
  return out;
}

export { DEFAULT_ENVOY_FLEX_LOADOUT, DEFAULT_ENVOY_LOADOUT };
