import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import RunFieldHeader from '../runField/RunFieldHeader';

export interface RunEventNodeHeaderProps {
  title: string;
  subtitle?: string;
  /** @deprecated Prefer eyebrow + contextLine via RunFieldHeader directly. */
  fontScale?: number;
  /** Pin STATUS / CARGO ghost utilities. */
  showRunChrome?: boolean;
  eyebrow?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * In-run field header adapter — keeps existing call sites working.
 * Scoped field styling; does not affect scanner ScanScreenHeader.
 */
export default function RunEventNodeHeader({
  title,
  subtitle,
  showRunChrome = false,
  eyebrow = 'FIELD CONTACT',
  style,
}: RunEventNodeHeaderProps): React.JSX.Element {
  return (
    <RunFieldHeader
      eyebrow={eyebrow}
      title={title}
      contextLine={subtitle}
      showUtilities={showRunChrome}
      style={style}
    />
  );
}
