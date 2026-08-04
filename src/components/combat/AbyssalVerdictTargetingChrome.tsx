/**
 * Targeting instruction strip — sits below the turn-order panel while Abyssal is primed.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ABYSSAL_VERDICT_UI_COLORS as C,
  ABYSSAL_VERDICT_UI_COPY as COPY,
} from '../../data/abyssalVerdictReadyUi';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';
import { OTT, OTT_LAYOUT } from '../../constants/occultTacticalTerminalTheme';

export interface AbyssalVerdictTargetingChromeProps {
  visible: boolean;
  onCancel: () => void;
}

export default function AbyssalVerdictTargetingChrome({
  visible,
  onCancel,
}: AbyssalVerdictTargetingChromeProps): React.JSX.Element | null {
  if (!visible) return null;

  return (
    <View style={styles.host} pointerEvents="box-none" testID="abyssal-verdict-targeting-chrome">
      <View style={styles.plate}>
        <Text style={styles.instruction}>{COPY.targetingInstruction}</Text>
        <Pressable
          onPress={onCancel}
          style={({
            pressed,
            hovered,
            focused,
          }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
            styles.cancel,
            (hovered || focused || pressed) ? styles.cancelHot : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={COPY.cancelLabel}
          testID="abyssal-verdict-targeting-cancel"
        >
          <Text style={styles.cancelText}>[ {COPY.cancelLabel} ]</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: OTT_LAYOUT.turnOrderTop + 52,
    left: 0,
    right: 0,
    zIndex: 25,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  plate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.crimsonBorder,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 2,
    borderBottomLeftRadius: 8,
  },
  instruction: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    letterSpacing: 1.4,
    color: C.bone,
  },
  cancel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cancelHot: {
    backgroundColor: 'rgba(40, 10, 14, 0.9)',
  },
  cancelText: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    letterSpacing: 1.1,
    color: C.crimsonBright,
  },
});
