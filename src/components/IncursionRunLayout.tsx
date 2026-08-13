import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { pulseCargoClose, pulseCargoOpen, pulseStatusDismiss, pulseStatusOpen } from '../utils/hubButtonHaptics';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { resolveSpecialCargoStacksForIncursion } from '../data/postRunCargoRoutingRunState';
import CargoGridOverlay from './CargoGridOverlay';
import RunGlobalChrome from './RunGlobalChrome';
import KeepsakeTriggerToast from './KeepsakeTriggerToast';
import DepthIdentityToast from './DepthIdentityToast';
import RunItemTriggerToast from './RunItemTriggerToast';
import RunStatusOverlay from './RunStatusOverlay';
import RunItemSlotChoiceModal from './run/RunItemSlotChoiceModal';
import { CargoOverlayProvider } from '../context/CargoOverlayContext';
import { RunStatusOverlayProvider } from '../context/RunStatusOverlayContext';
import { useCombatTurnOptional } from '../context/CombatTurnContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import type { CargoItemId } from '../types/cargoGrid';
import type { RunItemId, RunItemOfferResolution } from '../types/runItem';
import type { IncursionConsumableUseResult } from '../types/incursionInventory';
import type { RunItemActiveContext } from '../data/runItemUseEngine';
import { hasFieldRunItem } from '../data/runItemFieldEngine';

interface IncursionRunLayoutProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /**
   * When set (combat), consumable effects apply to the live combat hub instead of run state.
   * Omit on scanner, narrative, boon, and sanctuary screens.
   */
  onConsumableUsed?: (result: IncursionConsumableUseResult) => void;
  /** Combat-only: validates turn/AP, consumes cargo, then applies via onConsumableUsed. */
  onDeployCargoItem?: (itemId: CargoItemId) => boolean;
  /** Hide floating STATUS / CARGO chrome; embedded controls may still use overlay context. */
  hideRunChrome?: boolean;
}

/**
 * Full-viewport run shell — cargo/status overlays only. Macro log is combat-dashboard-only.
 */
