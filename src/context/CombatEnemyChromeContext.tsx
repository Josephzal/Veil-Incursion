import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { ParryArenaLayout } from '../utils/parryCollision';
import type { SliceLineRender } from '../components/combat/VectorSliceOverlay';
import type { EnvoyWardExpansionSpeed } from '../components/combat/EnvoyWardOverlay';

/** Updated synchronously on perfect parry — avoids chrome-layer lag for success burst. */
export interface ParryBurstLiveState {
  active: boolean;
  arena: ParryArenaLayout | null;
  epoch: number;
}

  /** Serializable UI state — safe to store in React state. */
export interface CombatEnemyChromeUIState {
  ultimatePingVisible: boolean;
  ultimatePingReady: boolean;
  ultimatePingDisabled: boolean;
  ultimatePingVariant: 'eviscerate' | 'zero_protocol' | 'cataclysm' | null;
  /** Accessible label including canonical ultimate name. */
  ultimatePingAccessibilityLabel: string;
  /** Canonical ultimate display name for HUD chrome. */
  ultimatePingDisplayName: string | null;
  /** True while a weapon ultimate interaction popup is open. */
  ultimatePingInteractionOpen: boolean;
  masteryProgressVisible: boolean;
  masteryProgressCurrent: number;
  masteryProgressRequired: number;
  masteryProgressAccent: string;
  parryVisible: boolean;
  wardVisible: boolean;
  envoyWardSpeed: EnvoyWardExpansionSpeed;
  parrySuccess: boolean;
  parryFailure: boolean;
  parrySuccessBurstVisible: boolean;
  parryBurstArena: ParryArenaLayout | null;
  sliceVisible: boolean;
  eviscerateTargetUnitId: string | null;
  sliceLines: SliceLineRender[];
  activeSliceIndex: number;
}

export interface CombatEnemyChromeHandlers {
  onUltimatePing: () => void;
  onEnvoyWardRelease: (overlapRatio: number) => void;
  onParryTap: (tapX: number, tapY: number) => void;
  registerParryArena: (layout: ParryArenaLayout) => void;
  registerSliceArena: (layout: { width: number; height: number }) => void;
  parryShrinkScale: SharedValue<number> | null;
  slicePanHandlers: Record<string, unknown> | null;
}

/** Full snapshot from TacticalCombatHub bridge. */
export interface CombatEnemyChromeSnapshot extends CombatEnemyChromeUIState, CombatEnemyChromeHandlers {}

const noop = () => {};

const IDLE_UI: CombatEnemyChromeUIState = {
  ultimatePingVisible: false,
  ultimatePingReady: false,
  ultimatePingDisabled: true,
  ultimatePingVariant: null,
  ultimatePingAccessibilityLabel: 'Fire weapon ultimate',
  ultimatePingDisplayName: null,
  ultimatePingInteractionOpen: false,
  masteryProgressVisible: false,
  masteryProgressCurrent: 0,
  masteryProgressRequired: 3,
  masteryProgressAccent: '#94a3b8',
  parryVisible: false,
  wardVisible: false,
  envoyWardSpeed: 'normal',
  parrySuccess: false,
  parryFailure: false,
  parrySuccessBurstVisible: false,
  parryBurstArena: null,
  sliceVisible: false,
  eviscerateTargetUnitId: null,
  sliceLines: [],
  activeSliceIndex: -1,
};

const noopParryTap = (_x: number, _y: number) => {};
const noopRegisterArena = (_layout: ParryArenaLayout) => {};
const noopRegisterSliceArena = (_layout: { width: number; height: number }) => {};

const IDLE_HANDLERS: CombatEnemyChromeHandlers = {
  onUltimatePing: noop,
  onEnvoyWardRelease: () => {},
  onParryTap: noopParryTap,
  registerParryArena: noopRegisterArena,
  registerSliceArena: noopRegisterSliceArena,
  parryShrinkScale: null,
  slicePanHandlers: null,
};

function sliceLinesEqual(a: SliceLineRender[], b: SliceLineRender[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id
      || x.centerXRatio !== y.centerXRatio
      || x.centerYRatio !== y.centerYRatio
      || x.angleDeg !== y.angleDeg
      || x.isSliced !== y.isSliced
    ) {
      return false;
    }
  }
  return true;
}

function uiStateEqual(prev: CombatEnemyChromeUIState, next: CombatEnemyChromeUIState): boolean {
  return (
    prev.ultimatePingVisible === next.ultimatePingVisible
    && prev.ultimatePingReady === next.ultimatePingReady
    && prev.ultimatePingDisabled === next.ultimatePingDisabled
    && prev.ultimatePingVariant === next.ultimatePingVariant
    && prev.ultimatePingAccessibilityLabel === next.ultimatePingAccessibilityLabel
    && prev.ultimatePingDisplayName === next.ultimatePingDisplayName
    && prev.ultimatePingInteractionOpen === next.ultimatePingInteractionOpen
    && prev.masteryProgressVisible === next.masteryProgressVisible
    && prev.masteryProgressCurrent === next.masteryProgressCurrent
    && prev.masteryProgressRequired === next.masteryProgressRequired
    && prev.masteryProgressAccent === next.masteryProgressAccent
    && prev.parryVisible === next.parryVisible
    && prev.wardVisible === next.wardVisible
    && prev.envoyWardSpeed === next.envoyWardSpeed
    && prev.parrySuccess === next.parrySuccess
    && prev.parryFailure === next.parryFailure
    && prev.parrySuccessBurstVisible === next.parrySuccessBurstVisible
    && prev.parryBurstArena?.cx === next.parryBurstArena?.cx
    && prev.parryBurstArena?.cy === next.parryBurstArena?.cy
    && prev.parryBurstArena?.baseR === next.parryBurstArena?.baseR
    && prev.sliceVisible === next.sliceVisible
    && prev.eviscerateTargetUnitId === next.eviscerateTargetUnitId
    && prev.activeSliceIndex === next.activeSliceIndex
    && sliceLinesEqual(prev.sliceLines, next.sliceLines)
  );
}

