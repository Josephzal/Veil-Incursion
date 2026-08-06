/**
 * Hex Shot Phase W.5 — cross-family audit authority and closeout helpers.
 * Pure/data-only. Does not retune closed W.2–W.4 authored values.
 */
import { createDefaultClassCombatEncounterState } from '../types/classCombatAbility';
import type { HexWeaponActionId } from '../types/hexWeaponAction';
import {
  HEX_BLACK_DOOR_WEAPON_ACTIONS,
  HEX_CARBINE_WEAPON_ACTIONS,
  HEX_REVOLVER_WEAPON_ACTIONS,
} from '../types/hexWeaponAction';
import {
  buildHexCombatSurface,
  isHexCombatSurfaceComplete,
} from './hexCombatCompatibility';
import {
  getHexWeaponActionDefinition,
  mapHexFixedBasicSignatureToWeaponAction,
} from './hexWeaponActionCatalog';
import {
  ALL_HEX_WEAPON_FAMILY_IDS,
  assertHexWeaponFamilyRegistryInvariant,
  deriveHexWeaponActions,
  getHexWeaponActionSet,
  isHexWeaponKitComplete,
  requireHexWeaponActions,
  type HexWeaponFamilyId,
} from './hexWeaponActionRegistry';
import { classAbilityTargetMode } from './combatClassTargeting';
import { DEFAULT_HEX_FLEX_LOADOUT } from '../types/operativeClass';
import { FIRING_SOLUTION_ACCURACY_BONUS_PCT } from './hexFiringSolutionEngine';
import { CARBINE_SUPPRESSED_DAMAGE_MULT } from './hexCarbineSuppressedEngine';
import { BLACK_DOOR_BACKLINE_DAMAGE_MULT } from './hexBlackDoorPositionEngine';
import { THRESHOLD_AUTHORED_DAMAGE } from './hexThresholdEngine';
import {
  DEADBOLT_BASE_DAMAGE,
  DEADBOLT_PRIMED_DAMAGE,
} from './hexDeadboltEngine';
import {
  CENTER_MASS_BASE_DAMAGE,
  CONTACT_FRONT_PACKET_DAMAGE,
  CONTROLLED_BURST_PACKET_DAMAGE,
  DEADBOLT_BASE_AUTHORED,
  DEADBOLT_PRIMED_AUTHORED,
  FATAL_FUNNEL_PRIMARY_AUTHORED,
  FATAL_FUNNEL_REAR_AUTHORED,
  LAST_WORD_BASE_DAMAGE,
  SIX_BELLS_PACKET_DAMAGE,
  SLIPSHOT_BASE_DAMAGE,
  SUPPRESSIVE_BARRAGE_PACKET_DAMAGE,
  THRESHOLD_AUTHORED,
} from './hexWeaponActionExecutor';

export interface HexWeaponActionAuditRow {
  familyId: HexWeaponFamilyId;
  actionId: HexWeaponActionId;
  orderIndex: number;
  label: string;
  apCost: number;
  staminaCost: number;
  ammoCost: number;
  targetMode: string;
  authoredBase: number;
  tags: readonly string[];
  generatesProtocol: false;
  consumesAstral: boolean;
  familyState: string | null;
}

const CANONICAL_ORDER: Record<HexWeaponFamilyId, readonly HexWeaponActionId[]> = {
  'hex-silver-core-sidearm': HEX_REVOLVER_WEAPON_ACTIONS,
  'hex-pulse-rifle': HEX_CARBINE_WEAPON_ACTIONS,
  'hex-void-cannon': HEX_BLACK_DOOR_WEAPON_ACTIONS,
};

const AUTHORED_BASE: Partial<Record<HexWeaponActionId, number>> = {
  QUICKDRAW: 10,
  SLIPSHOT: SLIPSHOT_BASE_DAMAGE,
  SIX_BELLS: SIX_BELLS_PACKET_DAMAGE,
  LAST_WORD: LAST_WORD_BASE_DAMAGE,
  CENTER_MASS: CENTER_MASS_BASE_DAMAGE,
  CONTROLLED_BURST: CONTROLLED_BURST_PACKET_DAMAGE,
  SUPPRESSIVE_BARRAGE: SUPPRESSIVE_BARRAGE_PACKET_DAMAGE,
  CONTACT_FRONT: CONTACT_FRONT_PACKET_DAMAGE,
  DOOR_KNOCKER: 16,
  FATAL_FUNNEL: FATAL_FUNNEL_PRIMARY_AUTHORED,
  THRESHOLD: THRESHOLD_AUTHORED,
  DEADBOLT: DEADBOLT_BASE_AUTHORED,
};

const FAMILY_STATE: Partial<Record<HexWeaponActionId, string>> = {
  SLIPSHOT: 'Elusive',
  CENTER_MASS: 'Firing Solution',
  SUPPRESSIVE_BARRAGE: 'Carbine Suppressed',
  THRESHOLD: 'Threshold',
  DEADBOLT: 'deadboltReloadOpportunity',
};

/** Astral: player-initiated ballistic WAs except Threshold. */
export function hexWeaponActionConsumesAstral(actionId: HexWeaponActionId): boolean {
  return actionId !== 'THRESHOLD';
}

