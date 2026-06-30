import { useMemo } from 'react';
import { HUB_LINE_HEIGHT, HUB_TYPE, type HubTypeToken } from '../constants/hubTypography';
import { useHubLayout } from '../context/HubLayoutContext';

/** Semantic hub typography — single scale path via `scaleFont`. */
export function useHubTypography() {
  const layout = useHubLayout();

  return useMemo(
    () => ({
      isDesktop: layout.isDesktop,
      iconSize: layout.iconSize,
      scaleFont: layout.scaleFont,
      size: (token: HubTypeToken) => layout.scaleFont(HUB_TYPE[token]),
      lineHeight: (token: HubTypeToken) => layout.scaleFont(HUB_LINE_HEIGHT[token]),
      /** Raw base px scaled once — prefer `size('body'|'caption')` for new code. */
      bodySize: (base: number) => layout.scaleFont(base),
      captionSize: (base: number) => layout.scaleFont(base),
    }),
    [layout],
  );
}
