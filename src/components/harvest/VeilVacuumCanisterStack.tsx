import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Easing,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  resolveCanisterLayoutDimensions,
  resolveCanisterLayoutForExtractorBlock,
  resolveCanisterLayoutForGrid,
} from '../../constants/canisterLayout';
import VeilResidueCanisterShell from './VeilResidueCanister';
import VeilVacuumBar from './VeilVacuumBar';

export interface VeilVacuumCanisterStackHandle {
  measureCanisterCenter: () => Promise<{ x: number; y: number } | null>;
  animateFillToPercent: (percent: number) => void;
}

interface VeilVacuumCanisterStackProps {
  harvestPercentage: number;
  active: boolean;
  disabled?: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  /** When set, size the stack relative to the cargo cell grid instead of screen height. */
  gridFrameHeight?: number;
  /** Harvest tri-pane: large anchored extractor machinery. */
  sizeMode?: 'grid-sidecar' | 'extractor-block';
}

const VeilVacuumCanisterStack = forwardRef<VeilVacuumCanisterStackHandle, VeilVacuumCanisterStackProps>(
  function VeilVacuumCanisterStack(
    {
      harvestPercentage,
      active,
      disabled = false,
      onPressIn,
      onPressOut,
      gridFrameHeight,
      sizeMode = 'grid-sidecar',
    },
    ref,
  ): React.JSX.Element {
    const stackRef = useRef<View>(null);
    const fillPct = useSharedValue(harvestPercentage / 100);
    const { height: screenHeight } = useWindowDimensions();

    const layout = useMemo(() => {
      if (sizeMode === 'extractor-block') {
        return resolveCanisterLayoutForExtractorBlock(screenHeight);
      }

      let dims = gridFrameHeight != null
        ? resolveCanisterLayoutForGrid(gridFrameHeight)
        : resolveCanisterLayoutDimensions(screenHeight);

      return dims;
    }, [gridFrameHeight, screenHeight, sizeMode]);

    useEffect(() => {
      fillPct.value = withTiming(harvestPercentage / 100, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      });
    }, [fillPct, harvestPercentage]);

    const animateFillToPercent = useCallback((percent: number) => {
      fillPct.value = withTiming(Math.min(1, percent / 100), {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      });
    }, [fillPct]);

    const measureCanisterCenter = useCallback((): Promise<{ x: number; y: number } | null> => (
      new Promise((resolve) => {
        stackRef.current?.measureInWindow((x, y, width, height) => {
          resolve({ x: x + width / 2, y: y + height / 2 });
        });
      })
    ), []);

    useImperativeHandle(ref, () => ({
      measureCanisterCenter,
      animateFillToPercent,
    }), [animateFillToPercent, measureCanisterCenter]);

    return (
      <View
        ref={stackRef}
        collapsable={false}
        style={[
          styles.stack,
          {
            width: layout.canisterWidth,
            height: layout.canisterHeight,
          },
        ]}
        pointerEvents="box-none"
      >
        <VeilResidueCanisterShell />
        <VeilVacuumBar
          active={active}
          disabled={disabled}
          fillPct={fillPct}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
        />
      </View>
    );
  },
);

export default VeilVacuumCanisterStack;

const styles = StyleSheet.create({
  stack: {
    position: 'relative',
  },
});
