import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { ZERO_PROTOCOL_DURATION_MS } from '../../data/combatMasteryEngine';

interface ZeroProtocolGridOverlayProps {
  visible: boolean;
  onTap: () => void;
  onComplete: (tapCount: number) => void;
}

export default function ZeroProtocolGridOverlay({
  visible,
  onTap,
  onComplete,
}: ZeroProtocolGridOverlayProps): React.JSX.Element | null {
  const [tapCount, setTapCount] = useState(0);
  const [channelActive, setChannelActive] = useState(false);
  const tapCountRef = useRef(0);
  const finishedRef = useRef(false);
  const onTapRef = useRef(onTap);
  const onCompleteRef = useRef(onComplete);

  onTapRef.current = onTap;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!visible) {
      tapCountRef.current = 0;
      finishedRef.current = false;
      setTapCount(0);
      setChannelActive(false);
      return;
    }

    finishedRef.current = false;
    tapCountRef.current = 0;
    setTapCount(0);
    setChannelActive(true);

    const timer = setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setChannelActive(false);
      // Zero taps → cancel free (do not spend Protocol / resolve damage).
      onCompleteRef.current(tapCountRef.current);
    }, ZERO_PROTOCOL_DURATION_MS);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const handlePress = () => {
    if (!channelActive || finishedRef.current) return;
    onTapRef.current();
    const next = tapCountRef.current + 1;
    tapCountRef.current = next;
    setTapCount(next);
  };

  return (
    <HapticPressable style={styles.overlay} onPress={handlePress} disabled={!channelActive}>
      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.title}>[ ZERO PROTOCOL // RAPID EXECUTION ]</Text>
        <Text style={styles.timer}>
          {channelActive ? '2.0s CHANNEL — TAP HOSTILE GRID' : 'CHANNEL CLOSED'}
        </Text>
        <Text style={styles.counter}>{`${tapCount} IMPACT${tapCount === 1 ? '' : 'S'}`}</Text>
      </View>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
  },
  hud: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.55)',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 1,
  },
  timer: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#94a3b8',
  },
  counter: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 4,
  },
});
