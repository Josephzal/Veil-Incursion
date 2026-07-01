import type { IncursionNode } from '../types/game';

export interface RunEventNodeHeaderCopy {
  title: string;
  subtitle?: string;
}

/** Split a sector node label into evac-style title + subtitle (`SIGNAL // TARGET`). */
export function resolveRunEventNodeHeaderFromLabel(label: string): RunEventNodeHeaderCopy {
  const parts = label.split(' // ').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      title: parts[parts.length - 1].toUpperCase(),
      subtitle: parts.slice(0, -1).join(' // ').toUpperCase(),
    };
  }
  return { title: (parts[0] ?? label).toUpperCase() };
}

export function resolveRunEventNodeHeaderFromNode(
  node: IncursionNode | null | undefined,
  fallbackTitle: string,
  fallbackSubtitle?: string,
): RunEventNodeHeaderCopy {
  if (!node?.label) {
    return {
      title: fallbackTitle.toUpperCase(),
      subtitle: fallbackSubtitle?.toUpperCase(),
    };
  }
  return resolveRunEventNodeHeaderFromLabel(node.label);
}
