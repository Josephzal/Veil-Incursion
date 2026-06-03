import { ScannerAnomaly, ScannerAnomalyLabel } from '../types/scanner';

const GDD_LABEL_POOL: readonly ScannerAnomalyLabel[] = [
  'DISTORTION_REMNANT',
  'VEIL_BREACH_ECHO',
  'CORE_SIGNATURE',
  'PHASE_LOCK_SPIKE',
  'GRAVITIC_PULSE',
  'SPECTRAL_CASCADE',
];

const RADIAL_MARGIN = 20;

function pickLabel(index: number): ScannerAnomalyLabel {
  return GDD_LABEL_POOL[index % GDD_LABEL_POOL.length];
}

function bearingFromCenter(center: number, x: number, y: number): number {
  const rad = Math.atan2(y - center, x - center);
  return ((rad * 180) / Math.PI + 360) % 360;
}

/**
 * Polar placement within circular scanner bounds (never outside radius).
 * r = random * (SCANNER_SIZE/2 - 20), alpha = random * 2π
 */
export function positionAnomalyInScanner(
  scannerSize: number,
  rng: () => number = Math.random,
): { x: number; y: number } {
  const center = scannerSize / 2;
  const maxR = center - RADIAL_MARGIN;
  const r = rng() * maxR;
  const alpha = rng() * 2 * Math.PI;
  return {
    x: center + r * Math.cos(alpha),
    y: center + r * Math.sin(alpha),
  };
}

/** Build randomized anomalies for sweep tracking (call on mount / scan re-init). */
export function generateScannerAnomalies(
  scannerSize: number,
  rng: () => number = Math.random,
  countRange: { min: number; max: number } = { min: 1, max: 3 },
): ScannerAnomaly[] {
  const span = Math.max(0, countRange.max - countRange.min);
  const count = countRange.min + Math.floor(rng() * (span + 1));
  const center = scannerSize / 2;
  const usedAngles: number[] = [];

  return Array.from({ length: count }, (_, i) => {
    let x = 0;
    let y = 0;
    let angleDeg = 0;
    let attempts = 0;

    do {
      const pos = positionAnomalyInScanner(scannerSize, rng);
      x = pos.x;
      y = pos.y;
      angleDeg = bearingFromCenter(center, x, y);
      attempts += 1;
    } while (
      attempts < 12 &&
      usedAngles.some((a) => angleDeltaDeg(angleDeg, a) < 18)
    );

    usedAngles.push(angleDeg);

    return {
      id: `anomaly-${i}-${Math.floor(rng() * 1e6)}`,
      x,
      y,
      label: pickLabel(Math.floor(rng() * GDD_LABEL_POOL.length)),
      angleDeg,
    };
  });
}

export function angleDeltaDeg(sweepDeg: number, targetDeg: number): number {
  const raw = ((sweepDeg - targetDeg) % 360 + 360) % 360;
  return raw > 180 ? 360 - raw : raw;
}