export function auditHexWeaponAction(
  familyId: HexWeaponFamilyId,
  actionId: HexWeaponActionId,
  orderIndex: number,
): HexWeaponActionAuditRow {
  const def = getHexWeaponActionDefinition(actionId);
  if (!def) {
    throw new Error(`[HEX W.5] Missing catalog definition: ${actionId}`);
  }
  if (def.familyId !== familyId) {
    throw new Error(`[HEX W.5] Family ownership mismatch: ${actionId} on ${familyId}`);
  }
  return {
    familyId,
    actionId,
    orderIndex,
    label: def.label,
    apCost: def.apCost,
    staminaCost: def.staminaCost,
    ammoCost: def.ammoCost,
    targetMode: def.targetMode,
    authoredBase: AUTHORED_BASE[actionId] ?? def.baseDamage,
    tags: def.tags,
    generatesProtocol: false,
    consumesAstral: hexWeaponActionConsumesAstral(actionId),
    familyState: FAMILY_STATE[actionId] ?? null,
  };
}

export function auditAllHexWeaponActions(): HexWeaponActionAuditRow[] {
  assertHexWeaponFamilyRegistryInvariant();
  const rows: HexWeaponActionAuditRow[] = [];
  for (const familyId of ALL_HEX_WEAPON_FAMILY_IDS) {
    const actions = requireHexWeaponActions(familyId);
    assert.deepEqualCanonical(actions, CANONICAL_ORDER[familyId]);
    actions.forEach((actionId, i) => {
      rows.push(auditHexWeaponAction(familyId, actionId, i));
    });
  }
  return rows;
}

/** Local deep-equal without importing node:assert into production paths. */
const assert = {
  deepEqualCanonical(
    actual: readonly HexWeaponActionId[],
    expected: readonly HexWeaponActionId[],
  ): void {
    if (actual.length !== expected.length) {
      throw new Error(`[HEX W.5] Action count mismatch: ${actual.length} !== ${expected.length}`);
    }
    for (let i = 0; i < actual.length; i += 1) {
      if (actual[i] !== expected[i]) {
        throw new Error(`[HEX W.5] Order mismatch at ${i}: ${actual[i]} !== ${expected[i]}`);
      }
    }
  },
};

export function historicalBasicCanonicalMap(): Record<HexWeaponFamilyId, HexWeaponActionId> {
  return {
    'hex-silver-core-sidearm': mapHexFixedBasicSignatureToWeaponAction('hex-silver-core-sidearm') as HexWeaponActionId,
    'hex-pulse-rifle': mapHexFixedBasicSignatureToWeaponAction('hex-pulse-rifle') as HexWeaponActionId,
    'hex-void-cannon': mapHexFixedBasicSignatureToWeaponAction('hex-void-cannon') as HexWeaponActionId,
  };
}

export function assertNoLegacyHexCombatSurface(): void {
  for (const familyId of ALL_HEX_WEAPON_FAMILY_IDS) {
    const surface = buildHexCombatSurface({
      weaponFamilyId: familyId,
      flex: DEFAULT_HEX_FLEX_LOADOUT,
    });
    if (!isHexCombatSurfaceComplete(surface)) {
      throw new Error(`[HEX W.5] Incomplete surface for ${familyId}`);
    }
    if ((surface as { mode: string }).mode === 'LEGACY_BASIC_FLEX') {
      throw new Error(`[HEX W.5] LEGACY_BASIC_FLEX still reachable for ${familyId}`);
    }
    if (surface.hudCards.includes('SILVER_CORE_SIDEARM')) {
      throw new Error(`[HEX W.5] Historical anchor playable on ${familyId}`);
    }
    if (!isHexWeaponKitComplete(familyId)) {
      throw new Error(`[HEX W.5] kitComplete false for registered family ${familyId}`);
    }
  }
  const unresolved = buildHexCombatSurface({
    weaponFamilyId: null,
    flex: DEFAULT_HEX_FLEX_LOADOUT,
  });
  if (unresolved.hudCards.includes('SILVER_CORE_SIDEARM')) {
    throw new Error('[HEX W.5] Missing family falls back to historical basic');
  }
  if (unresolved.weaponActionCount !== 0) {
    throw new Error('[HEX W.5] Missing family must not invent weapon actions');
  }
}

export function createCleanHexEncounterStateForSerializationProbe() {
  return createDefaultClassCombatEncounterState();
}

export const W5_LOCKED_CONSTANTS = {
  firingSolutionAccuracyBonusPct: FIRING_SOLUTION_ACCURACY_BONUS_PCT,
  carbineSuppressedMult: CARBINE_SUPPRESSED_DAMAGE_MULT,
  blackDoorBacklineMult: BLACK_DOOR_BACKLINE_DAMAGE_MULT,
  thresholdAuthored: THRESHOLD_AUTHORED_DAMAGE,
  deadboltBase: DEADBOLT_BASE_DAMAGE,
  deadboltPrimed: DEADBOLT_PRIMED_DAMAGE,
  deadboltAuthoredBase: DEADBOLT_BASE_AUTHORED,
  deadboltAuthoredPrimed: DEADBOLT_PRIMED_AUTHORED,
  fatalFunnelPrimary: FATAL_FUNNEL_PRIMARY_AUTHORED,
  fatalFunnelRear: FATAL_FUNNEL_REAR_AUTHORED,
} as const;

export function familyDesignKitAlias(familyId: HexWeaponFamilyId): string {
  return getHexWeaponActionSet(familyId)!.designKitAlias;
}

export function targetingModeForAction(actionId: HexWeaponActionId): string {
  return classAbilityTargetMode('HEX_SHOT', actionId);
}

export function deriveActionsOrThrow(familyId: HexWeaponFamilyId) {
  return deriveHexWeaponActions(familyId);
}
