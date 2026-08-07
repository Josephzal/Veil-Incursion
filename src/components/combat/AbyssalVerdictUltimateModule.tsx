/**
 * Persistent console ultimate module — bottom-left under operative status.
 * Used for every class/weapon family (Aegis longsword pattern).
 * Rectangular cut-corner panel. Never a circle. Primes / opens interaction only.
 */

import React, { useState } from 'react';
import {
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
import { combatConsoleChromeStyle } from '../../theme/combatConsoleChrome';

export interface AbyssalVerdictUltimateModuleProps {
  state: AbyssalVerdictPresentationState;
  reserve: number;
  cap: number;
  disabled?: boolean;
  reducedMotion?: boolean;
  displayName?: string;
  meterHeader?: string;
  onPrime: () => void;
  onCancel: () => void;
}

export default function AbyssalVerdictUltimateModule({
  state,
  reserve,
  cap,
  disabled = false,
  displayName = COPY.displayName,
  meterHeader = COPY.moduleHeader,
  onPrime,
  onCancel,
}: AbyssalVerdictUltimateModuleProps): React.JSX.Element | null {
  const [hot, setHot] = useState(false);
  const interactive = state === 'ready' && !disabled;
  const targeting = state === 'targeting';
  const intenseGlow = targeting || (hot && interactive);
  const idleReady = state === 'ready' && !intenseGlow;
  const title = displayName.toUpperCase();

  if (state === 'unavailable') {
    return (
      <View
        style={[
          styles.root,
          combatConsoleChromeStyle({ accent: C.crimsonBright, tone: 'disabled' }),
        ]}
        pointerEvents="none"
        testID="abyssal-verdict-module-unavailable"
        accessibilityLabel={`${title} unavailable`}
      >
        <Text style={styles.header}>
          {meterHeader} {Math.round(reserve)}/{cap}
        </Text>
        <Text style={styles.titleMuted}>{title}</Text>
        <Text style={styles.statusMuted}>LOCKED</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        combatConsoleChromeStyle({
          accent: C.crimsonBright,
          tone: intenseGlow ? 'awake' : idleReady ? 'rest' : 'disabled',
        }),
        targeting || (hot && interactive) ? styles.rootHot : null,
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
            ? `${title} targeting — ${COPY.cancelLabel}`
            : `${title} ready — ${COPY.primeHint}`
        }
        testID={targeting ? 'abyssal-verdict-module-targeting' : 'abyssal-verdict-module-ready'}
      >
        <View style={styles.trace} pointerEvents="none" />
        <Text style={styles.header}>
          {meterHeader} {Math.round(reserve)}/{cap}
        </Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.status}>
          {targeting ? COPY.selectTarget : COPY.readyStatus}
        </Text>
        <Text style={styles.hint}>
          {targeting ? COPY.cancelLabel : hot && interactive ? COPY.primeHint : '[ U ]'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 4,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 2,
    borderBottomLeftRadius: 6,
    overflow: 'visible',
    alignSelf: 'stretch',
  },
  rootHot: {
    borderColor: '#E85A68',
  },
  hit: {
    paddingHorizontal: 9,
    paddingTop: 6,
    paddingBottom: 7,
    minHeight: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 2,
    borderBottomLeftRadius: 6,
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
    fontSize: COMBAT_HUD_TYPE.label,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: C.bone,
  },
  titleMuted: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.label,
    letterSpacing: 1.2,
    color: C.boneMuted,
    opacity: 0.7,
  },
  status: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    letterSpacing: 1.6,
    color: C.crimsonBright,
    marginTop: 1,
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
});
