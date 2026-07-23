import { SCAN_SWEEP_MS } from './vectorScannerShared';

/**
 * Imperative bridge from the scanner RAF → VeilWarpField WebGL RAF.
 * Presentation only — not React state; no second sweep clock.
 */
export interface ScannerSweepBridgeSample {
  /** Leading beam angle in degrees — same value as the scanner engine. */
  angleDeg: number;
  /** Circular aperture center in atmosphere UV (0–1). */
  centerU: number;
  centerV: number;
  /**
   * Aperture radius in height-normalized UV units
   * (matches shader: d = ((uv-c)*vec2(aspect,1))).
   */
  radius: number;
  /** 1 when the functional sweep is active and should illuminate the field. */
  active: number;
  /** Atmosphere CSS pixel size (for geometry publishers). */
  fieldWidth: number;
  fieldHeight: number;
  /** Logical scanner square edge in CSS px. */
  scannerSize: number;
  /** Selected contact UV in atmosphere space (WebGL y-up). */
  selectedU: number;
  selectedV: number;
  hasSelectedContact: number;
  selectionStrength: number;
  /**
   * Increments when the lock target changes so VeilWarpField can restart
   * the one-shot ripple on the shader clock (no React per-frame state).
   */
  selectionEpoch: number;
  bezelPadding: number;
  biasX: number;
  /** Bottom content reserved for telemetry rail (CSS px). */
  bottomReserve: number;
}

/** Visual phosphor wake duration used only to derive wake angular width. */
export const SWEEP_WAKE_MS = 575;

/** Wake width in degrees from existing sweep period (not a second clock). */
export const SWEEP_WAKE_DEG = (SWEEP_WAKE_MS / SCAN_SWEEP_MS) * 360;

/** Matches ScanningScreen instrument visual bias — geometry sync only. */
export const SCANNER_INSTRUMENT_BIAS_X = -12;

export const scannerSweepBridge: ScannerSweepBridgeSample = {
  angleDeg: 0,
  centerU: 0.5,
  centerV: 0.5,
  radius: 0.42,
  active: 0,
  fieldWidth: 0,
  fieldHeight: 0,
  scannerSize: 0,
  selectedU: 0.5,
  selectedV: 0.5,
  hasSelectedContact: 0,
  selectionStrength: 0,
  selectionEpoch: 0,
  bezelPadding: 4,
  biasX: SCANNER_INSTRUMENT_BIAS_X,
  bottomReserve: 0,
};


/** Called from the scanner engine RAF with the authoritative beam angle. */
export function publishScannerSweepAngle(angleDeg: number, active: boolean): void {
  scannerSweepBridge.angleDeg = ((angleDeg % 360) + 360) % 360;
  scannerSweepBridge.active = active ? 1 : 0;
}

/**
 * Map circular scanner aperture into the bezel-sized atmosphere UV space.
 * Atmosphere is bezel-centered; instrument bias is applied only here for alignment.
 */
export function publishScannerSweepGeometry(opts: {
  fieldWidth: number;
  fieldHeight: number;
  scannerSize: number;
  bezelPadding: number;
  biasX?: number;
  bottomReserve?: number;
}): void {
  const {
    fieldWidth,
    fieldHeight,
    scannerSize,
    bezelPadding,
    biasX = SCANNER_INSTRUMENT_BIAS_X,
    bottomReserve = 0,
  } = opts;
  if (fieldWidth <= 0 || fieldHeight <= 0 || scannerSize <= 0) return;

  scannerSweepBridge.fieldWidth = fieldWidth;
  scannerSweepBridge.fieldHeight = fieldHeight;
  scannerSweepBridge.scannerSize = scannerSize;
  scannerSweepBridge.bezelPadding = bezelPadding;
  scannerSweepBridge.biasX = biasX;
  scannerSweepBridge.bottomReserve = bottomReserve;

  const contentW = Math.max(1, fieldWidth - bezelPadding * 2);
  const contentH = Math.max(1, fieldHeight - bezelPadding * 2 - bottomReserve);
  const centerX = bezelPadding + contentW * 0.5 + biasX;
  // CSS Y grows downward from the top of the bezel; content sits above the rail.
  const centerYFromTop = bezelPadding + contentH * 0.5;

  scannerSweepBridge.centerU = centerX / fieldWidth;
  // WebGL vUv.y = 0 at the bottom of the canvas — convert from CSS top-origin.
  scannerSweepBridge.centerV = 1 - centerYFromTop / fieldHeight;
  // Height-normalized radius for aspect-correct circle test in the shader.
  scannerSweepBridge.radius = (scannerSize * 0.5) / fieldHeight;
}

/**
 * Publish selected contact position in atmosphere UV (presentation only).
 * Uses the last published field/scanner geometry — no React per-frame updates.
 */
export function publishSelectedContact(opts: {
  canvasX: number;
  canvasY: number;
  has: boolean;
  strength?: number;
}): void {
  const { canvasX, canvasY, has, strength = 1 } = opts;
  const {
    fieldWidth,
    fieldHeight,
    scannerSize,
    bezelPadding,
    biasX,
    bottomReserve,
  } = scannerSweepBridge;

  if (!has || fieldWidth <= 0 || fieldHeight <= 0 || scannerSize <= 0) {
    scannerSweepBridge.hasSelectedContact = 0;
    scannerSweepBridge.selectionStrength = 0;
    return;
  }

  const contentW = Math.max(1, fieldWidth - bezelPadding * 2);
  const contentH = Math.max(1, fieldHeight - bezelPadding * 2 - bottomReserve);
  const scannerLeft = bezelPadding + (contentW - scannerSize) * 0.5 + biasX;
  const scannerTop = bezelPadding + (contentH - scannerSize) * 0.5;
  const absX = scannerLeft + canvasX;
  const absY = scannerTop + canvasY;
  const nextU = absX / fieldWidth;
  const nextV = 1 - absY / fieldHeight;

  const had = scannerSweepBridge.hasSelectedContact > 0.5;
  const moved = !had
    || Math.hypot(nextU - scannerSweepBridge.selectedU, nextV - scannerSweepBridge.selectedV) > 0.0015;
  if (moved) {
    scannerSweepBridge.selectionEpoch += 1;
  }

  scannerSweepBridge.selectedU = nextU;
  scannerSweepBridge.selectedV = nextV;
  scannerSweepBridge.hasSelectedContact = 1;
  scannerSweepBridge.selectionStrength = Math.max(0, Math.min(1, strength));
}
