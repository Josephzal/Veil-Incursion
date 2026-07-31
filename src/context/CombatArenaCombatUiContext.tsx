import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import type { StatusFloatTone } from '../utils/combatTelemetryFormat';
import CombatWardenCalloutStack from '../components/combat/CombatWardenCalloutStack';
import CombatEnemyEvadeLabel from '../components/combat/CombatEnemyEvadeLabel';

export type ArenaResponseCalloutEntry = {
  unitId: string;
  left: number;
  top: number;
  width: number;
  damageSeq: number;
  damageLabel: string;
  statusSeq: number;
  statusLabel: string;
  statusTone: StatusFloatTone;
  critImpactSeq: number;
  critImpactChannel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  evadeImpactSeq: number;
  /** Only true when the immutable result for this target is critical. */
  criticalAuthorized: boolean;
  presentationId?: string | null;
  playerActionId?: string | null;
  resolvedResultId?: string | null;
  sourceActionKind?: string | null;
  sourceAbilityId?: string | null;
};

interface CombatArenaCombatUiContextValue {
  entries: Record<string, ArenaResponseCalloutEntry>;
  setEntry: (id: string, entry: ArenaResponseCalloutEntry | null) => void;
  hostOrigin: { x: number; y: number };
  setHostOrigin: (origin: { x: number; y: number }) => void;
}

const CombatArenaCombatUiContext = createContext<CombatArenaCombatUiContextValue | null>(null);

function entryEqual(a: ArenaResponseCalloutEntry, b: ArenaResponseCalloutEntry): boolean {
  return a.unitId === b.unitId
    && a.left === b.left
    && a.top === b.top
    && a.width === b.width
    && a.damageSeq === b.damageSeq
    && a.damageLabel === b.damageLabel
    && a.statusSeq === b.statusSeq
    && a.statusLabel === b.statusLabel
    && a.statusTone === b.statusTone
    && a.critImpactSeq === b.critImpactSeq
    && a.critImpactChannel === b.critImpactChannel
    && a.evadeImpactSeq === b.evadeImpactSeq
    && a.criticalAuthorized === b.criticalAuthorized
    && a.presentationId === b.presentationId
    && a.playerActionId === b.playerActionId
    && a.resolvedResultId === b.resolvedResultId;
}

/** Arena-level combat UI plane — above moving player, below global HUD overlays. */
export function CombatArenaCombatUiProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [entries, setEntries] = useState<Record<string, ArenaResponseCalloutEntry>>({});
  const [hostOrigin, setHostOriginState] = useState({ x: 0, y: 0 });
  const setHostOrigin = useCallback((origin: { x: number; y: number }) => {
    setHostOriginState((prev) => (
      prev.x === origin.x && prev.y === origin.y ? prev : origin
    ));
  }, []);
  const setEntry = useCallback((id: string, entry: ArenaResponseCalloutEntry | null) => {
    setEntries((prev) => {
      if (entry == null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      const cur = prev[id];
      if (cur && entryEqual(cur, entry)) return prev;
      return { ...prev, [id]: entry };
    });
  }, []);
  const value = useMemo(
    () => ({ entries, setEntry, hostOrigin, setHostOrigin }),
    [entries, setEntry, hostOrigin, setHostOrigin],
  );
  return (
    <CombatArenaCombatUiContext.Provider value={value}>
      {children}
    </CombatArenaCombatUiContext.Provider>
  );
}

export function useCombatArenaCombatUiOptional(): CombatArenaCombatUiContextValue | null {
  return useContext(CombatArenaCombatUiContext);
}

/** Renders response callouts above the moving Warden player. */
export function CombatArenaCombatUiHost(): React.JSX.Element | null {
  const ctx = useCombatArenaCombatUiOptional();
  const hostRef = useRef<View>(null);

  useLayoutEffect(() => {
    if (!ctx) return undefined;
    const measure = () => {
      const node = hostRef.current as (View & {
        measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      }) | null;
      node?.measureInWindow?.((x, y) => {
        ctx.setHostOrigin({ x, y });
      });
    };
    measure();
    const handle = setInterval(measure, 400);
    return () => clearInterval(handle);
  }, [ctx]);

  if (!ctx) return null;
  const nodes = Object.values(ctx.entries);
  return (
    <View ref={hostRef} style={styles.host} pointerEvents="box-none" collapsable={false}>
      {nodes.map((entry) => (
        <View
          key={entry.unitId}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: entry.left - ctx.hostOrigin.x,
            top: entry.top - ctx.hostOrigin.y,
            width: entry.width,
            alignItems: 'center',
          }}
        >
          <CombatEnemyEvadeLabel evadeImpactSeq={entry.evadeImpactSeq} />
          <CombatWardenCalloutStack
            damageSeq={entry.damageSeq}
            damageLabel={entry.damageLabel}
            statusSeq={entry.statusSeq}
            statusLabel={entry.statusLabel}
            statusTone={entry.statusTone}
            critImpactSeq={entry.criticalAuthorized ? entry.critImpactSeq : 0}
            critImpactChannel={entry.critImpactChannel}
            durationMs={900}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
});
