import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  Easing,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  CANISTER_BASE_PERCENT_FONT_SCALE,
  CANISTER_BASE_RATIO,
  resolveCanisterLayoutDimensions,
  resolveCanisterLayoutForGrid,
} from '../../constants/canisterLayout';
import { resolveHarvestSidecarWidth } from '../../constants/harvestLayout';
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
    },
    ref,
  ): React.JSX.Element {
    const stackRef = useRef<View>(null);
    const fillPct = useSharedValue(harvestPercentage / 100);
    const [displayPercent, setDisplayPercent] = useState(harvestPercentage);
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();

    const layout = useMemo(() => {
      let dims = gridFrameHeight != null
        ? resolveCanisterLayoutForGrid(gridFrameHeight)
        : resolveCanisterLayoutDimensions(screenHeight);

      if (gridFrameHeight != null) {
        const sidecarWidth = resolveHarvestSidecarWidth(screenWidth);
        if (sidecarWidth > 0 && dims.canisterWidth > sidecarWidth) {
          const scale = sidecarWidth / dims.canisterWidth;
          dims = {
            canisterWidth: Math.max(36, Math.round(dims.canisterWidth * scale)),
            canisterHeight: Math.max(48, Math.round(dims.canisterHeight * scale)),
            glassHeight: Math.max(28, Math.round(dims.glassHeight * scale)),
            glassWidth: Math.max(16, Math.round(dims.glassWidth * scale)),
          };
        }
      }

      return dims;
    }, [gridFrameHeight, screenHeight, screenWidth]);

    const percentFontSize = useMemo(
      () => Math.max(7, Math.round(layout.canisterWidth * CANISTER_BASE_PERCENT_FONT_SCALE)),
      [layout.canisterWidth],
    );

    useEffect(() => {
      fillPct.value = withTiming(harvestPercentage / 100, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      });
      setDisplayPercent(harvestPercentage);
    }, [fillPct, harvestPercentage]);

    const animateFillToPercent = useCallback((percent: number) => {
      fillPct.value = withTiming(Math.min(1, percent / 100), {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      });
      setDisplayPercent(Math.round(percent * 10) / 10);
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
        <View style={styles.basePercentBand} pointerEvents="none">
          <Text style={[styles.percentText, { fontSize: percentFontSize }]}>
            {Number.isInteger(displayPercent) ? displayPercent : displayPercent.toFixed(1)}%
          </Text>
        </View>
      </View>
    );
  },
);

export default VeilVacuumCanisterStack;

const styles = StyleSheet.create({
  stack: {
    position: 'relative',
  },
  basePercentBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: `${CANISTER_BASE_RATIO * 100}%`,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  percentText: {
    color: '#d8f4f0',
    fontWeight: '600',
    fontFamily: 'monospace',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
