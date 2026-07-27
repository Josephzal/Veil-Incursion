import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import AnimatedEnemySprite from './AnimatedEnemySprite';
import type { EnemyPortraitGlow, EnemyIntentShimmer, EnemyTurnPhase } from '../../utils/combatTelemetryFormat';
import { enemySpriteStyles } from './CombatEnemyIntentShimmer';

const GLOW_TINT: Record<Exclude<EnemyPortraitGlow, 'none'>, string> = {
  'player-selected': '#f8fafc',
  'enemy-attacking': '#ef4444',
  'enemy-charging': '#fde68a',
  'fracture-breach': '#22d3ee',
};

const GLOW_SCALE: Record<Exclude<EnemyPortraitGlow, 'none'>, number> = {
  'player-selected': 1.05,
  'enemy-attacking': 1.05,
  'enemy-charging': 1.09,
  'fracture-breach': 1.1,
};

const GLOW_OPACITY: Record<Exclude<EnemyPortraitGlow, 'none'>, number> = {
  'player-selected': 0.3,
  'enemy-attacking': 0.3,
  'enemy-charging': 0.38,
  'fracture-breach': 0.55,
};

interface CombatEnemyPortraitSkiaProps {
  source: ImageSourcePropType;
  attackSource?: ImageSourcePropType;
  turnPhase?: EnemyTurnPhase | null;
  backlineDashSeq?: number;
  isBacklineDashing?: boolean;
  glow: EnemyPortraitGlow;
  intentShimmer?: EnemyIntentShimmer | null;
  isEnraged?: boolean;
  /** Thrall Undying — desaturated body + occult core reveal. */
  isSlumped?: boolean;
}

/** Portrait art with idle/attack crossfade synced to CombatEnemyAnchorMotion. */
export default function CombatEnemyPortraitSkia({
  source,
  attackSource,
  turnPhase = null,
  backlineDashSeq = 0,
  isBacklineDashing = false,
  glow,
  intentShimmer = null,
  isEnraged = false,
  isSlumped = false,
}: CombatEnemyPortraitSkiaProps): React.JSX.Element {
  const glowTint = glow !== 'none' ? GLOW_TINT[glow] : null;
  const glowScale = glow !== 'none' ? GLOW_SCALE[glow] : 1.05;
  const glowOpacity = glow !== 'none' ? GLOW_OPACITY[glow] : 0.3;
  const resolvedAttackSource = attackSource ?? source;
  const isAttackGlow = glow === 'enemy-attacking';
  const idlePortraitGlow = glow !== 'none' && !isAttackGlow ? glow : null;

  return (
    <View style={[styles.root, styles.pointerLock]} collapsable={false}>
      {idlePortraitGlow && glowTint ? (
        <View style={[styles.glowDuplicate, styles.pointerLock]}>
          <Image
            source={source}
            resizeMode="contain"
            tintColor={glowTint}
            style={[
              enemySpriteStyles.enemySprite,
              {
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
        </View>
      ) : null}
      <View
        style={[
          styles.enemySpriteStack,
          styles.pointerLock,
          isSlumped ? styles.slumpedSprite : null,
        ]}
      >
        <AnimatedEnemySprite
          idleSource={source}
          attackSource={resolvedAttackSource}
          turnPhase={turnPhase}
          backlineDashSeq={backlineDashSeq}
          isBacklineDashing={isBacklineDashing}
          enableLocalMotion={false}
          intentShimmer={isSlumped ? null : intentShimmer}
          isEnraged={isEnraged}
          attackGlow={
            isAttackGlow
              ? {
                  tint: GLOW_TINT['enemy-attacking'],
                  opacity: GLOW_OPACITY['enemy-attacking'],
                  scale: GLOW_SCALE['enemy-attacking'],
                }
              : null
          }
        />
        {isSlumped ? (
          <View style={styles.slumpCore} pointerEvents="none">
            <View style={styles.slumpCoreInner} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  pointerLock: {
    pointerEvents: 'none',
  },
  enemySpriteStack: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  slumpedSprite: {
    opacity: 0.55,
  },
  slumpCore: {
    position: 'absolute',
    bottom: '38%',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(98, 230, 165, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(196, 90, 174, 0.22)',
  },
  slumpCoreInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C45AAE',
    opacity: 0.9,
  },
  glowDuplicate: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
