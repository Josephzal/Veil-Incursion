/**
 * Persistent ABYSSAL VERDICT ultimate module — sits in the Aegis Reserve / console status region.
 * Rectangular cut-corner panel. Never a circle. Primes only — does not commit damage/Reserve.
 */

import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ABYSSAL_VERDICT_UI_COLORS as C,
  ABYSSAL_VERDICT_UI_COPY as COPY,
  type AbyssalVerdictPresentationState,
} from '../../data/abyssalVerdictReadyUi';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';
import { OTT } from '../../constants/occultTacticalTerminalTheme';

export interface AbyssalVerdictUltimateModuleProps {
  state: AbyssalVerdictPresentationState;
  reserve: number;
  cap: number;
  disabled?: boolean;
  reducedMotion?: boolean;
  onPrime: () => void;
  onCancel: () => void;
}

export default function AbyssalVerdictUltimateModule({
  state,
  reserve,
  cap,
  disabled = false,
  onPrime,
  onCancel,
}: AbyssalVerdictUltimateModuleProps): React.JSX.Element | null {
  const [hot, setHot] = useState(false);
  const interactive = state === 'ready' && !disabled;
  const targeting = state === 'targeting';
  const showReadyGlow = state === 'ready' || targeting;

  if (state === 'unavailable') {
    return (
      <View
        style={[styles.root, styles.rootUnavailable]}
        pointerEvents="none"
        testID="abyssal-verdict-module-unavailable"
        accessibilityLabel={`${COPY.displayName} unavailable`}
      >
        <Text style={styles.header}>
          {COPY.moduleHeader} {Math.round(reserve)}/{cap}
        </Text>
        <Text style={styles.titleMuted}>{COPY.displayName}</Text>
        <Text style={styles.statusMuted}>LOCKED</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        styles.rootReady,
        showReadyGlow ? styles.rootGlow : null,
        targeting || (hot && interactive) ? styles.rootHot : null,
        Platform.OS === 'web' && showReadyGlow
          ? ({
              boxShadow: targeting || (hot && interactive)
                ? `0 0 12px 2px ${C.crimsonBright}`
                : `0 0 10px 1px rgba(196, 58, 74, 0.85)`,
            } as object)
          : null,
      ]}
      testID="abyssal-verdict-module-wrap"
    >
      <Pressable
        style={[
          styles.hit,
          hot && interactive ? styles.hitHot : null,
          targeting ? styles.hitTargeting : null,
        ]}
        disabled={disabled && !targeting}
        onHoverIn={() => setHot(true)}
        onHoverOut={() => setHot(false)}
        onFocus={() => setHot(true)}
        onBlur={() => setHot(false)}
        onPress={() => {
          if (targeting) onCancel();
          else if (interactive) onPrime();
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled && !targeting, selected: targeting }}
        accessibilityLabel={
          targeting
            ? `${COPY.displayName} targeting — ${COPY.cancelLabel}`
            : `${COPY.displayName} ready — ${COPY.primeHint}`
        }
        testID={targeting ? 'abyssal-verdict-module-targeting' : 'abyssal-verdict-module-ready'}
      >
        <View style={styles.trace} pointerEvents="none" />
        <Text style={styles.header}>
          {COPY.moduleHeader} {Math.round(reserve)}/{cap}
        </Text>
        <Text style={styles.title}>{COPY.displayName}</Text>
        <Text style={styles.status}>
          {targeting ? COPY.selectTarget : COPY.readyStatus}
        </Text>
        <Text style={styles.hint}>
          {targeting ? COPY.cancelLabel : hot && interactive ? COPY.primeHint : '[ U ]'}
        </Text>
        {targeting || (hot && interactive) ? null : (
          <Text style={styles.glyph}>[ U ]</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 6,
    borderWidth: 1.5,
    backgroundColor: C.panel,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 2,
    borderBottomLeftRadius: 8,
    overflow: 'hidden',
  },
  rootReady: {
    borderColor: C.crimsonBright,
  },
  rootGlow: {
    shadowColor: C.crimsonBright,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  rootHot: {
    borderColor: '#E85A68',
  },
  rootUnavailable: {
    borderColor: 'rgba(120, 90, 90, 0.35)',
  },
  hit: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 72,
    justifyContent: 'center',
  },
  hitHot: {
    backgroundColor: 'rgba(28, 8, 12, 0.95)',
  },
  hitTargeting: {
    backgroundColor: 'rgba(22, 6, 10, 0.96)',
  },
  trace: {
    position: 'absolute',
    top: -6,
    right: -10,
    width: '70%',
    height: 1,
    backgroundColor: C.violetAccent,
    transform: [{ rotate: '-18deg' }],
  },
  header: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    letterSpacing: 1.2,
    color: C.boneMuted,
    marginBottom: 2,
  },
  title: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.body,
    letterSpacing: 1.6,
    fontWeight: '700',
    color: C.bone,
  },
  titleMuted: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.body,
    letterSpacing: 1.4,
    color: C.boneMuted,
    opacity: 0.7,
  },
  status: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    letterSpacing: 1.8,
    color: C.crimsonBright,
    marginTop: 2,
  },
  statusMuted: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    letterSpacing: 1.4,
    color: OTT.textMuted,
    marginTop: 2,
  },
  hint: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    letterSpacing: 1.1,
    color: C.boneMuted,
    marginTop: 4,
  },
  glyph: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    color: C.violet,
  },
});
