import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

interface RunItemOverlayContextValue {
  itemsOpen: boolean;
  openItems: () => void;
  closeItems: () => void;
  itemsEnabled: boolean;
}

const RunItemOverlayContext = createContext<RunItemOverlayContextValue | null>(null);

export function RunItemOverlayProvider({
  children,
  itemsEnabled = true,
}: {
  children: React.ReactNode;
  itemsEnabled?: boolean;
}): React.JSX.Element {
  const [itemsOpen, setItemsOpen] = useState(false);
  const openItems = useCallback(() => {
    if (!itemsEnabled) return;
    setItemsOpen(true);
  }, [itemsEnabled]);
  const closeItems = useCallback(() => setItemsOpen(false), []);
  const value = useMemo(
    () => ({ itemsOpen, openItems, closeItems, itemsEnabled }),
    [closeItems, itemsEnabled, itemsOpen, openItems],
  );
  return (
    <RunItemOverlayContext.Provider value={value}>
      {children}
    </RunItemOverlayContext.Provider>
  );
}

export function useRunItemOverlay(): RunItemOverlayContextValue | null {
  return useContext(RunItemOverlayContext);
}
