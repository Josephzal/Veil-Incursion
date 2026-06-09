/** Muted gray-green telemetry tint for secondary node readouts. */
export const NODE_TELEMETRY_LABEL_COLOR = 'rgba(95, 130, 108, 0.72)';

export function formatNodeVecId(nodeId: string): string {
  const stripped = nodeId
    .replace(/^sector-/i, '')
    .replace(/^safe-anchor-/i, 'ANCH-')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  if (stripped.length <= 8) return stripped;
  return `${stripped.slice(0, 4)}-${stripped.slice(-3)}`;
}

export function formatNodeTelemetryLabel(nodeId: string, depth: number): string {
  return `[${formatNodeVecId(nodeId)} // Depth: ${depth}]`;
}
