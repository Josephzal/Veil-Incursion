import React, { useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

const FENCE_YELLOW = '#CA8A04';
const FENCE_YELLOW_PALE = '#FEF9C3';
const FENCE_YELLOW_BG = 'rgba(254, 249, 195, 0.14)';
const FENCE_YELLOW_ACTIVE_BG = 'rgba(250, 204, 21, 0.28)';
const FENCE_YELLOW_BORDER = 'rgba(234, 179, 8, 0.55)';
const FENCE_YELLOW_ACTIVE_BORDER = 'rgba(250, 204, 21, 0.95)';

interface BlackMarketFenceBayProps {
  fontScale: number;
  dropActive: boolean;
  onLayoutMeasured?: (rect: { pageX: number; pageY: number; width: number; height: number }) => void;
}

export default function BlackMarketFenceBay({
  fontScale,
  dropActive,
  onLayoutMeasured,
}: BlackMarketFenceBayProps): React.JSX.Element {
  const labelSize = Math.max(9, 10 * fontScale);
  const subtextSize = Math.max(8, 9 * fontScale);
  const hintSize = Math.max(16, 18 * fontScale);
  const rootRef = useRef<View>(null);

  const handleLayout = (_event: LayoutChangeEvent) => {
    rootRef.current?.measureInWindow((pageX, pageY, width, height) => {
      onLayoutMeasured?.({ pageX, pageY, width, height });
    });
  };

  return (
    <View
      ref={rootRef}
      onLayout={handleLayout}
      style={[
        styles.bay,
        {
          backgroundColor: dropActive ? FENCE_YELLOW_ACTIVE_BG : FENCE_YELLOW_BG,
          borderColor: dropActive ? FENCE_YELLOW_ACTIVE_BORDER : FENCE_YELLOW_BORDER,
          minHeight: 72 * fontScale,
          paddingVertical: 12 * fontScale,
          paddingHorizontal: 14 * fontScale,
          gap: 6 * fontScale,
        },
      ]}
    >
      <View
        style={[
          styles.dropFrame,
          {
            borderColor: dropActive ? FENCE_YELLOW_ACTIVE_BORDER : FENCE_YELLOW_BORDER,
            paddingVertical: 10 * fontScale,
            paddingHorizontal: 12 * fontScale,
            gap: 4 * fontScale,
          },
        ]}
      >
        <Text
          style={[
            styles.dropGlyph,
            {
              color: dropActive ? FENCE_YELLOW_PALE : 'rgba(254, 249, 195, 0.75)',
              fontSize: hintSize,
              lineHeight: hintSize * 1.1,
            },
          ]}
        >
          ↓
        </Text>
        <Text
          style={[
            styles.label,
            {
              color: dropActive ? FENCE_YELLOW_PALE : FENCE_YELLOW,
              fontSize: labelSize,
              lineHeight: labelSize * 1.25,
            },
          ]}
        >
          FENCE
        </Text>
        <Text
          style={[
            styles.subtext,
            {
              color: dropActive ? 'rgba(254, 249, 195, 0.95)' : 'rgba(254, 249, 195, 0.72)',
              fontSize: subtextSize,
              lineHeight: subtextSize * 1.35,
            },
          ]}
        >
          {dropActive ? 'RELEASE TO SELL CARGO' : 'DRAG ITEM HERE TO SELL'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bay: {
    width: '100%',
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dropFrame: {
    width: '100%',
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(254, 249, 195, 0.06)',
  },
  dropGlyph: {
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  label: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  subtext: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
