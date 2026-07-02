import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import {
  ENEMY_STATUS_EFFECTS,
  type EnemyStatusEffectDef,
  type EnemyStatusEffectKey,
} from '../../../utils/enemyStatusEffects';
import {
  COMBAT_POPUP_BODY_FONT,
  COMBAT_POPUP_SCALE,
} from '../../../constants/combatOverlayTypography';

const MONO = 'monospace';
const VIOLET = '#a78bfa';
const TOOLTIP_BG = 'rgba(12, 8, 22, 0.96)';
const TOOLTIP_BORDER = '#8b5cf6';
const DEFAULT_ICON_SIZE = 18;
const TOOLTIP_DISMISS_MS = 3000;

interface CombatStatusIconRowProps {
  statusKeys: readonly EnemyStatusEffectKey[];
  iconSize?: number;
}

/** Icon-only status row with press tooltips for the intel stat block. */
export default function CombatStatusIconRow({
  statusKeys,
  iconSize = DEFAULT_ICON_SIZE,
}: CombatStatusIconRowProps): React.JSX.Element | null {
  const [tooltipContent, setTooltipContent] = useState<EnemyStatusEffectDef | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipMinWidth = Math.round(160 * COMBAT_POPUP_SCALE);
  const tooltipMaxWidth = Math.round(280 * COMBAT_POPUP_SCALE);
  const tooltipPaddingH = Math.round(10 * COMBAT_POPUP_SCALE);
  const tooltipPaddingV = Math.round(8 * COMBAT_POPUP_SCALE);

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
    <View style={[styles.root, { minHeight: iconSize }]}>
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
              <Text style={styles.tooltipText}>{`[ ${tooltipContent.label} ]`}</Text>
              <Text style={styles.tooltipText}>{tooltipContent.description}</Text>
            </View>
          ) : null}
        </View>
      </Modal>

      <View style={styles.iconRow}>
        {statusKeys.map((key) => {
          const def = ENEMY_STATUS_EFFECTS[key];
          const selected = tooltipContent?.key === key;
          return (
            <HapticPressable
              key={key}
              onPress={() => showTooltip(def)}
              style={[
                styles.iconButton,
                { width: iconSize, height: iconSize },
                selected ? styles.iconButtonSelected : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={def.label}
            >
              <Image
                source={def.icon}
                style={{ width: iconSize - 2, height: iconSize - 2 }}
                resizeMode="contain"
              />
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
  tooltip: {
    backgroundColor: TOOLTIP_BG,
    borderWidth: 1,
    borderColor: TOOLTIP_BORDER,
    zIndex: 2,
    gap: 4,
  },
  tooltipText: {
    fontFamily: MONO,
    fontSize: COMBAT_POPUP_BODY_FONT,
    fontWeight: '700',
    letterSpacing: 0.35,
    lineHeight: COMBAT_POPUP_BODY_FONT + 4,
    color: VIOLET,
  },
});
