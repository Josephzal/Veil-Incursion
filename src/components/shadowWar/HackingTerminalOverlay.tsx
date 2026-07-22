import React from 'react';
import VeilTerminalEffects from '../atmosphere/VeilTerminalEffects';

interface HackingTerminalOverlayProps {
  /** Map viewport height — required for scan-line travel distance. */
  viewportHeight: number;
}

/**
 * @deprecated Prefer VeilTerminalEffects directly.
 * Thin wrapper preserved for Veil Front / Shadow War call sites.
 */
export default function HackingTerminalOverlay({
  viewportHeight,
}: HackingTerminalOverlayProps): React.JSX.Element {
  return <VeilTerminalEffects viewportHeight={viewportHeight} intensity="subtle" />;
}
