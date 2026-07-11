import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import HapticPressable from '../HapticPressable';
import type { RunItemId } from '../../types/runItem';
import { getRunItemDefinition } from '../../data/runItemRegistry';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';

interface RunItemSlotChipProps {
  itemId: RunItemId | null;
  label: string;
  accentColor: string;
  mutedColor: string;
  selected?: boolean;
  onPress?: () => void;
  onClear?: () => void;
  compact?: boolean;
}

export default function RunItemSlotChip({
  itemId,
  label,
  accentColor,
  mutedColor,
  selected = false,
  onPress,
  onClear,
  compact = false,
}: RunItemSlotChipProps): React.JSX.Element {
  const def = itemId ? getRunItemDefinition(itemId) : null;
  const borderColor = selected ? accentColor : mutedColor;

  return (
    <HapticPressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        {
          borderColor,
          backgroundColor: itemId ? `${accentColor}12` : 'rgba(0,0,0,0.35)',
          opacity: pressed && onPress ? 0.82 : 1,
        },
      ]}
    >
      <TerminalText variant="caption" style={[styles.slotLabel, { color: mutedColor }]}>
        {label}
      </TerminalText>
      {itemId ? (
        <View style={styles.itemRow}>
          <Image source={resolveCargoItemIcon(itemId)} style={styles.icon} resizeMode="contain" />
          <View style={styles.copy}>
            <TerminalText
              variant="caption"
              numberOfLines={1}
              style={{ color: accentColor, fontWeight: '700' }}
            >
              {def?.shortName.toUpperCase() ?? itemId}
            </TerminalText>
            {onClear ? (
              <HapticPressable onPress={onClear} style={styles.clearBtn}>
                <TerminalText variant="caption" style={{ color: mutedColor, fontSize: 8 }}>
                  [ CLEAR ]
                </TerminalText>
              </HapticPressable>
            ) : null}
          </View>
        </View>
      ) : (
        <TerminalText variant="caption" style={{ color: mutedColor, marginTop: 4 }}>
          EMPTY
        </TerminalText>
      )}
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    padding: 8,
    minHeight: 72,
    gap: 4,
  },
  chipCompact: {
    minHeight: 58,
    padding: 6,
  },
  slotLabel: {
    fontSize: 8,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  icon: {
    width: 28,
    height: 28,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  clearBtn: {
    alignSelf: 'flex-start',
  },
});
