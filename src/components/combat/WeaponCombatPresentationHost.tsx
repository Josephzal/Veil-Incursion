/**
 * Phase 3M repair — arena presentation host (VFX layer).
 * pointer-events: none. Does not mutate combat state.
 * Replaces generic filled polygon / full-body flash language with
 * restrained weapon-path primitives anchored near the operative release.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  registerCombatPresentationVisualListener,
  setCombatPresentationMounted,
  type CombatPresentationVisualEvent,
} from '../../utils/combatPresentationBus';
import { unlockCombatPresentationAudio } from '../../utils/combatPresentationAudio';

/** Desaturated, low-opacity palettes — color alone is not weapon identity. */
const PALETTE_HEX: Record<string, string> = {
  PALE_STEEL_MINT: 'rgba(170, 200, 195, 0.72)',
  CYAN_VEIL: 'rgba(120, 185, 195, 0.65)',
  HEAVY_IRON: 'rgba(150, 145, 138, 0.78)',
  SILVER_SEAL: 'rgba(200, 205, 210, 0.75)',
  CINDER_ASH: 'rgba(190, 145, 95, 0.7)',
  NULL_BREACH: 'rgba(110, 95, 145, 0.72)',
  CURSE_VIOLET: 'rgba(145, 110, 170, 0.68)',
  NULL_CYAN: 'rgba(100, 175, 185, 0.7)',
  CRIMSON_GLASS: 'rgba(175, 85, 95, 0.7)',
};

const MAX_ACTIVE = 8;

type PrimitiveKind =
  | 'slash'
  | 'mirrored'
  | 'vertical'
  | 'tracer'
  | 'muzzle'
  | 'ring'
  | 'crescent'
  | 'thread'
  | 'spark'
  | 'glyph'
  | 'refraction'
  | 'fallback';

function classifyPrimitive(primitive: string): PrimitiveKind {
  if (primitive.includes('mirrored')) return 'mirrored';
  if (primitive.includes('heavy_vertical') || primitive.includes('vertical')) return 'vertical';
  if (primitive.includes('slash') || primitive.includes('directional')) return 'slash';
  if (primitive.includes('tracer') || primitive.includes('projectile')) return 'tracer';
  if (primitive.includes('muzzle')) return 'muzzle';
  if (
    primitive.includes('ring')
    || primitive.includes('breach')
    || primitive.includes('radial')
    || primitive.includes('chamber')
  ) {
    return 'ring';
  }
  if (primitive.includes('crescent') || primitive.includes('arc')) return 'crescent';
  if (primitive.includes('thread') || primitive.includes('knot') || primitive.includes('circuit')) {
    return 'thread';
  }
  if (primitive.includes('glyph') || primitive.includes('fracture') || primitive.includes('ka_')) {
    return 'glyph';
  }
  if (primitive.includes('polygonal') || primitive.includes('refraction')) return 'refraction';
  if (primitive.includes('spark') || primitive.includes('impact') || primitive.includes('outline')) {
    return 'spark';
  }
  return 'fallback';
}

