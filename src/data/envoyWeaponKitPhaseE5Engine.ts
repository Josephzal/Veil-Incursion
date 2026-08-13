/**
 * E.5 — Envoy live 4+3 presentation + three-flex persistence closeout validator.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_ENVOY_FLEX_LOADOUT,
  DEFAULT_ENVOY_LOADOUT,
} from '../types/operativeClass';
import {
  ALL_ENVOY_WEAPON_FAMILY_IDS,
  deriveEnvoyWeaponActions,
  isEnvoyWeaponActionLiveExecutable,
  isEnvoyWeaponActionPlayerFacingLive,
  requireEnvoyWeaponActions,
} from './envoyWeaponActionRegistry';
import {
  ENVOY_EXECUTABLE_WEAPON_ACTION_IDS,
  ENVOY_HEARTS_DUE_WEAPON_ACTIONS,
  ENVOY_SCYTHE_WEAPON_ACTIONS,
  ENVOY_VAMBRACE_WEAPON_ACTIONS,
} from '../types/envoyWeaponAction';
import {
  buildEnvoyCombatSurface,
  isEnvoyCombatSurfaceComplete,
} from './envoyCombatCompatibility';
import {
  countEnvoyOrderedFlexTriples,
  countEnvoyUnorderedFlexSets,
  ENVOY_FLEX_POOL,
  projectEnvoyLiveFourSlotDeck,
  sanitizeEnvoyFlexLoadout,
} from './envoyFlexLoadoutEngine';
import { sanitizeEnvoyCombatLoadout } from './classAbilityUnlockEngine';
import {
  formatEnvoyWeaponActionLabel,
  getEnvoyWeaponActionDefinition,
  isEnvoyWeaponActionPreviewLive,
  listEnvoyWeaponActionDefinitions,
} from './envoyWeaponActionCatalog';
import { STARTER_WEAPON_BY_CLASS } from './weaponRegistry';
import { validateWeaponUnlockPaths } from './weaponUnlockPathEngine';
import { buildHexCombatSurface } from './hexCombatCompatibility';
import { DEFAULT_HEX_FLEX_LOADOUT } from '../types/operativeClass';
import {
  ALL_AEGIS_WEAPON_FAMILY_IDS,
  deriveAegisWeaponActions,
} from './aegisWeaponActionRegistry';
import { ALL_HEX_WEAPON_FAMILY_IDS, requireHexWeaponActions } from './hexWeaponActionRegistry';

export interface EnvoyE5Issue {
  code: string;
  message: string;
}

const LEGACY_FOUR_SLOT_FORMS: readonly (readonly string[])[] = [
  ['VEIL_SPLINTER', 'ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'],
  ['GRAVEWEAVE', 'ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'],
  ['NULL_ARC', 'FLUX_PURGE', 'SOUL_TETHER', 'MIND_SUNDER'],
  ['BLOOD_REFRACTION', 'DIMENSIONAL_SHEAR', 'PHASE_STEP', 'FLESH_WARP'],
  ['BLACK_WICK', 'ASTRAL_LANCE', 'ENTROPY_HEX', 'NECROTIC_BLOOM'],
];

const RETIRED_LIVE_LOG_PREFIXES = [
  '[ECHO LANTERN]',
  '[NULL CONDUIT]',
  '[SANGUINE PRISM]',
] as const;

const STALE_GDD_CLAIMS = [
  'Envoy remains 4-slot',
  'Envoy alone still uses the older **4-slot',
  'Do not describe Envoy as 4+3',
  'Envoy still presents the four-slot deck',
  'Envoy alone remains on the prior 4-slot deck',
] as const;

export function validateEnvoyWeaponKitPhaseE5(): EnvoyE5Issue[] {
  const issues: EnvoyE5Issue[] = [];
  const push = (code: string, message: string) => issues.push({ code, message });

  if (ENVOY_EXECUTABLE_WEAPON_ACTION_IDS.length !== 12) {
    push('ROSTER_COUNT', `Expected 12 WA, got ${ENVOY_EXECUTABLE_WEAPON_ACTION_IDS.length}`);
  }
  if (listEnvoyWeaponActionDefinitions().length !== 12) {
    push('CATALOG_COUNT', 'Catalog must list 12 actions');
  }
  if (ENVOY_VAMBRACE_WEAPON_ACTIONS.length !== 4
    || ENVOY_SCYTHE_WEAPON_ACTIONS.length !== 4
    || ENVOY_HEARTS_DUE_WEAPON_ACTIONS.length !== 4) {
    push('FAMILY_ORDER', 'Each family must have exactly 4 ordered actions');
  }

  for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
    const actions = requireEnvoyWeaponActions(familyId);
    if (actions.length !== 4) {
      push('FAMILY_DERIVE', `${familyId} derive length ${actions.length}`);
    }
    const surface = buildEnvoyCombatSurface({
      weaponFamilyId: familyId,
      flex: DEFAULT_ENVOY_FLEX_LOADOUT,
    });
    if (!isEnvoyCombatSurfaceComplete(surface)) {
      push('SURFACE_INCOMPLETE', `${familyId} surface incomplete`);
    }
    if (surface.hudCards.length !== 7 || new Set(surface.hudCards).size !== 7) {
      push('SURFACE_CARDS', `${familyId} hudCards must be 7 unique`);
    }
    if (surface.hudCards.includes('VEIL_SPLINTER') || surface.hudCards.includes('BLACK_WICK')) {
      push('COMPAT_CARD', `${familyId} must not show compatibility aliases`);
    }
    if (surface.hudCards.includes('RIFT_WARD') || surface.hudCards.includes('CATACLYSM_SIGIL')) {
      push('OUTSIDE_STRIP', `${familyId} Ward/Ultimate leaked into strip`);
    }
    const actionOnes = surface.hudCards.filter((id) => id === actions[0]);
    if (actionOnes.length !== 1) {
      push('ACTION1_DUP', `${familyId} Action 1 appears ${actionOnes.length} times`);
    }
    for (const id of actions) {
      if (!isEnvoyWeaponActionPlayerFacingLive(familyId, id)) {
        push('PLAYER_FACING', `${id} not player-facing on ${familyId}`);
      }
      if (!isEnvoyWeaponActionLiveExecutable(familyId, id)) {
        push('EXECUTABLE', `${id} not executable on ${familyId}`);
      }
      const def = getEnvoyWeaponActionDefinition(id);
      if (!def || def.executorUnavailable) {
        push('EXECUTOR', `${id} missing executor`);
      }
      if (!isEnvoyWeaponActionPreviewLive(id)) {
        push('PREVIEW', `${id} missing preview`);
      }
      if (!formatEnvoyWeaponActionLabel(id).includes('[')) {
        push('LABEL', `${id} missing display label`);
      }
    }
    if (
      JSON.stringify(surface.weaponActions)
      !== JSON.stringify(deriveEnvoyWeaponActions(familyId))
    ) {
      push('SANCTUARY_COMBAT_ROSTER', `${familyId} surface WA != registry derive`);
    }
  }

  if (DEFAULT_ENVOY_LOADOUT.length !== 3) {
    push('PERSIST_SHAPE', 'DEFAULT_ENVOY_LOADOUT must be three-flex');
  }
  if (JSON.stringify([...DEFAULT_ENVOY_LOADOUT]) !== JSON.stringify([...DEFAULT_ENVOY_FLEX_LOADOUT])) {
    push('DEFAULT_TRIPLE', 'Default loadout must equal default flex triple');
  }
  if (ENVOY_FLEX_POOL.length !== 11) {
    push('FLEX_POOL', `Flex pool ${ENVOY_FLEX_POOL.length} != 11`);
  }
  if (countEnvoyUnorderedFlexSets() !== 165 || countEnvoyOrderedFlexTriples() !== 990) {
    push('FLEX_COMBOS', 'Flex combinations drifted from 165/990');
  }

  for (const legacy of LEGACY_FOUR_SLOT_FORMS) {
    const flex = sanitizeEnvoyCombatLoadout(legacy);
    if (flex.length !== 3) {
      push('MIGRATE_LEN', `Legacy ${legacy[0]} did not migrate to 3`);
    }
    const again = sanitizeEnvoyCombatLoadout(flex);
    if (JSON.stringify([...again]) !== JSON.stringify([...flex])) {
      push('MIGRATE_IDEM', `Migration not idempotent for ${legacy[0]}`);
    }
    if (flex.includes('VEIL_SPLINTER' as never) || flex.some((id) => getEnvoyWeaponActionDefinition(id))) {
      push('MIGRATE_WA', `Persisted WA/anchor after migrate from ${legacy[0]}`);
    }
  }

  const frozen = Object.freeze(['VEIL_SPLINTER', 'FLUX_PURGE', 'SOUL_TETHER', 'MIND_SUNDER'] as const);
  const before = [...frozen];
  const migrated = sanitizeEnvoyFlexLoadout(frozen);
  sanitizeEnvoyFlexLoadout(migrated);
  if (JSON.stringify([...frozen]) !== JSON.stringify(before)) {
    push('PURITY', 'sanitize mutated frozen input');
  }

  // Historical projection helper still builds 4-slot for fixtures only — never persistence.
  const projected = projectEnvoyLiveFourSlotDeck(DEFAULT_ENVOY_FLEX_LOADOUT);
  if (projected[0] !== 'VEIL_SPLINTER' || projected.length !== 4) {
    push('PROJECT_HELPER', 'projectEnvoyLiveFourSlotDeck fixture helper broken');
  }

  if (STARTER_WEAPON_BY_CLASS.ENVOY !== 'envoy-vambrace') {
    push('STARTER', 'Vambrace must remain starter');
  }
  const unlockIssues = validateWeaponUnlockPaths();
  if (unlockIssues.length > 0) {
    push('UNLOCK_PATH', unlockIssues.join('; '));
  }

  for (const id of ALL_AEGIS_WEAPON_FAMILY_IDS) {
    if (deriveAegisWeaponActions(id)?.length !== 4) {
      push('AEGIS', `${id} Aegis WA drifted`);
    }
  }
  for (const id of ALL_HEX_WEAPON_FAMILY_IDS) {
    if (requireHexWeaponActions(id).length !== 4) {
      push('HEX', `${id} Hex WA drifted`);
    }
  }
  const hexSurface = buildHexCombatSurface({
    weaponFamilyId: 'hex-revolver',
    flex: DEFAULT_HEX_FLEX_LOADOUT,
  });
  if (hexSurface.hudCards.length !== 7) {
    push('HEX_SURFACE', 'Hex surface length drifted');
  }

  // Docs stale-claim scan
  try {
    const gddPath = join(process.cwd(), 'docs/current-game-systems-design.md');
    const gdd = readFileSync(gddPath, 'utf8');
    for (const claim of STALE_GDD_CLAIMS) {
      if (gdd.includes(claim)) {
        push('GDD_STALE', `current-game-systems-design still claims: ${claim}`);
      }
    }
    if (!gdd.includes('Envoy') || !gdd.includes('4+3')) {
      push('GDD_MISSING', 'GDD must describe Envoy as live 4+3');
    }
  } catch (err) {
    push('GDD_READ', `Could not read GDD: ${String(err)}`);
  }

  // Retired live combat-log prefixes in basic engine
  try {
    const basicPath = join(process.cwd(), 'src/data/weaponBasicEngine.ts');
    const basic = readFileSync(basicPath, 'utf8');
    for (const s of RETIRED_LIVE_LOG_PREFIXES) {
      if (basic.includes(s)) {
        push('LOG_RETIRED', `weaponBasicEngine still emits ${s}`);
      }
    }
  } catch (err) {
    push('LOG_READ', `Could not read weaponBasicEngine: ${String(err)}`);
  }

  return issues;
}
