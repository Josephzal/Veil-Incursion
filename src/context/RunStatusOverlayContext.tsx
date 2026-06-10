import React, { createContext, useContext } from 'react';

interface RunStatusOverlayContextValue {
  openStatus: () => void;
  statusEnabled: boolean;
}

const RunStatusOverlayContext = createContext<RunStatusOverlayContextValue | null>(null);

export function RunStatusOverlayProvider({
  value,
  children,
}: {
  value: RunStatusOverlayContextValue;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <RunStatusOverlayContext.Provider value={value}>
      {children}
    </RunStatusOverlayContext.Provider>
  );
}

export function useRunStatusOverlay(): RunStatusOverlayContextValue | null {
  return useContext(RunStatusOverlayContext);
}
