import React from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import HapticPressable from '../HapticPressable';
import { useCargoOverlay } from '../../context/CargoOverlayContext';
import { useRunStatusOverlay } from '../../context/RunStatusOverlayContext';
import { RUN_FIELD } from '../../theme/runFieldTokens';
import { readPressableHover } from '../../utils/terminalHoverStyle';

interface RunFieldHeaderProps {
  eyebrow?: string;
  title: string;
  /** Location / depth / state line — mixed case preferred. */
  contextLine?: string;
  showUtilities?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function RunUtilityActions(): React.JSX.Element | null {
  const cargo = useCargoOverlay();
  const status = useRunStatusOverlay();
  if (!cargo && !status) return null;

  return (
    <View style={styles.utilities}>
      {status ? (
        <GhostUtility
          label="STATUS"
          onPress={status.openStatus}
          disabled={!status.statusEnabled}
        />
      ) : null}
      {cargo ? (
        <GhostUtility
          label="CARGO"
          onPress={cargo.openCargo}
          disabled={!cargo.cargoEnabled}
        />
      ) : null}
    </View>
  );
}

function GhostUtility({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={(state) => {
        const hovered = readPressableHover(state);
        const awake = !disabled && (hovered || state.pressed);
        return [
          styles.ghostBtn,
          awake ? styles.ghostBtnHot : null,
          disabled ? styles.ghostBtnDisabled : null,
          Platform.OS === 'web'
            ? ({ outlineStyle: 'none', outlineWidth: 0 } as object)
            : null,
        ];
      }}
    >
      <Text style={styles.ghostLabel}>{label}</Text>
    </HapticPressable>
  );
}

/**
 * Shared in-run field header — authoritative title/utility sizing for all
 * full in-incursion screens (including scanner outer chrome via ScanScreenHeader).
 */
export default function RunFieldHeader({
  eyebrow,
  title,
  contextLine,
  showUtilities = true,
  style,
}: RunFieldHeaderProps): React.JSX.Element {
  return (
    <View style={[styles.root, style]}>
      <View style={styles.row}>
        <View style={styles.copy}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {contextLine ? <Text style={styles.context} numberOfLines={2}>{contextLine}</Text> : null}
        </View>
        {showUtilities ? <RunUtilityActions /> : null}
      </View>
      <View style={styles.baseline} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    flexShrink: 0,
    gap: RUN_FIELD.header.gap,
    zIndex: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: RUN_FIELD.header.copyGap,
  },
  eyebrow: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.eyebrow,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: 'rgba(99, 226, 177, 0.62)',
  },
  title: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.display,
    fontWeight: RUN_FIELD.header.titleWeight,
    letterSpacing: RUN_FIELD.header.titleLetterSpacing,
    // RN lineHeight is px — never use unitless CSS ratios here.
    lineHeight: Math.round(RUN_FIELD.type.displayMax * 1.05),
    color: RUN_FIELD.text,
    ...Platform.select({
      web: {
        fontSize: `clamp(${RUN_FIELD.type.displayMin}px, 1.8vw, ${RUN_FIELD.type.displayMax}px)`,
        lineHeight: `${Math.round(RUN_FIELD.type.displayMax * 1.05)}px`,
      } as object,
      default: {},
    }),
  },
  context: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.secondary,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: Math.round(RUN_FIELD.type.secondary * 1.35),
    color: RUN_FIELD.textSecondary,
    marginTop: 2,
    ...Platform.select({
      web: {
        fontSize: 'clamp(13px, 0.8vw, 16px)',
        lineHeight: '22px',
      } as object,
      default: {},
    }),
  },
  baseline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    backgroundColor: RUN_FIELD.line,
  },
  utilities: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
    paddingBottom: 4,
  },
  ghostBtn: {
    paddingHorizontal: RUN_FIELD.header.utilityPadH,
    paddingVertical: RUN_FIELD.header.utilityPadV,
    borderWidth: 1,
    borderColor: RUN_FIELD.line,
    backgroundColor: 'rgba(7, 14, 15, 0.35)',
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnHot: {
    borderColor: RUN_FIELD.mintBorder,
    backgroundColor: RUN_FIELD.mintSoft,
  },
  ghostBtnDisabled: {
    opacity: 0.5,
  },
  ghostLabel: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: RUN_FIELD.textSecondary,
  },
});
