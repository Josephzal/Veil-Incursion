import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import CargoGridOverlay from './CargoGridOverlay';
import PersistentTerminalLog from './PersistentTerminalLog';
import RunStatusOverlay from './RunStatusOverlay';
import { CargoOverlayProvider } from '../context/CargoOverlayContext';
import { RunStatusOverlayProvider } from '../context/RunStatusOverlayContext';
import { useCombatTurnOptional } from '../context/CombatTurnContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import type { CargoItemId } from '../types/cargoGrid';
import type { IncursionConsumableUseResult } from '../types/incursionInventory';

interface MacroLogAnchoredLayoutProps {
  children: React.ReactNode;
  showMacroLog?: boolean;
  style?: ViewStyle;
  /**
   * When set (combat), consumable effects apply to the live combat hub instead of run state.
   * Omit on scanner, narrative, boon, and sanctuary screens.
   */
  onConsumableUsed?: (result: IncursionConsumableUseResult) => void;
  /** Combat-only: validates turn/AP, consumes cargo, then applies via onConsumableUsed. */
  onDeployCargoItem?: (itemId: CargoItemId) => boolean;
}

/**
 * Strict two-zone column: scrollable/flex content above, macro log pinned to screen baseline.
 * Use inside IncursionShell for combat, scanner, narrative, boon, and sanctuary screens.
 */
export default function MacroLogAnchoredLayout({
  children,
  showMacroLog = true,
  style,
  onConsumableUsed,
  onDeployCargoItem,
}: MacroLogAnchoredLayoutProps): React.JSX.Element {
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
    setCargoOpen(true);
  }, [cargoEnabled, showRunOverlays]);

  const openStatus = useCallback(() => {
    if (!showRunOverlays) return;
    setStatusOpen(true);
  }, [showRunOverlays]);

  const cargoOverlayValue = useMemo(
    () => ({ openCargo, cargoEnabled: showRunOverlays && cargoEnabled }),
    [cargoEnabled, openCargo, showRunOverlays],
  );

  const statusOverlayValue = useMemo(
    () => ({ openStatus, statusEnabled: showRunOverlays }),
    [openStatus, showRunOverlays],
  );

  return (
    <CargoOverlayProvider value={cargoOverlayValue}>
    <RunStatusOverlayProvider value={statusOverlayValue}>
      <View style={[styles.root, style]}>
        <View style={styles.content}>{children}</View>
        {showMacroLog ? (
          <PersistentTerminalLog
            docked
            showCargo={showRunOverlays}
            cargoDisabled={showRunOverlays && combatMode && !cargoEnabled}
            onCargoPress={openCargo}
            showStatus={showRunOverlays}
            onStatusPress={openStatus}
          />
        ) : null}

        {showRunOverlays ? (
          <CargoGridOverlay
            visible={cargoOpen}
            cargo={activeIncursion.cargo}
            theme={theme}
            onClose={() => setCargoOpen(false)}
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
            onClose={() => setStatusOpen(false)}
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
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
});