function EffectBurst({
  event,
  onDone,
}: {
  event: CombatPresentationVisualEvent;
  onDone: (id: string) => void;
}): React.JSX.Element {
  const opacity = useSharedValue(0);
  const travel = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 35, easing: Easing.out(Easing.quad) });
    travel.value = withTiming(1, {
      duration: Math.min(160, Math.max(70, event.durationMs)),
      easing: Easing.out(Easing.cubic),
    });
    const fade = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 90 });
    }, Math.max(40, event.durationMs - 90));
    const done = setTimeout(() => onDone(event.id), event.durationMs + 30);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [event.durationMs, event.id, onDone, opacity, travel]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: travel.value * (event.stage === 'CONTACT' ? 54 : 28) },
      { translateY: travel.value * (event.stage === 'CONTACT' ? -8 : -4) },
    ],
  }));

  const color = PALETTE_HEX[event.palette] ?? 'rgba(180,180,180,0.65)';
  const kind = classifyPrimitive(event.primitive);
  const fill = event.reducedFlash ? 'transparent' : color;
  const border = color;

  // Restrained fallback: thin line + small contact spark — never a large opaque polygon.
  if (kind === 'fallback' || kind === 'spark') {
    return (
      <Animated.View pointerEvents="none" style={[styles.origin, style]}>
        <View style={[styles.thinLine, { backgroundColor: fill, borderColor: border }]} />
        <View style={[styles.contactSpark, { borderColor: border }]} />
      </Animated.View>
    );
  }

  if (kind === 'slash') {
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.origin, styles.slash, { borderColor: border, backgroundColor: fill }, style]}
      />
    );
  }

  if (kind === 'mirrored') {
    return (
      <Animated.View pointerEvents="none" style={[styles.origin, style]}>
        <View style={[styles.slashTwinA, { backgroundColor: fill, borderColor: border }]} />
        <View style={[styles.slashTwinB, { backgroundColor: fill, borderColor: border }]} />
        <View style={[styles.contactX, { borderColor: border }]} />
      </Animated.View>
    );
  }

  if (kind === 'vertical') {
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.origin, styles.vertical, { borderColor: border, backgroundColor: fill }, style]}
      />
    );
  }

  if (kind === 'tracer' || kind === 'muzzle') {
    return (
      <Animated.View pointerEvents="none" style={[styles.origin, style]}>
        {kind === 'muzzle' ? (
          <View style={[styles.muzzleFlash, { borderColor: border }]} />
        ) : null}
        <View style={[styles.tracer, { backgroundColor: fill }]} />
        <View style={[styles.contactSpark, { borderColor: border, left: 72 }]} />
      </Animated.View>
    );
  }

  if (kind === 'ring') {
    return (
      <Animated.View pointerEvents="none" style={[styles.origin, style]}>
        <View style={[styles.ringOuter, { borderColor: border }]} />
        <View style={[styles.ringInner, { borderColor: border }]} />
      </Animated.View>
    );
  }

  if (kind === 'crescent') {
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.origin, styles.crescent, { borderColor: border }, style]}
      />
    );
  }

  if (kind === 'thread') {
    return (
      <Animated.View pointerEvents="none" style={[styles.origin, style]}>
        <View style={[styles.thread, { backgroundColor: fill }]} />
        <View style={[styles.thread, styles.threadAlt, { backgroundColor: fill }]} />
      </Animated.View>
    );
  }

  if (kind === 'refraction') {
    return (
      <Animated.View pointerEvents="none" style={[styles.origin, style]}>
        <View style={[styles.focusPoly, { borderColor: border }]} />
        <View style={[styles.ray, { backgroundColor: fill }]} />
        <View style={[styles.ray, styles.rayB, { backgroundColor: fill }]} />
      </Animated.View>
    );
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.origin, style]}>
      <View style={[styles.glyph, { borderColor: border }]} />
    </Animated.View>
  );
}

/** Mount inside combat arena overlay stack. */
export default function WeaponCombatPresentationHost(): React.JSX.Element {
  const [events, setEvents] = useState<CombatPresentationVisualEvent[]>([]);

  useEffect(() => {
    setCombatPresentationMounted(true);
    unlockCombatPresentationAudio();
    registerCombatPresentationVisualListener((event) => {
      setEvents((prev) => {
        const next = [...prev, event];
        return next.length > MAX_ACTIVE ? next.slice(next.length - MAX_ACTIVE) : next;
      });
    });
    return () => {
      registerCombatPresentationVisualListener(null);
      setCombatPresentationMounted(false);
      setEvents([]);
    };
  }, []);

  const onDone = (id: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== id));
  };

  return (
    <View pointerEvents="none" style={styles.root}>
      {events.map((event) => (
        <EffectBurst key={event.id} event={event} onDone={onDone} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 6,
    elevation: 6,
  },
  /** Release near operative hands / weapon — not character center mass. */
  origin: {
    position: 'absolute',
    left: '16%',
    bottom: '34%',
  },
  thinLine: {
    width: 56,
    height: 2,
    borderRadius: 1,
    borderWidth: 0,
  },
  contactSpark: {
    position: 'absolute',
    left: 50,
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  slash: {
    width: 64,
    height: 3,
    borderRadius: 1,
    borderWidth: 0,
    transform: [{ rotate: '-32deg' }],
  },
  slashTwinA: {
    width: 52,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '-38deg' }],
  },
  slashTwinB: {
    position: 'absolute',
    top: 6,
    width: 52,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '34deg' }],
  },
  contactX: {
    position: 'absolute',
    left: 46,
    top: 0,
    width: 10,
    height: 10,
    borderWidth: 1,
    backgroundColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  vertical: {
    width: 4,
    height: 72,
    borderRadius: 1,
    borderWidth: 0,
  },
  muzzleFlash: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  tracer: {
    position: 'absolute',
    left: 10,
    top: 5,
    width: 70,
    height: 1.5,
    borderRadius: 1,
  },
  ringOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  ringInner: {
    position: 'absolute',
    left: 5,
    top: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  crescent: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    backgroundColor: 'transparent',
    transform: [{ rotate: '-20deg' }],
  },
  thread: {
    width: 78,
    height: 1.5,
    borderRadius: 1,
    transform: [{ rotate: '-8deg' }],
  },
  threadAlt: {
    marginTop: 5,
    width: 64,
    transform: [{ rotate: '6deg' }],
  },
  focusPoly: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  ray: {
    position: 'absolute',
    left: 12,
    top: 6,
    width: 58,
    height: 1.5,
    borderRadius: 1,
    transform: [{ rotate: '-12deg' }],
  },
  rayB: {
    top: 10,
    width: 48,
    transform: [{ rotate: '10deg' }],
  },
  glyph: {
    width: 16,
    height: 16,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
});
