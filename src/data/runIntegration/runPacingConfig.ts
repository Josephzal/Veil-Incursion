/** Config-driven district tree depth — tune for run-length testing without rebalance. */

export const ALLOWED_NODES_PER_DISTRICT = [10, 12, 15] as const;
export type NodesPerDistrictPreset = (typeof ALLOWED_NODES_PER_DISTRICT)[number];

const DEFAULT_NODES_PER_DISTRICT: NodesPerDistrictPreset = 15;

let nodesPerDistrict: NodesPerDistrictPreset = DEFAULT_NODES_PER_DISTRICT;

export function getNodesPerDistrict(): NodesPerDistrictPreset {
  return nodesPerDistrict;
}

export function setNodesPerDistrictForTesting(value: NodesPerDistrictPreset): void {
  if (!ALLOWED_NODES_PER_DISTRICT.includes(value)) return;
  nodesPerDistrict = value;
}

export function resetNodesPerDistrictForTesting(): void {
  nodesPerDistrict = DEFAULT_NODES_PER_DISTRICT;
}

export function getMaxRunGraphDepth(): number {
  return nodesPerDistrict * 3;
}

export function getDistrictGateDepths(): readonly [number, number, number] {
  const d = nodesPerDistrict;
  return [d, d * 2, d * 3];
}

/** Safe-anchor conduit depths scaled from the 15-node baseline (8, 15, 22). */
export function getSafeAnchorGraphDepths(): readonly [number, number, number] {
  const d = nodesPerDistrict;
  return [
    Math.max(4, Math.round((d * 8) / 15)),
    d,
    Math.max(d + 1, Math.round((d * 22) / 15)),
  ];
}

export function formatRunPacingDebugSummary(): string {
  const d = nodesPerDistrict;
  const gates = getDistrictGateDepths();
  const anchors = getSafeAnchorGraphDepths();
  return [
    'RUN PACING CONFIG',
    `nodes per district: ${d}`,
    `max graph depth: ${getMaxRunGraphDepth()}`,
    `district gates: ${gates.join(', ')}`,
    `safe anchors: ${anchors.join(', ')}`,
    `allowed presets: ${ALLOWED_NODES_PER_DISTRICT.join(', ')}`,
  ].join('\n');
}
