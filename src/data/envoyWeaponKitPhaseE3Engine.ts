/**
 * Envoy Phase E.3 — total registry validation and structural audit helpers.
 * Pure/data-only. Does not implement Actions 2–4 effects.
 */
import {
  ENVOY_HEARTS_DUE_WEAPON_ACTIONS,
  ENVOY_SCYTHE_WEAPON_ACTIONS,
  ENVOY_VAMBRACE_WEAPON_ACTIONS,
  type EnvoyWeaponActionId,
} from '../types/envoyWeaponAction';
import {
  listEnvoyWeaponActionDefinitions,
  requireEnvoyWeaponActionDefinition,
} from './envoyWeaponActionCatalog';
import {
  ALL_ENVOY_WEAPON_FAMILY_IDS,
  assertEnvoyWeaponFamilyRegistryInvariant,
  isEnvoyWeaponActionId,
  requireEnvoyWeaponActions,
  type EnvoyWeaponFamilyId,
} from './envoyWeaponActionRegistry';
import {
  countEnvoyOrderedFlexTriples,
  countEnvoyUnorderedFlexSets,
  ENVOY_FLEX_POOL,
  enumerateEnvoyOrderedFlexTriples,
  enumerateEnvoyUnorderedFlexSets,
} from './envoyFlexLoadoutEngine';
import { DEFAULT_ENVOY_FLEX_LOADOUT } from '../types/operativeClass';
import {
  buildEnvoyCombatSurface,
  isEnvoyCombatSurfaceComplete,
} from './envoyCombatCompatibility';
import { isEnvoyProcUltimate } from './combatMasteryEngine';
import { getWeaponUltimate } from './weaponUltimateRegistry';

const CANONICAL_ORDER: Record<EnvoyWeaponFamilyId, readonly EnvoyWeaponActionId[]> = {
  'envoy-echo-lantern': ENVOY_VAMBRACE_WEAPON_ACTIONS,
  'envoy-null-conduit': ENVOY_SCYTHE_WEAPON_ACTIONS,
  'envoy-sanguine-prism': ENVOY_HEARTS_DUE_WEAPON_ACTIONS,
};

export interface EnvoyWeaponKitValidationIssue {
  code: string;
  message: string;
}

export function validateEnvoyWeaponKitTotalAuthority(): EnvoyWeaponKitValidationIssue[] {
  const issues: EnvoyWeaponKitValidationIssue[] = [];
  try {
    assertEnvoyWeaponFamilyRegistryInvariant();
  } catch (err) {
    issues.push({
      code: 'REGISTRY_INVARIANT',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  if (ALL_ENVOY_WEAPON_FAMILY_IDS.length !== 3) {
    issues.push({
      code: 'FAMILY_COUNT',
      message: `Expected 3 Envoy families, got ${ALL_ENVOY_WEAPON_FAMILY_IDS.length}`,
    });
  }

  const allIds: string[] = [];
  for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
    const actions = requireEnvoyWeaponActions(familyId);
    if (actions.length !== 4) {
      issues.push({
        code: 'ACTION_COUNT',
        message: `${familyId} has ${actions.length} actions`,
      });
    }
    const expected = CANONICAL_ORDER[familyId];
    for (let i = 0; i < 4; i += 1) {
      if (actions[i] !== expected[i]) {
        issues.push({
          code: 'ORDER',
          message: `${familyId} order[${i}] ${actions[i]} !== ${expected[i]}`,
        });
      }
      const def = requireEnvoyWeaponActionDefinition(actions[i]!);
      if (def.familyId !== familyId) {
        issues.push({
          code: 'OWNERSHIP',
          message: `${actions[i]} catalog family ${def.familyId} !== ${familyId}`,
        });
      }
      if (def.order !== i + 1) {
        issues.push({
          code: 'CATALOG_ORDER',
          message: `${actions[i]} catalog order ${def.order} !== ${i + 1}`,
        });
      }
    }
    allIds.push(...actions);
  }

  if (new Set(allIds).size !== 12) {
    issues.push({
      code: 'GLOBAL_UNIQUE',
      message: `Expected 12 unique WA IDs, got ${new Set(allIds).size}`,
    });
  }

  if (listEnvoyWeaponActionDefinitions().length !== 12) {
    issues.push({
      code: 'CATALOG_SIZE',
      message: `Catalog size ${listEnvoyWeaponActionDefinitions().length}`,
    });
  }

  for (const id of allIds) {
    if (ENVOY_FLEX_POOL.includes(id as never)) {
      issues.push({ code: 'WA_FLEX_OVERLAP', message: id });
    }
    if (id === 'RIFT_WARD' || id === 'CATACLYSM_SIGIL' || id === 'VEIL_SPLINTER') {
      issues.push({ code: 'COMPAT_IN_REGISTRY', message: id });
    }
    if (isEnvoyProcUltimate(id)) {
      issues.push({ code: 'ULTIMATE_IN_REGISTRY', message: id });
    }
  }

  for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
    const ult = getWeaponUltimate(familyId);
    if (isEnvoyWeaponActionId(ult.id)) {
      issues.push({
        code: 'ULTIMATE_WA_OVERLAP',
        message: `${familyId} ultimate ${ult.id}`,
      });
    }
  }

  if (ENVOY_FLEX_POOL.length !== 11) {
    issues.push({
      code: 'FLEX_POOL',
      message: `Expected 11 flex IDs, got ${ENVOY_FLEX_POOL.length}`,
    });
  }
  if (countEnvoyUnorderedFlexSets() !== 165) {
    issues.push({
      code: 'FLEX_SETS',
      message: `Expected 165 sets, got ${countEnvoyUnorderedFlexSets()}`,
    });
  }
  if (countEnvoyOrderedFlexTriples() !== 990) {
    issues.push({
      code: 'FLEX_TRIPLES',
      message: `Expected 990 triples, got ${countEnvoyOrderedFlexTriples()}`,
    });
  }
  if (
    DEFAULT_ENVOY_FLEX_LOADOUT[0] !== 'ASTRAL_LANCE'
    || DEFAULT_ENVOY_FLEX_LOADOUT[1] !== 'ENTROPY_HEX'
    || DEFAULT_ENVOY_FLEX_LOADOUT[2] !== 'NECROTIC_BLOOM'
  ) {
    issues.push({ code: 'DEFAULT_FLEX', message: String(DEFAULT_ENVOY_FLEX_LOADOUT) });
  }

  for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
    const surface = buildEnvoyCombatSurface({
      weaponFamilyId: familyId,
      flex: DEFAULT_ENVOY_FLEX_LOADOUT,
    });
    if (!isEnvoyCombatSurfaceComplete(surface)) {
      issues.push({
        code: 'SURFACE',
        message: `${familyId} surface incomplete`,
      });
    }
    // E.4 — all four family actions are engine-executable; player-facing mount remains E.5.
    if (surface.liveExecutableIds.length !== 4) {
      issues.push({
        code: 'LIVE_GATE',
        message: `${familyId} liveExecutableIds=${surface.liveExecutableIds.join(',')}`,
      });
    }
  }

  // Enumerate counts match helpers (spot-check length).
  if (enumerateEnvoyUnorderedFlexSets().length !== 165) {
    issues.push({ code: 'ENUM_SETS', message: 'unordered enum mismatch' });
  }
  if (enumerateEnvoyOrderedFlexTriples().length !== 990) {
    issues.push({ code: 'ENUM_TRIPLES', message: 'ordered enum mismatch' });
  }

  return issues;
}
