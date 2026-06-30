import { useMemo } from 'react';
import { useResponsiveLayout, type ResponsiveLayoutMetrics } from './useResponsiveLayout';

export interface CombatDesktopLayoutMetrics extends ResponsiveLayoutMetrics {
  isCombatDesktop: boolean;
  scaleCombatFont: (base: number) => number;
  scaleCombatSize: (base: number) => number;
}

/** Web desktop combat scaling — inner content only; does not resize panel shells. */
export function useCombatDesktopLayout(): CombatDesktopLayoutMetrics {
  const layout = useResponsiveLayout();
  const { isDesktop, scaleFont, scaleSize } = layout;

  return useMemo(() => ({
    ...layout,
    isCombatDesktop: isDesktop,
    scaleCombatFont: (base: number) => (isDesktop ? scaleFont(base) : base),
    scaleCombatSize: (base: number) => (isDesktop ? scaleSize(base) : base),
  }), [isDesktop, layout, scaleFont, scaleSize]);
}
