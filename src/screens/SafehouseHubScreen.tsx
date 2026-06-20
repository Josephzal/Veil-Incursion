import React from 'react';
import TerminalSafeArea from '../components/TerminalSafeArea';
import SafehouseHubPanel from '../components/safehouse/SafehouseHubPanel';

/** @deprecated Pre-run safehouse lives on Overworld Hub tab 03 // SAFEHOUSE. */
export default function SafehouseHubScreen(): React.JSX.Element {
  return (
    <TerminalSafeArea>
      <SafehouseHubPanel />
    </TerminalSafeArea>
  );
}
