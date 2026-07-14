/**
 * Run structure knobs — node count lives in runPacingConfig; frequencies here document
 * intended mix for future generator wiring (Phase B+ may consume more of these).
 */

import {
  ALLOWED_NODES_PER_DISTRICT,
  formatRunPacingDebugSummary,
  getDistrictGateDepths,
  getMaxRunGraphDepth,
  getNodesPerDistrict,
  getSafeAnchorGraphDepths,
  resetNodesPerDistrictForTesting,
  setNodesPerDistrictForTesting,
  type NodesPerDistrictPreset,
} from '../runIntegration/runPacingConfig';

export const RUN_BALANCE_CONFIG = {
  /** Depths in a full clear (fixed structure for v1). */
  depthCount: 3,
  /**
   * Node count per depth — runtime preset via getNodesPerDistrict().
   * Allowed: 10 | 12 | 15. Default 15.
   */
  allowedNodesPerDepth: ALLOWED_NODES_PER_DISTRICT,
  /** Boss is the last node of each depth (gate index = nodesPerDepth). */
  bossAtEndOfDepth: true,

  /**
   * Intended node-type mix guidance (relative weight comments for designers).
   * Generators already roll types; these are balance intent, not live weights yet.
   */
  intendedMixNotes: {
    combat: 'Majority of engagements',
    elite: 'Sparse — ~1–2 meaningful elites per depth',
    sanctuary: 'At least occasional recovery opportunity mid-depth',
    market: 'Optional — not guaranteed every depth',
    safeExtraction: 'Viable early exit without feeling mandatory',
    dirtyExtraction: 'Riskier recall — reward should beat safe when it pays off',
    anomaly: 'Breaks combat cadence; keep readable in Depth 1',
    resourceNode: 'Ley-Slag / Echo-Glass backbone sinks',
  },
} as const;

export {
  getNodesPerDistrict,
  setNodesPerDistrictForTesting,
  resetNodesPerDistrictForTesting,
  getMaxRunGraphDepth,
  getDistrictGateDepths,
  getSafeAnchorGraphDepths,
  formatRunPacingDebugSummary,
  ALLOWED_NODES_PER_DISTRICT,
};
export type { NodesPerDistrictPreset };

export function formatRunBalanceConfigSummary(): string {
  return [
    'RUN BALANCE CONFIG',
    `depthCount: ${RUN_BALANCE_CONFIG.depthCount}`,
    formatRunPacingDebugSummary(),
  ].join('\n');
}
