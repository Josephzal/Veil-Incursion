import React, { useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import HapticPressable from './HapticPressable';
import CargoGridBoard from './CargoGridBoard';
import CargoCreditsHud from './CargoCreditsHud';
import CargoPressurePanel from './CargoPressurePanel';
import {
  CARGO_OVERLAY_PANEL_PADDING,
  COMBAT_OVERLAY_PANEL_PADDING,
  resolveCargoOverlayCellSize,
  resolveCombatOverlayCellSize,
  resolveCombatOverlayContentWidth,
  resolveOverlayPanelWidth,
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
  /** Field-slot dead-drop (no cargo-grid token required). */
  showDeadDropFieldTool?: boolean;
  onUseAshSeal?: () => boolean;
  onUseContainmentFoam?: () => boolean;
  onDiscardItem?: (instanceId: string) => boolean;
  runCredits?: number;
  playerActionPoints?: number;
  specialCargoStacks?: number;
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
  showDeadDropFieldTool = false,
  onUseAshSeal,
  onUseContainmentFoam,
  onDiscardItem,
  runCredits,
  playerActionPoints,
  specialCargoStacks = 0,
}: CargoGridOverlayProps): React.JSX.Element {
  const dismissAfterUse = onDismissSilently ?? onClose;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { safeBottom } = useLandscapeMetrics();

  const scannerButtonCount = useMemo(() => {
    if (!scannerMode) return 0;
    let count = 0;
    if (onUseAmpoule && countCargoItemInstances(cargo, 'focusing-ampoule') > 0) count += 1;
    if (onUseResonanceBribe && countCargoItemInstances(cargo, 'resonance-bribe') > 0) count += 1;
    if (onUseDeadDrop && (showDeadDropFieldTool || countCargoItemInstances(cargo, 'dead-drop-token') > 0)) count += 1;
    if (onUseAshSeal) count += 1;
    if (onUseContainmentFoam) count += 1;
    return count;
  }, [cargo, onUseAmpoule, onUseAshSeal, onUseContainmentFoam, onUseDeadDrop, onUseResonanceBribe, scannerMode, showDeadDropFieldTool]);

  const cellSize = useMemo(() => {
    if (combatMode) {
      return resolveCombatOverlayCellSize(screenHeight, safeBottom);
    }
    return resolveCargoOverlayCellSize(screenHeight, screenWidth, safeBottom, {
      hasContainment: cargo.containment.length > 0,
      scannerButtonCount,
    });
  }, [
    cargo.containment.length,
    combatMode,
    safeBottom,
    scannerButtonCount,
    screenHeight,
    screenWidth,
  ]);

  const panelPadding = combatMode ? COMBAT_OVERLAY_PANEL_PADDING : CARGO_OVERLAY_PANEL_PADDING;

  const panelWidth = useMemo(
    () => resolveOverlayPanelWidth(screenWidth, cellSize, combatMode),
    [cellSize, combatMode, screenWidth],
  );

  const contentWidth = combatMode
    ? resolveCombatOverlayContentWidth(cellSize)
    : panelWidth - panelPadding * 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <HapticPressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close cargo overlay"
        />

        <View style={styles.panelHost} pointerEvents="box-none">
          <View
            style={[
              styles.panel,
              {
                borderColor: accentColor,
                width: panelWidth,
                maxWidth: screenWidth - 12,
                paddingHorizontal: panelPadding,
                paddingBottom: panelPadding,
              },
            ]}
          >
            <View style={styles.panelHeader}>
              <CargoCreditsHud
                credits={runCredits ?? 0}
                accentColor={accentColor}
              />
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
            </View>

            <CargoPressurePanel
              cargo={cargo}
              specialCargoStacks={specialCargoStacks}
              accentColor={accentColor}
              mutedColor={theme.mutedColor}
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
              overlayCompact={combatMode}
              overlayCombatSplit={combatMode}
              contentWidth={contentWidth}
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
              showDeadDropFieldTool={showDeadDropFieldTool}
              onUseAshSeal={onUseAshSeal ? () => {
                const ok = onUseAshSeal();
                if (ok) dismissAfterUse();
                return ok;
              } : undefined}
              onUseContainmentFoam={onUseContainmentFoam ? () => {
                const ok = onUseContainmentFoam();
                if (ok) dismissAfterUse();
                return ok;
              } : undefined}
              onUseCombatConsumable={onUseCombatConsumable ? (itemId) => {
                const ok = onUseCombatConsumable(itemId);
                if (ok) dismissAfterUse();
                return ok;
              } : undefined}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.86)',
  },
  panelHost: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  panel: {
    borderWidth: 2,
    backgroundColor: '#050608',
    paddingBottom: CARGO_OVERLAY_PANEL_PADDING,
    gap: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
    paddingTop: 8,
    paddingBottom: 4,
    flexShrink: 0,
  },
  closeX: {
    width: 28,
    height: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0b0f',
    marginLeft: 8,
  },
  closeXText: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
});
