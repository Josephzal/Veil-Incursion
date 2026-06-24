import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import {
  ENEMY_STATUS_EFFECTS,
  type EnemyStatusEffectDef,
  type EnemyStatusEffectKey,
} from '../../../utils/enemyStatusEffects';

const MONO = 'monospace';
const VIOLET = '#a78bfa';
const VIOLET_DIM = '#7c6bb0';
const TOOLTIP_BG = 'rgba(12, 8, 22, 0.96)';
const TOOLTIP_BORDER = '#8b5cf6';
const ICON_SIZE = 18;
const TOOLTIP_DISMISS_MS = 3000;

interface CombatStatusIconRowProps {
  statusKeys: readonly EnemyStatusEffectKey[];
}

/** Icon-only status row with press tooltips for the intel stat block. */
export default function CombatStatusIconRow({
  statusKeys,
}: CombatStatusIconRowProps): React.JSX.Element | null {
  const [tooltipContent, setTooltipContent] = useState<EnemyStatusEffectDef | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current != null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismissTooltip = useCallback(() => {
    clearDismissTimer();
    setTooltipContent(null);
  }, [clearDismissTimer]);

  const showTooltip = useCallback((def: EnemyStatusEffectDef) => {
    clearDismissTimer();
    setTooltipContent(def);
    dismissTimerRef.current = setTimeout(() => {
      dismissTimerRef.current = null;
      setTooltipContent(null);
    }, TOOLTIP_DISMISS_MS);
  }, [clearDismissTimer]);

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  useEffect(() => {
    if (tooltipContent && !statusKeys.includes(tooltipContent.key)) {
      dismissTooltip();
    }
  }, [dismissTooltip, statusKeys, tooltipContent]);

  if (statusKeys.length === 0) return null;

  return (
    <View style={styles.root}>
      <Modal
        visible={tooltipContent != null}
        transparent
        animationType="fade"
        onRequestClose={dismissTooltip}
      >
        <HapticPressable
          style={styles.modalBody}
          onPress={dismissTooltip}
          accessibilityRole="button"
          accessibilityLabel="Dismiss status tooltip"
        >
          {tooltipContent ? (
            <View style={styles.tooltip} pointerEvents="none">
              <Text style={styles.tooltipHeader}>{`[ ${tooltipContent.label} ]`}</Text>
              <Text style={styles.tooltipBody}>{tooltipContent.description}</Text>
            </View>
          ) : null}
        </HapticPressable>
      </Modal>

      <View style={styles.iconRow}>
        {statusKeys.map((key) => {
          const def = ENEMY_STATUS_EFFECTS[key];
          const selected = tooltipContent?.key === key;
          return (
            <HapticPressable
              key={key}
              onPress={() => showTooltip(def)}
              style={[styles.iconButton, selected ? styles.iconButtonSelected : null]}
              accessibilityRole="button"
              accessibilityLabel={def.label}
            >
              <Image source={def.icon} style={styles.icon} resizeMode="contain" />
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
    minHeight: ICON_SIZE,
  },
  modalBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 22,
  },
  iconButton: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderWidth: 1,
    borderColor: 'rgba(196, 167, 255, 0.72)',
    backgroundColor: 'rgba(28, 16, 48, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSelected: {
    borderColor: '#ddd6fe',
    backgroundColor: 'rgba(124, 58, 237, 0.55)',
  },
  icon: {
    width: ICON_SIZE - 2,
    height: ICON_SIZE - 2,
  },
  tooltip: {
    minWidth: 160,
    maxWidth: 280,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: TOOLTIP_BG,
    borderWidth: 1,
    borderColor: TOOLTIP_BORDER,
  },
  tooltipHeader: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 10,
    color: VIOLET,
    marginBottom: 4,
  },
  tooltipBody: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.3,
    lineHeight: 9,
    color: VIOLET_DIM,
  },
});
