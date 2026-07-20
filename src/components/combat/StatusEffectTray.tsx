import React, { useCallback, useEffect, useRef } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import {
  ENEMY_STATUS_EFFECTS,
  type EnemyStatusEffectDef,
  type EnemyStatusEffectKey,
} from '../../utils/enemyStatusEffects';

const MONO = 'monospace';
const VIOLET = '#a78bfa';
const VIOLET_DIM = '#7c6bb0';
const TOOLTIP_BG = 'rgba(12, 8, 22, 0.96)';
const TOOLTIP_BORDER = '#8b5cf6';
const ICON_SIZE = 28;
const ICON_GAP = 6;
const TOOLTIP_DISMISS_MS = 3000;

interface StatusEffectTrayProps {
  activeStatuses: readonly EnemyStatusEffectKey[];
  /** When set, parent handles detail UI instead of the built-in tooltip modal. */
  onStatusPress?: (def: EnemyStatusEffectDef) => void;
}

export default function StatusEffectTray({
  activeStatuses,
  onStatusPress,
}: StatusEffectTrayProps): React.JSX.Element | null {
  const [tooltipContent, setTooltipContent] = React.useState<EnemyStatusEffectDef | null>(null);
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
    if (tooltipContent && !activeStatuses.includes(tooltipContent.key)) {
      dismissTooltip();
    }
  }, [activeStatuses, dismissTooltip, tooltipContent]);

  if (activeStatuses.length === 0) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      {onStatusPress ? null : (
        <Modal
          visible={tooltipContent != null}
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
            {tooltipContent ? (
              <View style={styles.tooltip} pointerEvents="none">
                <Text style={styles.tooltipHeader}>{`[ ${tooltipContent.label} ]`}</Text>
                <Text style={styles.tooltipBody}>{tooltipContent.description}</Text>
              </View>
            ) : null}
          </View>
        </Modal>
      )}

      <View style={styles.trayRow}>
        {activeStatuses.map((key) => {
          const def = ENEMY_STATUS_EFFECTS[key];
          const selected = !onStatusPress && tooltipContent?.key === key;
          return (
            <HapticPressable
              key={key}
              onPress={() => (onStatusPress ? onStatusPress(def) : showTooltip(def))}
              style={[styles.iconButton, selected ? styles.iconButtonSelected : null]}
              accessibilityRole="button"
              accessibilityLabel={`${def.label} status`}
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
    alignSelf: 'flex-start',
    marginTop: 4,
    minHeight: ICON_SIZE,
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
    ...StyleSheet.absoluteFillObject,
  },
  trayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: ICON_GAP,
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
    shadowColor: '#c4a7ff',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  iconButtonSelected: {
    borderColor: '#ddd6fe',
    backgroundColor: 'rgba(124, 58, 237, 0.55)',
  },
  icon: {
    width: ICON_SIZE - 2,
    height: ICON_SIZE - 2,
    opacity: 1,
  },
  tooltip: {
    minWidth: 168,
    maxWidth: 220,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: TOOLTIP_BG,
    borderWidth: 1,
    borderColor: TOOLTIP_BORDER,
    zIndex: 2,
  },
  tooltipHeader: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.6,
    lineHeight: 10,
    color: VIOLET,
    marginBottom: 3,
  },
  tooltipBody: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.35,
    lineHeight: 9,
    color: VIOLET_DIM,
  },
});
