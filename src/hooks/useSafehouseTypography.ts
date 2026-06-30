import { useMemo } from 'react';
import { useHubLayout } from '../context/HubLayoutContext';

/** @deprecated Prefer useHubLayout() — shim for Safehouse migration. */
export function useSafehouseTypography() {
  const layout = useHubLayout();

  return useMemo(
    () => ({
      isDesktop: layout.isDesktop,
      bodySize: (base: number) => layout.scaleFont(layout.isDesktop ? base * 1.35 : base),
      captionSize: (base: number) => layout.scaleFont(layout.isDesktop ? base * 1.5 : base),
      iconSize: layout.iconSize,
    }),
    [layout],
  );
}
