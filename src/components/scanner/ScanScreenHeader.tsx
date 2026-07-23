import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import { useCargoOverlay } from '../../context/CargoOverlayContext';
import { useRunStatusOverlay } from '../../context/RunStatusOverlayContext';
import {
  SCANNER_BORDER_QUIET,
  SCANNER_FOCUS_NEUTRAL,
  SCANNER_HEADER_BG,
  SCANNER_PHOSPHOR,
  SCANNER_TEXT_PRIMARY,
  SCANNER_TEXT_SECONDARY,
} from './vectorScannerShared';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';

interface ScanScreenHeaderProps {
  title: string;
  subtitle?: string;
  fontScale: number;
}

/**
 * Compact field-scanner header (~82–96px) with operational utility controls.
 */
export default function ScanScreenHeader({
  title,
  subtitle,
  fontScale,
}: ScanScreenHeaderProps): React.JSX.Element {
  const cargo = useCargoOverlay();
  const status = useRunStatusOverlay();
  const titleSize = Math.min(30, Math.max(26, 15 * fontScale));

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <TerminalText size={6.5} letterSpacing={1.1} style={styles.eyebrow} numberOfLines={1}>
            FIELD INTERCEPT // FS-01
          </TerminalText>
          <TerminalText
            size={titleSize}
            letterSpacing={0.85}
            style={styles.title}
            numberOfLines={1}
          >
            {title}
          </TerminalText>
          {subtitle ? (
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <TerminalText size={7} letterSpacing={0.95} style={styles.liveLine} numberOfLines={1}>
                {`LIVE SWEEP // ${subtitle}`}
              </TerminalText>
            </View>
          ) : null}
        </View>
        <View style={styles.utilities}>
          {status ? (
            <UtilityControl
              label="STATUS"
              disabled={!status.statusEnabled}
              onPress={status.openStatus}
              accessibilityLabel="Open operative status"
            />
          ) : null}
          {cargo ? (
            <UtilityControl
              label="CARGO"
              disabled={!cargo.cargoEnabled}
              onPress={cargo.openCargo}
              accessibilityLabel="Open cargo grid"
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function UtilityControl({
  label,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}): React.JSX.Element {
  const [focused, setFocused] = React.useState(false);
  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={(state) => [
        styles.utility,
        disabled ? styles.utilityDisabled : null,
        !disabled ? terminalHoverStyle(readPressableHover(state), state.pressed) : null,
        focused ? styles.utilityFocused : null,
        Platform.OS === 'web'
          ? ({
              outlineStyle: 'none',
              outlineWidth: 0,
            } as object)
          : null,
      ]}
    >
      <TerminalText size={7} letterSpacing={1.15} style={styles.utilityLabel}>
        {label}
      </TerminalText>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    minHeight: 68,
    maxHeight: 78,
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SCANNER_BORDER_QUIET,
    backgroundColor: SCANNER_HEADER_BG,
    flexShrink: 0,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrow: {
    color: SCANNER_TEXT_SECONDARY,
    fontWeight: '700',
  },
  title: {
    color: SCANNER_TEXT_PRIMARY,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 1,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: SCANNER_PHOSPHOR,
  },
  liveLine: {
    color: SCANNER_TEXT_SECONDARY,
    fontWeight: '700',
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  utilities: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  utility: {
    width: 96,
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: SCANNER_BORDER_QUIET,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as object,
      default: {
        borderWidth: 1,
        borderColor: SCANNER_BORDER_QUIET,
      },
    }),
  },
  utilityDisabled: {
    opacity: 0.4,
  },
  utilityFocused: {
    borderBottomColor: SCANNER_FOCUS_NEUTRAL,
    ...Platform.select({
      web: {
        boxShadow: `0 0 0 1px ${SCANNER_FOCUS_NEUTRAL}`,
      } as object,
      default: {
        borderColor: SCANNER_FOCUS_NEUTRAL,
      },
    }),
  },
  utilityLabel: {
    color: SCANNER_TEXT_SECONDARY,
    fontWeight: '800',
  },
});
