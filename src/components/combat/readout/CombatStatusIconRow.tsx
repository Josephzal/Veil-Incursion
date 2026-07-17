import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import {
  INTEL_STATUS_CHIP_SIZE,
  type IntelStatusChip,
} from '../../../utils/enemyStatusEffects';
import {
  COMBAT_POPUP_BODY_FONT,
  COMBAT_POPUP_SCALE,
} from '../../../constants/combatOverlayTypography';

const MONO = 'monospace';
const VIOLET = '#a78bfa';
const TOOLTIP_BG = 'rgba(12, 8, 22, 0.96)';
const TOOLTIP_BORDER = '#8b5cf6';
const TOOLTIP_DISMISS_MS = 4000;

interface CombatStatusIconRowProps {
  chips: readonly IntelStatusChip[];
  /** @deprecated All chips use INTEL_STATUS_CHIP_SIZE for consistency. */
  iconSize?: number;
}

/** Uniform small-square status chips with press tooltips for tactical intel. */
export default function CombatStatusIconRow({
  chips,
}: CombatStatusIconRowProps): React.JSX.Element | null {
  const [selected, setSelected] = useState<IntelStatusChip | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipSize = INTEL_STATUS_CHIP_SIZE;
  const tooltipMinWidth = Math.round(180 * COMBAT_POPUP_SCALE);
  const tooltipMaxWidth = Math.round(300 * COMBAT_POPUP_SCALE);
  const tooltipPaddingH = Math.round(12 * COMBAT_POPUP_SCALE);
  const tooltipPaddingV = Math.round(10 * COMBAT_POPUP_SCALE);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current != null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismissTooltip = useCallback(() => {
    clearDismissTimer();
    setSelected(null);
  }, [clearDismissTimer]);

  const showTooltip = useCallback((chip: IntelStatusChip) => {
    clearDismissTimer();
    setSelected(chip);
    dismissTimerRef.current = setTimeout(() => {
      dismissTimerRef.current = null;
      setSelected(null);
    }, TOOLTIP_DISMISS_MS);
  }, [clearDismissTimer]);

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  useEffect(() => {
    if (selected && !chips.some((chip) => chip.id === selected.id)) {
      dismissTooltip();
    }
  }, [chips, dismissTooltip, selected]);

  if (chips.length === 0) return null;

  return (
    <View style={[styles.root, { minHeight: chipSize }]}>
      <Modal
        visible={selected != null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismissTooltip}
      >
        <View style={styles.backdrop}>
          <HapticPressable
            style={styles.backdropTap}
            onPress={dismissTooltip}
            accessibilityRole="button"
            accessibilityLabel="Dismiss status tooltip"
          />
          {selected ? (
            <View
              style={[
                styles.tooltip,
                {
                  minWidth: tooltipMinWidth,
                  maxWidth: tooltipMaxWidth,
                  paddingHorizontal: tooltipPaddingH,
                  paddingVertical: tooltipPaddingV,
                },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.tooltipTitle}>{`[ ${selected.label.toUpperCase()} ]`}</Text>
              <Text style={styles.tooltipBody}>{selected.description}</Text>
              <Text style={styles.tooltipHint}>TAP TO DISMISS</Text>
            </View>
          ) : null}
        </View>
      </Modal>

      <View style={styles.iconRow}>
        {chips.map((chip) => {
          const isSelected = selected?.id === chip.id;
          return (
            <HapticPressable
              key={chip.id}
              onPress={() => showTooltip(chip)}
              style={[
                styles.iconButton,
                { width: chipSize, height: chipSize },
                isSelected ? styles.iconButtonSelected : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${chip.label}: ${chip.description}`}
            >
              {chip.icon ? (
                <Image
                  source={chip.icon}
                  style={{ width: chipSize - 4, height: chipSize - 4 }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.abbr} numberOfLines={1}>
                  {chip.abbr}
                </Text>
              )}
            </HapticPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  backdrop: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdropTap: {
    ...StyleSheet.absoluteFill,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    zIndex: 22,
  },
  iconButton: {
    borderWidth: 1,
    borderColor: 'rgba(196, 167, 255, 0.72)',
    backgroundColor: '#1c1030',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSelected: {
    borderColor: '#ddd6fe',
    backgroundColor: '#4c1d95',
  },
  abbr: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#ddd6fe',
  },
  tooltip: {
    backgroundColor: TOOLTIP_BG,
    borderWidth: 1,
    borderColor: TOOLTIP_BORDER,
    zIndex: 2,
    gap: 6,
  },
  tooltipTitle: {
    fontFamily: MONO,
    fontSize: COMBAT_POPUP_BODY_FONT + 1,
    fontWeight: '800',
    letterSpacing: 0.5,
    lineHeight: COMBAT_POPUP_BODY_FONT + 5,
    color: VIOLET,
  },
  tooltipBody: {
    fontFamily: MONO,
    fontSize: COMBAT_POPUP_BODY_FONT,
    fontWeight: '600',
    letterSpacing: 0.35,
    lineHeight: COMBAT_POPUP_BODY_FONT + 5,
    color: '#c4b5fd',
  },
  tooltipHint: {
    fontFamily: MONO,
    fontSize: COMBAT_POPUP_BODY_FONT - 1,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: 'rgba(196, 181, 253, 0.55)',
    marginTop: 2,
  },
});
