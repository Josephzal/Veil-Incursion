import React, { useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { DOSSIER_FOREGROUND } from '../../constants/dossierSurface';
import { VEIL } from '../../theme/veilTerminalTokens';

const FENCE_AMBER = '#E0B45A';
const FENCE_BORDER = 'rgba(224, 180, 90, 0.55)';
const FENCE_ACTIVE = 'rgba(224, 180, 90, 0.95)';
const FENCE_PALE = '#FEF3C7';

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
          backgroundColor: dropActive ? 'rgba(224, 180, 90, 0.12)' : DOSSIER_FOREGROUND,
          borderColor: dropActive ? FENCE_ACTIVE : FENCE_BORDER,
          minHeight: 64 * fontScale,
          paddingVertical: 12 * fontScale,
          paddingHorizontal: 12 * fontScale,
          gap: 4 * fontScale,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: dropActive ? FENCE_PALE : FENCE_AMBER,
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
            color: dropActive ? 'rgba(254, 243, 199, 0.95)' : VEIL.textMuted,
            fontSize: subtextSize,
            lineHeight: subtextSize * 1.35,
          },
        ]}
      >
        {dropActive ? 'RELEASE TO SELL CARGO' : 'DRAG OWNED CARGO HERE TO SELL'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bay: {
    width: '100%',
    borderWidth: 1.25,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
