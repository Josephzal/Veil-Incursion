import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import IncursionInventoryOverlay from './IncursionInventoryOverlay';
import PersistentTerminalLog from './PersistentTerminalLog';
import { useCombatTurnOptional } from '../context/CombatTurnContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import type { IncursionConsumableId } from '../types/incursionInventory';

interface MacroLogAnchoredLayoutProps {
  children: React.ReactNode;
  showMacroLog?: boolean;
  style?: ViewStyle;
  /**
   * When set (combat), consumable heals apply to the live combat hub instead of run state.
   * Omit on scanner, narrative, boon, and sanctuary screens.
   */
  onConsumableHeal?: (amount: number) => void;
}

/**
 * Strict two-zone column: scrollable/flex content above, macro log pinned to screen baseline.
 * Use inside IncursionShell for combat, scanner, narrative, boon, and sanctuary screens.
 */
export default function MacroLogAnchoredLayout({
  children,
  showMacroLog = true,
  style,
  onConsumableHeal,
}: MacroLogAnchoredLayoutProps): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    appendRunLog,
    useIncursionConsumable,
    applyIncursionConsumableHeal,
  } = useRun();
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const combatTurn = useCombatTurnOptional();
  const inventoryEnabled = combatTurn?.canUseInventory ?? true;

  useEffect(() => {
    if (!inventoryEnabled && inventoryOpen) {
      setInventoryOpen(false);
    }
  }, [inventoryEnabled, inventoryOpen]);

  const showIncursionInventory = useMemo(
    () => runState.runActive && activeIncursion.isRunActive && runState.combatTestPreset == null,
    [activeIncursion.isRunActive, runState.combatTestPreset, runState.runActive],
  );

  const handleUseConsumable = useCallback((itemId: IncursionConsumableId) => {
    if (!inventoryEnabled) return;
    const result = useIncursionConsumable(itemId);
    if (!result) return;
    if (onConsumableHeal) {
      onConsumableHeal(result.healAmount);
    } else {
      applyIncursionConsumableHeal(result.healAmount);
    }
    appendRunLog(result.logLine);
    setInventoryOpen(false);
  }, [appendRunLog, applyIncursionConsumableHeal, inventoryEnabled, onConsumableHeal, useIncursionConsumable]);

  const handleInventoryPress = useCallback(() => {
    if (!inventoryEnabled) return;
    setInventoryOpen(true);
  }, [inventoryEnabled]);

  return (
    <View style={[styles.root, style]}>
      <View style={styles.content}>{children}</View>
      {showMacroLog ? (
        <PersistentTerminalLog
          docked
          showInventory={showIncursionInventory}
          inventoryDisabled={showIncursionInventory && onConsumableHeal != null && !inventoryEnabled}
          onInventoryPress={handleInventoryPress}
        />
      ) : null}

      <IncursionInventoryOverlay
        visible={inventoryOpen}
        items={activeIncursion.inventory.items}
        theme={theme}
        onClose={() => setInventoryOpen(false)}
        onUse={handleUseConsumable}
      />
    </View>
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
