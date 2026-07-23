import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { Circle, Defs, G, RadialGradient, Stop } from 'react-native-svg';
import { SCANNER_PHOSPHOR, accentWithAlpha } from './vectorScannerShared';

interface DiscoveryRippleProps {
  x: number;
  y: number;
  pulseKey: number;
  /** Unified pip hue — discovery bloom matches the signal color. */
  color?: string;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

/**
 * One-shot discovery bloom — quick soft settle into the pip. Not a selection-lock ripple.
 */
export default function DiscoveryRipple({
  x,
  y,
  pulseKey,
  color = SCANNER_PHOSPHOR,
}: DiscoveryRippleProps): React.JSX.Element | null {
  const bloom = useRef(new Animated.Value(0)).current;
  const [t, setT] = useState(0);
  const [active, setActive] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (pulseKey === 0) return undefined;
    if (reduceMotion) {
      setActive(true);
      setT(0.35);
      const timer = setTimeout(() => {
        setActive(false);
        setT(0);
      }, 140);
      return () => clearTimeout(timer);
    }

    setActive(true);
    bloom.setValue(0);
    setT(0);
    const id = bloom.addListener(({ value }) => setT(value));
    const anim = Animated.timing(bloom, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) setActive(false);
    });
    return () => {
      bloom.removeListener(id);
      anim.stop();
    };
  }, [pulseKey, reduceMotion, bloom]);

  if (!active && t <= 0.01) return null;

  const expand = 5 + t * 12;
  const opacity = (1 - t) * 0.5;
  const gradId = `discovery-bloom-${pulseKey}-${Math.round(x)}-${Math.round(y)}`;

  return (
    <G
      pointerEvents="none"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
    >
      <Defs>
        <RadialGradient
          id={gradId}
          cx={String(x)}
          cy={String(y)}
          rx={String(expand)}
          ry={String(expand)}
          fx={String(x)}
          fy={String(y)}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0%" stopColor={color} stopOpacity={opacity * 0.7} />
          <Stop offset="55%" stopColor={color} stopOpacity={opacity * 0.22} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={x} cy={y} r={expand} fill={`url(#${gradId})`} />
      <Circle
        cx={x}
        cy={y}
        r={3.2 + t * 1.4}
        fill={accentWithAlpha(color, opacity * 0.9)}
      />
    </G>
  );
}
