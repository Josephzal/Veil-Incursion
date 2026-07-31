/**
 * Warden's Strike presentation-only melee approach math.
 * Does not move gameplay roots, hitboxes, or battlefield slots.
 */

export type Point2 = { x: number; y: number };

export type ArenaRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Blade contact along hilt→tip (88–94%). */
export const WARDEN_BLADE_CONTACT_T = 0.91;

/** Contact may enter silhouette by this much; body stays left of target. */
export const WARDEN_APPROACH_CONTACT_TOLERANCE_PX = 8;

const enemyContactWindow = new Map<string, Point2>();
let playerArtBoxWindow: ArenaRect | null = null;
let playerArtBoxLogical: { width: number; height: number } | null = null;

export function registerWardenEnemyContactAnchor(unitId: string, windowPoint: Point2): void {
  enemyContactWindow.set(unitId, windowPoint);
}

export function clearWardenEnemyContactAnchor(unitId: string): void {
  enemyContactWindow.delete(unitId);
}

export function registerWardenPlayerArtBox(
  windowRect: ArenaRect,
  logicalSize: { width: number; height: number },
): void {
  playerArtBoxWindow = windowRect;
  playerArtBoxLogical = logicalSize;
}

export function clearWardenPlayerArtBox(): void {
  playerArtBoxWindow = null;
  playerArtBoxLogical = null;
}

export function getRegisteredEnemyContactAnchor(unitId: string): Point2 | null {
  return enemyContactWindow.get(unitId) ?? null;
}

export function getRegisteredPlayerArtBox(): {
  window: ArenaRect;
  logical: { width: number; height: number };
} | null {
  if (!playerArtBoxWindow || !playerArtBoxLogical) return null;
  return { window: playerArtBoxWindow, logical: playerArtBoxLogical };
}

export function computeBladeContactPoint(
  hilt: Point2,
  tip: Point2,
  t: number = WARDEN_BLADE_CONTACT_T,
): Point2 {
  return {
    x: hilt.x + (tip.x - hilt.x) * t,
    y: hilt.y + (tip.y - hilt.y) * t,
  };
}

/**
 * Convert a point in the player art-box into window coordinates using the
 * measured art-box rect (accounts for operativeScale / desktop scale).
 */
export function artBoxLocalToWindow(
  local: Point2,
  artBoxWindow: ArenaRect,
  logicalSize: { width: number; height: number },
): Point2 {
  const sx = logicalSize.width > 0 ? artBoxWindow.width / logicalSize.width : 1;
  const sy = logicalSize.height > 0 ? artBoxWindow.height / logicalSize.height : 1;
  return {
    x: artBoxWindow.x + local.x * sx,
    y: artBoxWindow.y + local.y * sy,
  };
}

export function windowDeltaToArtBoxLocal(
  windowDelta: Point2,
  artBoxWindow: ArenaRect,
  logicalSize: { width: number; height: number },
): Point2 {
  const sx = logicalSize.width > 0 ? artBoxWindow.width / logicalSize.width : 1;
  const sy = logicalSize.height > 0 ? artBoxWindow.height / logicalSize.height : 1;
  return {
    x: sx !== 0 ? windowDelta.x / sx : 0,
    y: sy !== 0 ? windowDelta.y / sy : 0,
  };
}

/** Immutable approach geometry — computed once per owning presentation. */
export type WardenApproachGeometrySnapshot = {
  targetId: string;
  playerStartWindow: ArenaRect;
  logicalSize: { width: number; height: number };
  hiltLocal: Point2;
  tipLocal: Point2;
  bladeContactLocal: Point2;
  targetContactWindow: Point2;
  translationLocal: Point2;
};

/**
 * Translation (art-box local px) that aligns attack blade contact with the
 * selected target contact anchor. Player remains left of the target; tip may
 * enter the silhouette only a restrained distance.
 */
