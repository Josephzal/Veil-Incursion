import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { pulseCargoClose, pulseCargoOpen, pulseStatusDismiss, pulseStatusOpen } from '../utils/hubButtonHaptics';
import { StyleSheet, View, ViewStyle } from 'react-native';
import CargoGridOverlay from './CargoGridOverlay';
import RunGlobalChrome from './RunGlobalChrome';
import RunStatusOverlay from './RunStatusOverlay';
import { CargoOverlayProvider } from '../context/CargoOverlayContext';
import { RunStatusOverlayProvider } from '../context/RunStatusOverlayContext';
import { useCombatTurnOptional } from '../context/CombatTurnContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import type { CargoItemId } from '../types/cargoGrid';
import type { IncursionConsumableUseResult } from '../types/incursionInventory';

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
  /** Hide floating STATUS / CARGO chrome (e.g. harvest screen has its own layout). */
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
    discardCargoInstance,
    useFocusingAmpouleFromCargo,
    useResonanceBribeFromCargo,
    useDeadDropTokenFromCargo,
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

  const showRunOverlays = useMemo(
    () => runState.runActive && activeIncursion.isRunActive && runState.combatTestPreset == null,
    [activeIncursion.isRunActive, runState.combatTestPreset, runState.runActive],
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
    () => ({ openCargo, cargoEnabled: showRunOverlays && cargoEnabled && !hideRunChrome }),
    [cargoEnabled, hideRunChrome, openCargo, showRunOverlays],
  );

  const statusOverlayValue = useMemo(
    () => ({ openStatus, statusEnabled: showRunOverlays && !hideRunChrome }),
    [hideRunChrome, openStatus, showRunOverlays],
  );

  return (
    <CargoOverlayProvider value={cargoOverlayValue}>
      <RunStatusOverlayProvider value={statusOverlayValue}>
        <View style={[styles.root, style]}>
          <View style={styles.content}>
            {children}
            {showRunOverlays && !combatMode && !hideRunChrome ? <RunGlobalChrome /> : null}
          </View>

          {showRunOverlays ? (
            <CargoGridOverlay
              visible={cargoOpen}
              cargo={activeIncursion.cargo}
              theme={theme}
              onClose={closeCargo}
              onDismissSilently={dismissCargoSilently}
              onRelocateItem={relocateCargoItem}
              onDiscardItem={discardCargoInstance}
              runCredits={activeIncursion.runCredits}
              playerActionPoints={combatTurn?.playerActionPoints}
              scannerMode={!combatMode}
              combatMode={combatMode}
              combatConsumablesEnabled={cargoEnabled}
              onUseAmpoule={!combatMode ? useFocusingAmpouleFromCargo : undefined}
              onUseResonanceBribe={!combatMode ? useResonanceBribeFromCargo : undefined}
              onUseDeadDrop={!combatMode ? useDeadDropTokenFromCargo : undefined}
              onUseCombatConsumable={combatMode ? handleUseCombatConsumable : undefined}
            />
          ) : null}

          {showRunOverlays ? (
            <RunStatusOverlay
              visible={statusOpen}
              theme={theme}
              onClose={closeStatus}
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