export default function IncursionRunLayout({
  children,
  style,
  onConsumableUsed,
  onDeployCargoItem,
  hideRunChrome = false,
}: IncursionRunLayoutProps): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    appendRunLog,
    useIncursionConsumable,
    applyIncursionConsumableHeal,
    relocateCargoItem,
    replaceCargoItem,
    discardCargoInstance,
    useFocusingAmpouleFromCargo,
    useResonanceBribeFromCargo,
    useDeadDropTokenFromCargo,
    useAshSealFromFieldTools,
    useContainmentFoamFromFieldTools,
    resolvePendingRunItemOffer,
  } = useRun();
  const [cargoOpen, setCargoOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const combatTurn = useCombatTurnOptional();
  const cargoEnabled = combatTurn?.canUseCargo ?? true;
  const combatMode = onConsumableUsed != null;

  useEffect(() => {
    if (!cargoEnabled && cargoOpen) {
      setCargoOpen(false);
    }
  }, [cargoEnabled, cargoOpen]);

  // Include debug/sandbox combats so CARGO / STATUS / ITEMS match regular arenas.
  const showRunOverlays = useMemo(
    () => runState.runActive && activeIncursion.isRunActive,
    [activeIncursion.isRunActive, runState.runActive],
  );

  const handleUseCombatConsumable = useCallback((itemId: CargoItemId) => {
    if (!cargoEnabled) return false;
    if (onDeployCargoItem) {
      const ok = onDeployCargoItem(itemId);
      if (ok) setCargoOpen(false);
      return ok;
    }
    const result = useIncursionConsumable(itemId);
    if (!result) return false;
    if (onConsumableUsed) {
      onConsumableUsed(result);
    } else if (result.healAmount > 0) {
      applyIncursionConsumableHeal(result.healAmount);
    }
    appendRunLog(result.logLine);
    setCargoOpen(false);
    return true;
  }, [
    appendRunLog,
    applyIncursionConsumableHeal,
    cargoEnabled,
    onConsumableUsed,
    onDeployCargoItem,
    useIncursionConsumable,
  ]);

  const openCargo = useCallback(() => {
    if (!cargoEnabled || !showRunOverlays) return;
    pulseCargoOpen();
    setCargoOpen(true);
  }, [cargoEnabled, showRunOverlays]);

  const closeCargo = useCallback(() => {
    pulseCargoClose();
    setCargoOpen(false);
  }, []);

  const dismissCargoSilently = useCallback(() => {
    setCargoOpen(false);
  }, []);

  const openStatus = useCallback(() => {
    if (!showRunOverlays) return;
    pulseStatusOpen();
    setStatusOpen(true);
  }, [showRunOverlays]);

  const closeStatus = useCallback(() => {
    pulseStatusDismiss();
    setStatusOpen(false);
  }, []);

  const cargoOverlayValue = useMemo(
    () => ({ openCargo, cargoEnabled: showRunOverlays && cargoEnabled }),
    [cargoEnabled, openCargo, showRunOverlays],
  );

  const statusOverlayValue = useMemo(
    () => ({ openStatus, statusEnabled: showRunOverlays }),
    [openStatus, showRunOverlays],
  );

  const specialCargoStacks = useMemo(
    () => resolveSpecialCargoStacksForIncursion(activeIncursion),
    [activeIncursion],
  );

  const runItemActiveContext = useMemo((): RunItemActiveContext => {
    if (combatMode) return 'COMBAT';
    if (activeIncursion.mapMode === 'SCANNING_HUB') return 'SCANNER';
    return 'UNKNOWN';
  }, [activeIncursion.mapMode, combatMode]);

  const handleUseRunItemFromSlot = useCallback((itemId: RunItemId) => {
    if (!cargoEnabled && combatMode) return false;
    if (onDeployCargoItem) {
      return onDeployCargoItem(itemId as CargoItemId);
    }
    const result = useIncursionConsumable(itemId as CargoItemId);
    if (!result) return false;
    if (onConsumableUsed) {
      onConsumableUsed(result);
    } else if (result.healAmount > 0) {
      applyIncursionConsumableHeal(result.healAmount);
    }
    appendRunLog(result.logLine);
    return true;
  }, [
    appendRunLog,
    applyIncursionConsumableHeal,
    cargoEnabled,
    combatMode,
    onConsumableUsed,
    onDeployCargoItem,
    useIncursionConsumable,
  ]);

  const handleResolveRunItemOffer = useCallback((
    resolution: RunItemOfferResolution,
    cargoInstanceId?: string,
  ) => {
    const resolved = resolvePendingRunItemOffer(resolution, cargoInstanceId);
    appendRunLog(resolved.logLine);
    if (resolved.usedNow && resolved.itemId && runItemActiveContext === 'COMBAT') {
      handleUseRunItemFromSlot(resolved.itemId);
    }
  }, [
    appendRunLog,
    handleUseRunItemFromSlot,
    resolvePendingRunItemOffer,
    runItemActiveContext,
  ]);

  const fieldDeadDropAvailable = hasFieldRunItem(activeIncursion.cargo, 'dead-drop-token');
  const fieldAshSealAvailable = hasFieldRunItem(activeIncursion.cargo, 'ash-seal-canister')
    && activeIncursion.supplyRuntime.ashSeal == null;
  const fieldFoamAvailable = hasFieldRunItem(activeIncursion.cargo, 'containment-foam')
    && activeIncursion.supplyRuntime.foamedCargoInstanceId == null;

  return (
    <CargoOverlayProvider value={cargoOverlayValue}>
      <RunStatusOverlayProvider value={statusOverlayValue}>
        <View style={[styles.root, style]}>
          <View style={styles.content}>
            {children}
            {showRunOverlays ? <DepthIdentityToast /> : null}
            {showRunOverlays ? <KeepsakeTriggerToast /> : null}
            {showRunOverlays ? <RunItemTriggerToast /> : null}
            {showRunOverlays && !hideRunChrome ? (
              <RunGlobalChrome terminal={combatMode} />
            ) : null}
          </View>

          {showRunOverlays ? (
            <CargoGridOverlay
              visible={cargoOpen}
              cargo={activeIncursion.cargo}
              specialCargoStacks={specialCargoStacks}
              theme={theme}
              onClose={closeCargo}
              onDismissSilently={dismissCargoSilently}
              onRelocateItem={relocateCargoItem}
              onReplaceItem={replaceCargoItem}
              onDiscardItem={discardCargoInstance}
              runCredits={activeIncursion.runCredits}
              playerActionPoints={combatTurn?.playerActionPoints}
              scannerMode={!combatMode}
              combatMode={combatMode}
              combatConsumablesEnabled={cargoEnabled}
              onUseAmpoule={!combatMode ? useFocusingAmpouleFromCargo : undefined}
              onUseResonanceBribe={!combatMode ? useResonanceBribeFromCargo : undefined}
              onUseDeadDrop={!combatMode ? useDeadDropTokenFromCargo : undefined}
              showDeadDropFieldTool={!combatMode && fieldDeadDropAvailable}
              onUseAshSeal={!combatMode && fieldAshSealAvailable ? useAshSealFromFieldTools : undefined}
              onUseContainmentFoam={!combatMode && fieldFoamAvailable ? useContainmentFoamFromFieldTools : undefined}
              onUseCombatConsumable={combatMode ? handleUseCombatConsumable : undefined}
            />
          ) : null}

          {showRunOverlays ? (
            <RunStatusOverlay
              visible={statusOpen}
              theme={theme}
              onClose={closeStatus}
              combatMode={combatMode}
            />
          ) : null}

          {showRunOverlays ? (
            <RunItemSlotChoiceModal
              visible={activeIncursion.supplyRuntime.pendingOffer != null}
              offer={activeIncursion.supplyRuntime.pendingOffer}
              cargo={activeIncursion.cargo}
              accentColor={theme.statusColor}
              mutedColor={theme.mutedColor}
              activeContext={runItemActiveContext}
              onResolve={handleResolveRunItemOffer}
            />
          ) : null}
        </View>
      </RunStatusOverlayProvider>
    </CargoOverlayProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
});
