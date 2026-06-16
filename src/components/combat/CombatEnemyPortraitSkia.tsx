import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import AnimatedEnemySprite from './AnimatedEnemySprite';
import type { EnemyPortraitGlow, EnemyIntentShimmer, EnemyTurnPhase } from '../../utils/combatTelemetryFormat';
import { enemySpriteStyles } from './CombatEnemyIntentShimmer';

const GLOW_TINT: Record<Exclude<EnemyPortraitGlow, 'none'>, string> = {
  'player-selected': '#f8fafc',
  'enemy-attacking': '#ef4444',
  'enemy-charging': '#fde68a',
};

const GLOW_SCALE: Record<Exclude<EnemyPortraitGlow, 'none'>, number> = {
  'player-selected': 1.05,
  'enemy-attacking': 1.05,
  'enemy-charging': 1.09,
};

const GLOW_OPACITY: Record<Exclude<EnemyPortraitGlow, 'none'>, number> = {
  'player-selected': 0.3,
  'enemy-attacking': 0.3,
  'enemy-charging': 0.38,
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
}: CombatEnemyPortraitSkiaProps): React.JSX.Element {
  const glowTint = glow !== 'none' ? GLOW_TINT[glow] : null;
  const glowScale = glow !== 'none' ? GLOW_SCALE[glow] : 1.05;
  const glowOpacity = glow !== 'none' ? GLOW_OPACITY[glow] : 0.3;
  const resolvedAttackSource = attackSource ?? source;
  const isAttackGlow = glow === 'enemy-attacking';
  const idlePortraitGlow = glow !== 'none' && !isAttackGlow ? glow : null;

  return (
    <View style={styles.root} pointerEvents="none" collapsable={false}>
      {idlePortraitGlow && glowTint ? (
        <View style={styles.glowDuplicate} pointerEvents="none">
          <Image
            source={source}
            resizeMode="contain"
            style={[
              enemySpriteStyles.enemySprite,
              {
                tintColor: glowTint,
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
        </View>
      ) : null}
      <View style={styles.enemySpriteStack} pointerEvents="none">
        <AnimatedEnemySprite
          idleSource={source}
          attackSource={resolvedAttackSource}
          turnPhase={turnPhase}
          backlineDashSeq={backlineDashSeq}
          isBacklineDashing={isBacklineDashing}
          enableLocalMotion={false}
          intentShimmer={intentShimmer}
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
  enemySpriteStack: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  glowDuplicate: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
