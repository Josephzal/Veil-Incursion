import { useMemo } from 'react';
import { useResponsiveScale } from './useResponsiveScale';
import {
  DESKTOP_HUB_ICON_SIZE,
  DESKTOP_HUB_ICON_SIZE_MOBILE,
} from '../constants/safehouseDesktopLayout';

/** Desktop-safe typography + icon sizing for Safehouse panels. */
export function useSafehouseTypography() {
  const { isDesktop, scaleSize } = useResponsiveScale();

  return useMemo(
    () => ({
      isDesktop,
      /** Secondary/body copy — ~1.35× on desktop before global scale. */
      bodySize: (base: number) => scaleSize(isDesktop ? base * 1.35 : base),
      /** Captions, costs, tags — ~1.5× on desktop before global scale. */
      captionSize: (base: number) => scaleSize(isDesktop ? base * 1.5 : base),
      iconSize: isDesktop ? scaleSize(DESKTOP_HUB_ICON_SIZE) : DESKTOP_HUB_ICON_SIZE_MOBILE,
    }),
    [isDesktop, scaleSize],
  );
}
