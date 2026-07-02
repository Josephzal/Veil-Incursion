export type AnomalyResolution = 'NARRATIVE' | 'AMBUSH_COMBAT' | 'BLACK_MARKET' | 'RESOURCE_HARVEST';

/** Roll anomaly outcome on engage: 55% narrative, 20% ambush, 15% market, 10% resource harvest. */
export function resolveAnomalyNode(rng: () => number = Math.random): AnomalyResolution {
  const roll = rng();
  if (roll < 0.55) return 'NARRATIVE';
  if (roll < 0.75) return 'AMBUSH_COMBAT';
  if (roll < 0.90) return 'BLACK_MARKET';
  return 'RESOURCE_HARVEST';
}

export function anomalyResolutionLogLine(resolution: AnomalyResolution): string {
  switch (resolution) {
    case 'NARRATIVE':
      return '>> SIGNAL DECODED — NARRATIVE BAND LOCKED.';
    case 'AMBUSH_COMBAT':
      return '>> SIGNAL SPOOF DETECTED — HOSTILE MANIFEST INBOUND.';
    case 'BLACK_MARKET':
      return '>> SIGNAL ROUTED — UNDERCITY CONDUIT OPEN.';
    case 'RESOURCE_HARVEST':
      return '>> SIGNAL DECODED — VOLATILE RESOURCE CLUSTER LOCKED.';
    default:
      return '>> ANOMALY RESOLVED.';
  }
}
