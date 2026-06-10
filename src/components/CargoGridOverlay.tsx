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
}: CargoGridOverlayProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.panel, { borderColor: accentColor }]}
          onPress={(e) => e.stopPropagation()}
        >
          <CargoGridBoard
            cargo={cargo}
            theme={theme}
            accentColor={accentColor}
            onRelocateItem={onRelocateItem}
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
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeBtn,
              { borderColor: accentColor, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={[styles.closeBtnText, { color: accentColor }]}> [ CLOSE ] </Text>
          </Pressable>
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
    gap: 10,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
  },
  closeBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  closeBtnText: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.8,
  },
});
