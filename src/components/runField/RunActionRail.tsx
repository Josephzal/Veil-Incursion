import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import HubPrimaryCta from '../hub/HubPrimaryCta';
import { RUN_FIELD } from '../../theme/runFieldTokens';

export type RunActionRailMode = 'screen' | 'panel' | 'dialog';

interface RunActionRailProps {
  /**
   * `screen` — lower-right progression (leave / continue / descent).
   * `panel` — commit action attached to a workspace footer.
   * `dialog` — CANCEL left + confirm right inside a panel.
   */
  mode?: RunActionRailMode;
  primaryLabel: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryDanger?: boolean;
  /** Quieter secondary / progression sibling (e.g. CONTINUE INCURSION beside PURCHASE). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  /** When true, secondary uses danger (CANCEL / ABORT). Default true for dialog mode. */
  secondaryDanger?: boolean;
  /** Optional left-side summary (staged cost, HP preview, etc). */
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  primaryWidth?: number;
}

/**
 * Shared in-run action placement grammar.
 * Screen progression sits lower-right; dialogs keep CANCEL left / confirm right.
 */
export default function RunActionRail({
  mode = 'screen',
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryDanger = false,
  secondaryLabel,
  onSecondary,
  secondaryDisabled = false,
  secondaryDanger,
  leading,
  style,
  primaryWidth = mode === 'screen' ? RUN_FIELD.ctaWidthScreen : RUN_FIELD.ctaWidth,
}: RunActionRailProps): React.JSX.Element {
  const isDialog = mode === 'dialog';
  const isScreen = mode === 'screen';
  const useDangerSecondary = secondaryDanger ?? isDialog;

  const primary = (
    <HubPrimaryCta
      label={primaryLabel}
      onPress={primaryDisabled ? undefined : onPrimary}
      disabled={primaryDisabled || !onPrimary}
      variant={primaryDanger ? 'danger' : 'glow'}
      minHeight={isScreen ? 46 : 48}
      style={[
        styles.primary,
        { width: primaryWidth, maxWidth: '100%' },
        isScreen ? styles.primaryScreen : null,
      ]}
    />
  );

  const secondary = secondaryLabel ? (
    <HubPrimaryCta
      label={secondaryLabel}
      onPress={secondaryDisabled ? undefined : onSecondary}
      disabled={secondaryDisabled || !onSecondary}
      variant={useDangerSecondary ? 'danger' : 'glow'}
      minHeight={isScreen ? 46 : 48}
      size={7.5}
      style={[
        styles.secondary,
        isDialog ? styles.secondaryDialog : null,
        isScreen ? styles.secondaryScreen : null,
        !useDangerSecondary ? styles.secondaryQuiet : null,
      ]}
    />
  ) : null;

  if (isDialog) {
    return (
      <View style={[styles.dialogRoot, style]}>
        {secondary}
        {primary}
      </View>
    );
  }

  return (
    <View style={[styles.root, isScreen ? styles.rootScreen : styles.rootPanel, style]}>
      <View style={styles.leadingSlot}>
        {leading ?? null}
      </View>
      <View style={styles.actions}>
        {secondary}
        {primary}
      </View>
    </View>
  );
}

/** Compact staged / preview summary for screen rails. */
export function RunActionRailSummary({
  lines,
}: {
  lines: Array<{ label: string; value: string; accent?: boolean; danger?: boolean }>;
}): React.JSX.Element {
  return (
    <View style={styles.summary}>
      {lines.map((line) => (
        <View key={line.label} style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{line.label}</Text>
          <Text
            style={[
              styles.summaryValue,
              line.accent ? styles.summaryAccent : null,
              line.danger ? styles.summaryDanger : null,
            ]}
          >
            {line.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexShrink: 0,
  },
  rootScreen: {
    marginTop: 8,
    paddingTop: 4,
  },
  rootPanel: {
    marginTop: 8,
  },
  dialogRoot: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 12,
    flexShrink: 0,
    paddingTop: 10,
  },
  leadingSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexShrink: 0,
  },
  primary: {
    alignSelf: 'auto',
  },
  primaryScreen: {
    minWidth: 220,
    maxWidth: 300,
  },
  secondary: {
    alignSelf: 'auto',
  },
  secondaryDialog: {
    flex: 1,
    maxWidth: 200,
  },
  secondaryScreen: {
    minWidth: 180,
    maxWidth: 260,
  },
  secondaryQuiet: {
    opacity: 0.88,
  },
  summary: {
    gap: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  summaryLabel: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.micro,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: RUN_FIELD.textSecondary,
  },
  summaryValue: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.secondary,
    fontWeight: '700',
    color: RUN_FIELD.text,
  },
  summaryAccent: {
    color: RUN_FIELD.mint,
  },
  summaryDanger: {
    color: RUN_FIELD.danger,
  },
});
