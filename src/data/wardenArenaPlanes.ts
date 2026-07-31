/**
 * Authoritative arena stacking planes for Warden presentation.
 * Parent hosts must use these — child zIndex across isolated parents is insufficient.
 */

export const WARDEN_ARENA_PLANE = {
  /** Enemy portraits, Brand reticle/label, enemy-local decals. */
  brandAndEnemyArt: 8,
  /** Enemy grid host while Warden is idle (normal). */
  enemyGrid: 10,
  /** Brand orbital when Warden is not presenting. */
  brandIdle: 20,
  /** Operative idle. */
  operative: 12,
  /** Moving Warden presentation wrapper. */
  wardenPlayer: 14,
  /** Selected-target tip contact artwork (player-local, rides wardenPlayer). */
  contactArt: 15,
  /** Damage / defense / crit / evade text. */
  responseText: 18,
  /** Global HUD / modal overlays. */
  globalHud: 25,
} as const;

export type WardenArenaPlaneId = keyof typeof WARDEN_ARENA_PLANE;

export function wardenArenaPlaneOrder(): Array<{ id: WardenArenaPlaneId; z: number }> {
  return (Object.keys(WARDEN_ARENA_PLANE) as WardenArenaPlaneId[])
    .map((id) => ({ id, z: WARDEN_ARENA_PLANE[id] }))
    .sort((a, b) => a.z - b.z);
}

/** Brand plane must composite below the moving Warden wrapper. */
export function brandPlaneIsBelowWardenPlayer(
  brandPlaneZ: number = WARDEN_ARENA_PLANE.brandAndEnemyArt,
  wardenPlaneZ: number = WARDEN_ARENA_PLANE.wardenPlayer,
): boolean {
  return brandPlaneZ < wardenPlaneZ;
}
