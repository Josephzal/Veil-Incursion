export type AnomalyResolution = 'NARRATIVE' | 'AMBUSH_COMBAT' | 'BLACK_MARKET';

/** Roll anomaly outcome on engage: 65% narrative, 20% ambush, 15% black market. */
export function resolveAnomalyNode(rng: () => number = Math.random): AnomalyResolution {
  const roll = rng();
  if (roll < 0.66) return 'NARRATIVE';
  if (roll < 0.86) return 'AMBUSH_COMBAT';
  return 'BLACK_MARKET';
}

export function anomalyResolutionLogLine(resolution: AnomalyResolution): string {
  switch (resolution) {
    case 'NARRATIVE':
      return '>> SIGNAL DECODED — NARRATIVE BAND LOCKED.';
    case 'AMBUSH_COMBAT':
      return '>> SIGNAL SPOOF DETECTED — HOSTILE MANIFEST INBOUND.';
    case 'BLACK_MARKET':
      return '>> SIGNAL ROUTED — UNDERCITY CONDUIT OPEN.';
    default:
      return '>> ANOMALY RESOLVED.';
  }
}
