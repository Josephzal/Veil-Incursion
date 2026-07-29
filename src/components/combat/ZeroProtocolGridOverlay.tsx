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
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  hud: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 1,
  },
  timer: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#94a3b8',
  },
  counter: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#f8fafc',
    marginTop: 4,
  },
});
