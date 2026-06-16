/** Scale = 1 + (currentNode * 0.15) where currentNode is 0-indexed encounter index. */
export function getNodeScale(nodeIndex: number): number {
  return 1 + nodeIndex * 0.15;
}