export function computeWardenApproachTranslation(input: {
  bladeContactLocal: Point2;
  targetContactWindow: Point2;
  artBoxWindow: ArenaRect;
  logicalSize: { width: number; height: number };
  /** Soft cap so the body never centers on the enemy. */
  maxTranslateX?: number;
  /** Keep art-box right edge left of target (body left of selected enemy). */
  bodyLeftOfTarget?: boolean;
}): Point2 {
  const bladeWindow = artBoxLocalToWindow(
    input.bladeContactLocal,
    input.artBoxWindow,
    input.logicalSize,
  );
  const windowDelta = {
    x: input.targetContactWindow.x - bladeWindow.x,
    y: input.targetContactWindow.y - bladeWindow.y,
  };
  let local = windowDeltaToArtBoxLocal(
    windowDelta,
    input.artBoxWindow,
    input.logicalSize,
  );
  // Cap keeps the Aegis body left of the target; tip may enter silhouette only.
  const maxX = input.maxTranslateX ?? Math.max(96, input.logicalSize.width * 0.92);
  if (local.x > maxX) local = { ...local, x: maxX };
  if (local.x < 0) local = { ...local, x: Math.max(local.x, -12) };
  if (input.bodyLeftOfTarget !== false) {
    const sx = input.logicalSize.width > 0
      ? input.artBoxWindow.width / input.logicalSize.width
      : 1;
    // Art-box right edge after translation must stay left of target contact.
    const maxBodyX = ((input.targetContactWindow.x - input.artBoxWindow.x) / (sx || 1))
      - input.logicalSize.width * 0.55;
    if (local.x > maxBodyX) local = { ...local, x: Math.max(0, maxBodyX) };
  }
  return local;
}

/** Build immutable approach snapshot from live registry + registered blade points. */
export function buildWardenApproachGeometrySnapshot(input: {
  targetId: string;
  hiltLocal: Point2;
  tipLocal: Point2;
  approachDeltaOverride?: Point2 | null;
}): WardenApproachGeometrySnapshot | null {
  const art = getRegisteredPlayerArtBox();
  const target = enemyContactWindow.get(input.targetId);
  if (!art) return null;
  const bladeContactLocal = computeBladeContactPoint(input.hiltLocal, input.tipLocal);
  const targetContactWindow = target ?? {
    x: art.window.x + art.window.width + 80,
    y: art.window.y + art.window.height * 0.42,
  };
  const translationLocal = input.approachDeltaOverride ?? computeWardenApproachTranslation({
    bladeContactLocal,
    targetContactWindow,
    artBoxWindow: art.window,
    logicalSize: art.logical,
  });
  return {
    targetId: input.targetId,
    playerStartWindow: { ...art.window },
    logicalSize: { ...art.logical },
    hiltLocal: { ...input.hiltLocal },
    tipLocal: { ...input.tipLocal },
    bladeContactLocal,
    targetContactWindow: { ...targetContactWindow },
    translationLocal: { ...translationLocal },
  };
}

/** Resolve approach from live registry + blade local point. */
export function resolveWardenApproachTranslation(
  targetId: string,
  bladeContactLocal: Point2,
): Point2 | null {
  const target = enemyContactWindow.get(targetId);
  const art = getRegisteredPlayerArtBox();
  if (!target || !art) return null;
  return computeWardenApproachTranslation({
    bladeContactLocal,
    targetContactWindow: target,
    artBoxWindow: art.window,
    logicalSize: art.logical,
  });
}

let lastApproachDelta: Point2 = { x: 1, y: 0 };

export function setLastWardenApproachDelta(delta: Point2): void {
  lastApproachDelta = delta;
}

/** Recoil sign from presentation-time attacker approach (defaults rightward). */
export function getWardenRecoilSignX(): number {
  return lastApproachDelta.x >= 0 ? 1 : -1;
}

/**
 * Pure near/far examples for tests — arena-space blade vs target.
 * Returns translation that brings blade within tolerance of target.
 */
export function approachAlignsBladeToTarget(input: {
  bladeContactAfterTranslation: Point2;
  targetContact: Point2;
  tolerancePx?: number;
}): boolean {
  const tol = input.tolerancePx ?? WARDEN_APPROACH_CONTACT_TOLERANCE_PX;
  const dx = input.bladeContactAfterTranslation.x - input.targetContact.x;
  const dy = input.bladeContactAfterTranslation.y - input.targetContact.y;
  return Math.hypot(dx, dy) <= tol;
}
