import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import HapticPressable from './HapticPressable';
import CargoGridBoard from './CargoGridBoard';
import CargoCreditsHud from './CargoCreditsHud';
import {
  cargoOverlayFrameWidth,
  CARGO_OVERLAY_PANEL_PADDING,
  resolveCargoOverlayCellSize,
} from '../constants/cargoOverlayLayout';
import { useLandscapeMetrics } from '../hooks/useLandscapeMetrics';
import { countCargoItemInstances } from '../data/cargoGridEngine';
import type { CargoRunState } from '../types/cargoGrid';
import type { CargoItemId } from '../types/cargoGrid';
import type { TerminalTheme } from '../types/theme';

const TERMINAL_ACCENT = '#00ff33';

interface CargoGridOverlayProps {
  visible: boolean;
  cargo: CargoRunState;
  theme: TerminalTheme;
  accentColor?: string;
  onClose: () => void;
  /** Closes without exit haptic — e.g. after a successful item use. */
  onDismissSilently?: () => void;
  onRelocateItem: (instanceId: string, row: number, col: number) => boolean;
  onUseAmpoule?: () => boolean;
  scannerMode?: boolean;
  combatMode?: boolean;
  combatConsumablesEnabled?: boolean;
  onUseCombatConsumable?: (itemId: CargoItemId) => boolean;
  onUseResonanceBribe?: () => boolean;
  onUseDeadDrop?: () => boolean;
  onDiscardItem?: (instanceId: string) => boolean;
  runCredits?: number;
  playerActionPoints?: number;
}

export default function CargoGridOverlay({
  visible,
  cargo,
  theme,
  accentColor = TERMINAL_ACCENT,
  onClose,
  onDismissSilently,
  onRelocateItem,
  onUseAmpoule,
  scannerMode = false,
  combatMode = false,
  combatConsumablesEnabled = true,
  onUseCombatConsumable,
  onUseResonanceBribe,
  onUseDeadDrop,
  onDiscardItem,
  runCredits,
  playerActionPoints,
}: CargoGridOverlayProps): React.JSX.Element {
  const dismissAfterUse = onDismissSilently ?? onClose;
  const { height: screenHeight } = useWindowDimensions();
  const { safeBottom } = useLandscapeMetrics();

  const scannerButtonCount = useMemo(() => {
    if (!scannerMode) return 0;
    let count = 0;
    if (onUseAmpoule && countCargoItemInstances(cargo, 'focusing-ampoule') > 0) count += 1;
    if (onUseResonanceBribe && countCargoItemInstances(cargo, 'resonance-bribe') > 0) count += 1;
    if (onUseDeadDrop && countCargoItemInstances(cargo, 'dead-drop-token') > 0) count += 1;
    return count;
  }, [cargo, onUseAmpoule, onUseDeadDrop, onUseResonanceBribe, scannerMode]);

  const cellSize = useMemo(
    () => resolveCargoOverlayCellSize(screenHeight, safeBottom, {
      combatMode,
      hasContainment: cargo.containment.length > 0,
      scannerButtonCount,
    }),
    [cargo.containment.length, combatMode, safeBottom, scannerButtonCount, screenHeight],
  );

  const frameWidth = useMemo(() => cargoOverlayFrameWidth(cellSize), [cellSize]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <HapticPressable style={styles.backdrop} onPress={onClose}>
        <HapticPressable
          style={[
            styles.panel,
            {
              borderColor: accentColor,
              maxWidth: frameWidth + CARGO_OVERLAY_PANEL_PADDING * 2 + 4,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <HapticPressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeX,
              { borderColor: accentColor, opacity: pressed ? 0.7 : 1 },
            ]}
            hitSlop={8}
          >
            <Text style={[styles.closeXText, { color: accentColor }]}>✕</Text>
          </HapticPressable>

          <CargoCreditsHud
            credits={runCredits ?? 0}
            accentColor={accentColor}
            style={styles.panelCredits}
          />

          <CargoGridBoard
            cargo={cargo}
            theme={theme}
            accentColor={accentColor}
            onRelocateItem={onRelocateItem}
            onDiscardItem={onDiscardItem}
            runCredits={runCredits}
            playerActionPoints={playerActionPoints}
            showCreditsHud={false}
            scannerMode={scannerMode}
            combatMode={combatMode}
            combatConsumablesEnabled={combatConsumablesEnabled}
            overlayCompact
            minimal
            cellSize={cellSize}
            onUseAmpoule={onUseAmpoule ? () => {
              const ok = onUseAmpoule();
              if (ok) dismissAfterUse();
              return ok;
            } : undefined}
            onUseResonanceBribe={onUseResonanceBribe ? () => {
              const ok = onUseResonanceBribe();
              if (ok) dismissAfterUse();
              return ok;
            } : undefined}
            onUseDeadDrop={onUseDeadDrop ? () => {
              const ok = onUseDeadDrop();
              if (ok) dismissAfterUse();
              return ok;
            } : undefined}
            onUseCombatConsumable={onUseCombatConsumable ? (itemId) => {
              const ok = onUseCombatConsumable(itemId);
              if (ok) dismissAfterUse();
              return ok;
            } : undefined}
          />
        </HapticPressable>
      </HapticPressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  panel: {
    borderWidth: 2,
    backgroundColor: '#050608',
    padding: CARGO_OVERLAY_PANEL_PADDING,
    paddingTop: 36,
    gap: 8,
    alignItems: 'center',
    width: '100%',
    position: 'relative',
  },
  closeX: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0b0f',
    zIndex: 10,
  },
  panelCredits: {
    position: 'absolute',
    top: 12,
    left: 14,
    zIndex: 10,
  },
  closeXText: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
});
