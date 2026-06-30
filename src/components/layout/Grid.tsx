import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useHubLayout } from '../../context/HubLayoutContext';

interface GridProps {
  children: React.ReactNode;
  /** Override default column count from layout hook. */
  columns?: number;
  style?: StyleProp<ViewStyle>;
}

/** Wrapping row grid — uses centralized gap + columnWidth from hub layout. */
export function Grid({ children, columns, style }: GridProps): React.JSX.Element {
  const { gap } = useHubLayout();

  return (
    <View style={[styles.grid, { gap }, style]}>
      {children}
    </View>
  );
}

interface GridCellProps {
  children: React.ReactNode;
  /** Override lane-specific column width (e.g. market buy panel). */
  width?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fixed-width grid cell sized to the active content column. */
export function GridCell({ children, width, style }: GridCellProps): React.JSX.Element {
  const { columnWidth } = useHubLayout();

  return (
    <View style={[{ width: width ?? columnWidth }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
  },
});
