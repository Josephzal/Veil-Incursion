/**
 * Phase C combat surface — four derived weapon actions + three canonical techniques.
 * No technique remaps, substitutes, or parallel executor-ID arrays.
 */
import type {
  AegisTechniqueLoadout,
  AegisWeaponActionId,
} from '../types/aegisCombat';
import { DEFAULT_AEGIS_TECHNIQUE_LOADOUT } from '../types/aegisCombat';
import { sanitizeAegisTechniqueLoadout } from './aegisMigration';
import {
  deriveAegisWeaponActions,
  type AegisWeaponFamilyId,
} from './aegisWeaponActionRegistry';
import type { WeaponFamilyId } from '../types/weapon';

export interface AegisCombatSurface {
  familyId: AegisWeaponFamilyId;
  /** Derived — never persist. */
  weaponActions: readonly [
    AegisWeaponActionId,
    AegisWeaponActionId,
    AegisWeaponActionId,
    AegisWeaponActionId,
  ];
  /** Snapshotted technique IDs — display, targeting, preview, telemetry, and executor agree. */
  techniques: AegisTechniqueLoadout;
  /**
   * Flat HUD order: 4 weapon actions then 3 techniques (authored IDs).
   * Not a persisted deck.
   */
  hudCards: readonly string[];
}

/**
 * Build the combat surface from snapshotted family + technique loadout.
 * Account edits after descent must not change an active run — pass the run snapshot.
 */
export function buildAegisCombatSurface(args: {
  weaponFamilyId: WeaponFamilyId | AegisWeaponFamilyId | null | undefined;
  techniques: AegisTechniqueLoadout | readonly string[] | null | undefined;
}): AegisCombatSurface {
  const familyId = (args.weaponFamilyId ?? 'aegis-runed-longsword') as AegisWeaponFamilyId;
  const actions = deriveAegisWeaponActions(familyId)
    ?? deriveAegisWeaponActions('aegis-runed-longsword')!;
  const techniques = sanitizeAegisTechniqueLoadout(
    args.techniques ?? DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
  );
  return {
    familyId: (deriveAegisWeaponActions(familyId) ? familyId : 'aegis-runed-longsword'),
    weaponActions: actions,
    techniques,
    hudCards: [...actions, ...techniques],
  };
}
