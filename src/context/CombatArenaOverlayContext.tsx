import React, { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

interface CombatArenaOverlayContextValue {
  overlays: React.ReactNode;
  setOverlays: (node: React.ReactNode) => void;
}

const CombatArenaOverlayContext = createContext<CombatArenaOverlayContextValue | null>(null);

export function CombatArenaOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [overlays, setOverlays] = useState<React.ReactNode>(null);
  const value = useMemo(() => ({ overlays, setOverlays }), [overlays]);
  return (
    <CombatArenaOverlayContext.Provider value={value}>
      {children}
    </CombatArenaOverlayContext.Provider>
  );
}

export function useCombatArenaOverlayOptional(): CombatArenaOverlayContextValue | null {
  return useContext(CombatArenaOverlayContext);
}

/** Renders hub minigame overlays into the arena overlay host. */
export function CombatArenaOverlaySink({
  children,
}: {
  children: React.ReactNode;
}): null {
  const ctx = useCombatArenaOverlayOptional();
  useLayoutEffect(() => {
    ctx?.setOverlays(children);
    return () => {
      ctx?.setOverlays(null);
    };
  }, [children, ctx]);
  return null;
}

/** Absolute-fill host mounted in the combat arena panel. */
export function CombatArenaOverlayHost(): React.JSX.Element | null {
  const ctx = useCombatArenaOverlayOptional();
  if (!ctx?.overlays) return null;
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {ctx.overlays}
    </View>
  );
}
