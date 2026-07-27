import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import HubPrimaryCta from '../hub/HubPrimaryCta';
import { RUN_FIELD } from '../../theme/runFieldTokens';

interface RunActionBarProps {
  primaryLabel: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  /** Danger / descent style for the primary path (e.g. confirm descent). */
  primaryDanger?: boolean;
  /** Force secondary into danger treatment (cancel / abort). Defaults true. */
  secondaryDanger?: boolean;
  /** Stack vertically (default) or place cancel left / confirm right. */
  layout?: 'stack' | 'row';
  style?: StyleProp<ViewStyle>;
  primaryWidth?: number;
}

/**
 * Focused primary CTA matching Veil Front begin-incursion glow,
 * with optional cancel/abort secondary in danger red.
 */
export default function RunActionBar({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  secondaryLabel,
  onSecondary,
  secondaryDisabled = false,
  primaryDanger = false,
  secondaryDanger = true,
  layout = 'stack',
  style,
  primaryWidth = RUN_FIELD.ctaWidth,
}: RunActionBarProps): React.JSX.Element {
  const row = layout === 'row' && secondaryLabel;

  const primary = (
    <HubPrimaryCta
      label={primaryLabel}
      onPress={primaryDisabled ? undefined : onPrimary}
      disabled={primaryDisabled || !onPrimary}
      variant={primaryDanger ? 'danger' : 'glow'}
      minHeight={48}
      style={row
        ? styles.rowPrimary
        : { width: primaryWidth, maxWidth: '100%', alignSelf: 'center' }}
    />
  );

  const secondary = secondaryLabel ? (
    <HubPrimaryCta
      label={secondaryLabel}
      onPress={secondaryDisabled ? undefined : onSecondary}
      disabled={secondaryDisabled || !onSecondary}
      variant={secondaryDanger ? 'danger' : 'glow'}
      minHeight={48}
      size={7.5}
      style={row ? styles.rowSecondary : styles.secondary}
    />
  ) : null;

  return (
    <View style={[styles.root, row ? styles.rootRow : null, style]}>
      {row ? (
        <>
          {secondary}
          {primary}
        </>
      ) : (
        <>
          {primary}
          {secondary}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  rootRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 12,
  },
  secondary: {
    width: RUN_FIELD.ctaWidthCompact,
    maxWidth: '100%',
    alignSelf: 'center',
  },
  rowSecondary: {
    flex: 1,
    maxWidth: 200,
  },
  rowPrimary: {
    flex: 1.15,
    maxWidth: 280,
  },
});
