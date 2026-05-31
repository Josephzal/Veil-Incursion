import React from 'react';
import InventoryManifestPanel from '../components/InventoryManifestPanel';
import TerminalSafeArea from '../components/TerminalSafeArea';

/** Legacy screen alias — manifest content lives in the unified hub nav. */
export default function InventoryManifestScreen(): React.JSX.Element {
  return (
    <TerminalSafeArea>
      <InventoryManifestPanel />
    </TerminalSafeArea>
  );
}
