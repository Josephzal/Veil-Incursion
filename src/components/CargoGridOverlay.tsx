import React, { useMemo } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import RunOverlay from './runField/RunOverlay';
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
import { RUN_FIELD } from '../theme/runFieldTokens';

const TERMINAL_ACCENT = RUN_FIELD.mint;
/** Combat cargo modal — matches the run-field chrome language. */
const COMBAT_CARGO_ACCENT = RUN_FIELD.mint;

interface CargoGridOverlayProps {
  visible: boolean;
  cargo: CargoRunState;
  theme: TerminalTheme;
  accentColor?: string;
  onClose: () => void;
  /** Closes without exit haptic — e.g. after a successful item use. */
  onDismissSilently?: () => void;
  onRelocateItem: (instanceId: string, row: number, col: number) => boolean;
  onReplaceItem?: (instanceId: string, row: number, col: number) => boolean;
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
  onReplaceItem,
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
      return resolveCombatOverlayCellSize(screenHeight, safeBottom, screenWidth);
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

  const panelAccent = combatMode ? COMBAT_CARGO_ACCENT : accentColor;
  const overlayMaxWidth = combatMode
    ? Math.min(screenWidth - 32, Math.max(panelWidth, 520))
    : screenWidth - 12;

  return (
    <RunOverlay
      visible={visible}
      title={combatMode ? 'COMBAT CARGO' : 'CARGO MANIFEST'}
      contextLine={combatMode ? 'Field consumables · select then use' : 'Run payload · rearrange or discard'}
      onClose={onClose}
      combatMode={combatMode}
      accentColor={panelAccent}
      width={Math.max(panelWidth, combatMode ? 420 : panelWidth)}
      maxWidth={overlayMaxWidth}
      contentPadding={panelPadding}
      headerAccessory={!combatMode && runCredits != null ? (
        <CargoCreditsHud
          credits={runCredits}
          accentColor={panelAccent}
        />
      ) : undefined}
      bodyStyle={styles.body}
      closeAccessibilityLabel="Close cargo manifest"
    >
      <CargoPressurePanel
        cargo={cargo}
        specialCargoStacks={specialCargoStacks}
        accentColor={panelAccent}
        mutedColor={theme.mutedColor}
      />

      <CargoGridBoard
        cargo={cargo}
        theme={theme}
        accentColor={panelAccent}
        onRelocateItem={onRelocateItem}
        onReplaceItem={onReplaceItem}
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
    </RunOverlay>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 8,
  },
});