interface CombatEnemyChromeContextValue {
  ui: CombatEnemyChromeUIState;
  handlersRef: React.MutableRefObject<CombatEnemyChromeHandlers>;
  parryBurstLiveRef: React.MutableRefObject<ParryBurstLiveState>;
  parryChromeTick: number;
  notifyParryChromeChange: () => void;
  updateUI: (patch: Partial<CombatEnemyChromeUIState>) => void;
  resetUI: () => void;
}

const CombatEnemyChromeContext = createContext<CombatEnemyChromeContextValue | null>(null);

export function CombatEnemyChromeProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [ui, setUi] = useState<CombatEnemyChromeUIState>(IDLE_UI);
  const handlersRef = useRef<CombatEnemyChromeHandlers>(IDLE_HANDLERS);
  const parryBurstLiveRef = useRef<ParryBurstLiveState>({
    active: false,
    arena: null,
    epoch: 0,
  });
  const [parryChromeTick, setParryChromeTick] = useState(0);
  const notifyParryChromeChange = useCallback(() => {
    setParryChromeTick((tick) => tick + 1);
  }, []);

  const updateUI = useCallback((patch: Partial<CombatEnemyChromeUIState>) => {
    setUi((prev) => {
      const next = { ...prev, ...patch };
      return uiStateEqual(prev, next) ? prev : next;
    });
  }, []);

  const resetUI = useCallback(() => {
    setUi(IDLE_UI);
    handlersRef.current = IDLE_HANDLERS;
    parryBurstLiveRef.current = { active: false, arena: null, epoch: 0 };
  }, []);

  const value = useMemo(
    () => ({
      ui,
      handlersRef,
      parryBurstLiveRef,
      parryChromeTick,
      notifyParryChromeChange,
      updateUI,
      resetUI,
    }),
    [ui, parryChromeTick, notifyParryChromeChange, updateUI, resetUI],
  );

  return (
    <CombatEnemyChromeContext.Provider value={value}>
      {children}
    </CombatEnemyChromeContext.Provider>
  );
}

export function useCombatEnemyChrome(): CombatEnemyChromeContextValue {
  const ctx = useContext(CombatEnemyChromeContext);
  if (!ctx) {
    throw new Error('useCombatEnemyChrome must be used within CombatEnemyChromeProvider');
  }
  return ctx;
}

export function useCombatEnemyChromeOptional(): CombatEnemyChromeContextValue | null {
  return useContext(CombatEnemyChromeContext);
}

/** Publishes chrome state from TacticalCombatHub (renders nothing). */
export function CombatChromeBridge(snapshot: CombatEnemyChromeSnapshot): null {
  const ctx = useCombatEnemyChromeOptional();

  const {
    ultimatePingVisible,
    ultimatePingReady,
    ultimatePingDisabled,
    ultimatePingVariant,
    ultimatePingAccessibilityLabel,
    ultimatePingDisplayName,
    ultimatePingInteractionOpen,
    masteryProgressVisible,
    masteryProgressCurrent,
    masteryProgressRequired,
    masteryProgressAccent,
    onUltimatePing,
    onEnvoyWardRelease,
    parryVisible,
    wardVisible,
    envoyWardSpeed,
    parryShrinkScale,
    parrySuccess,
    parryFailure,
    parrySuccessBurstVisible,
    parryBurstArena,
    onParryTap,
    registerParryArena,
    registerSliceArena,
    sliceVisible,
    eviscerateTargetUnitId,
    sliceLines,
    activeSliceIndex,
    slicePanHandlers,
  } = snapshot;

  if (ctx) {
    ctx.handlersRef.current = {
      onUltimatePing,
      onEnvoyWardRelease,
      onParryTap,
      registerParryArena,
      registerSliceArena,
      parryShrinkScale,
      slicePanHandlers,
    };
  }

  useEffect(() => {
    if (!ctx) return;
    ctx.updateUI({
      ultimatePingVisible,
      ultimatePingReady,
      ultimatePingDisabled,
      ultimatePingVariant,
      ultimatePingAccessibilityLabel,
      ultimatePingDisplayName,
      ultimatePingInteractionOpen,
      masteryProgressVisible,
      masteryProgressCurrent,
      masteryProgressRequired,
      masteryProgressAccent,
      parryVisible,
      wardVisible,
      envoyWardSpeed,
      parrySuccess,
      parryFailure,
      parrySuccessBurstVisible,
      parryBurstArena,
      sliceVisible,
      eviscerateTargetUnitId,
      sliceLines,
      activeSliceIndex,
    });
  }, [
    ctx,
    ultimatePingVisible,
    ultimatePingReady,
    ultimatePingDisabled,
    ultimatePingVariant,
    ultimatePingAccessibilityLabel,
    ultimatePingDisplayName,
    ultimatePingInteractionOpen,
    masteryProgressVisible,
    masteryProgressCurrent,
    masteryProgressRequired,
    masteryProgressAccent,
    parryVisible,
    wardVisible,
    envoyWardSpeed,
    parrySuccess,
    parryFailure,
    parrySuccessBurstVisible,
    parryBurstArena,
    sliceVisible,
    eviscerateTargetUnitId,
    sliceLines,
    activeSliceIndex,
  ]);

  return null;
}

/** Reserved for future slice/ping chrome over the enemy column. */
export function CombatEnemyChromeLayer(): React.JSX.Element | null {
  return null;
}
