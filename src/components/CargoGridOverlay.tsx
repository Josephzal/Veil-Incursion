import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import CargoGridBoard from './CargoGridBoard';
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.panel, { borderColor: accentColor }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeX,
              { borderColor: accentColor, opacity: pressed ? 0.7 : 1 },
            ]}
            hitSlop={8}
          >
            <Text style={[styles.closeXText, { color: accentColor }]}>✕</Text>
          </Pressable>

          <CargoGridBoard
            cargo={cargo}
            theme={theme}
            accentColor={accentColor}
            onRelocateItem={onRelocateItem}
            onDiscardItem={onDiscardItem}
            runCredits={runCredits}
            playerActionPoints={playerActionPoints}
            scannerMode={scannerMode}
            combatMode={combatMode}
            combatConsumablesEnabled={combatConsumablesEnabled}
            minimal
            onUseAmpoule={onUseAmpoule ? () => {
              const ok = onUseAmpoule();
              if (ok) onClose();
              return ok;
            } : undefined}
            onUseResonanceBribe={onUseResonanceBribe ? () => {
              const ok = onUseResonanceBribe();
              if (ok) onClose();
              return ok;
            } : undefined}
            onUseDeadDrop={onUseDeadDrop ? () => {
              const ok = onUseDeadDrop();
              if (ok) onClose();
              return ok;
            } : undefined}
            onUseCombatConsumable={onUseCombatConsumable ? (itemId) => {
              const ok = onUseCombatConsumable(itemId);
              if (ok) onClose();
              return ok;
            } : undefined}
          />
        </Pressable>
      </Pressable>
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
    padding: 14,
    paddingTop: 36,
    gap: 10,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
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
  closeXText: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
});
