import React, { createContext, useContext, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useHubLayout } from '../../context/HubLayoutContext';
import { getGridMetrics } from '../../utils/layoutGrid';

interface GridLaneContextValue {
  columns: number;
  cellWidth?: number;
}

const GridLaneContext = createContext<GridLaneContextValue>({ columns: 1 });

interface GridProps {
  children: React.ReactNode;
  /** Override default column count from layout hook. */
  columns?: number;
  /** When set, cell width is derived from this lane instead of the measured container width. */
  laneWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/** Wrapping row grid — uses centralized gap + columnWidth from hub layout. */
export function Grid({ children, columns, laneWidth, style }: GridProps): React.JSX.Element {
  const { gap, columns: layoutColumns } = useHubLayout();
  const cols = columns ?? layoutColumns;
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const effectiveLane = laneWidth ?? measuredWidth;
  const cellWidth = cols > 1 && effectiveLane > 0
    ? getGridMetrics(Math.max(0, effectiveLane), cols, gap).columnWidth
    : undefined;

  const laneValue = useMemo(
    () => ({ columns: cols, cellWidth }),
    [cellWidth, cols],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (width > 0 && width !== measuredWidth) {
      setMeasuredWidth(width);
    }
  };

  return (
    <GridLaneContext.Provider value={laneValue}>
      <View style={[styles.grid, { gap, rowGap: gap, columnGap: gap }, style]} onLayout={handleLayout}>
        {children}
      </View>
    </GridLaneContext.Provider>
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
  const { columns, cellWidth } = useContext(GridLaneContext);

  const resolvedWidth = width ?? cellWidth ?? (columns === 2 ? '48%' : columnWidth);

  return (
    <View style={[{ width: resolvedWidth, alignSelf: 'stretch' }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    width: '100%',
  },
});
