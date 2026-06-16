export function getDepthScale(depth: number): number {
  return 1 + (depth - 1) * 0.25;
}
