import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  TARGET_BRACKET_INSET_X,
  TARGET_BRACKET_INSET_Y,
} from './ui/TargetingBrackets';
import { NAMEPLATE_SILHOUETTE_GAP } from '../../data/combatEnemyNameplatePresentation';

interface EnemyEntityProps {
  /** Animated sprite subtree — breathing/motion applies here only. */
  sprite: React.ReactNode;
  vitals?: React.ReactNode;
  showVitals?: boolean;
}

/**
 * Static hostile shell — vitals overlay the upper sprite, matched to bracket width.
 */
export default function EnemyEntity({
  sprite,
  vitals,
  showVitals = false,
}: EnemyEntityProps): React.JSX.Element {
  return (
    <View style={styles.staticContainer}>
      <View style={styles.spriteSlot}>
        <View style={styles.spriteLift}>{sprite}</View>
        {showVitals && vitals ? (
          <View style={styles.nameplateOverlay} pointerEvents="none">
            {vitals}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  staticContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  spriteSlot: {
    width: '100%',
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    position: 'relative',
  },
  spriteLift: {
    width: '100%',
    height: '100%',
    opacity: 0.96,
  },
  /**
   * Same width as TargetingBrackets. The bracket frame is the shared silhouette
   * proxy for every hostile, so anchoring here normalises the plate-to-artwork
   * gap across small, wide, tall and irregular sprites without per-enemy values.
   * Reticle geometry is unaffected by this offset.
   */
  nameplateOverlay: {
    position: 'absolute',
    left: TARGET_BRACKET_INSET_X,
    right: TARGET_BRACKET_INSET_X,
    top: TARGET_BRACKET_INSET_Y,
    transform: [{ translateY: '-100%' }],
    marginTop: -NAMEPLATE_SILHOUETTE_GAP,
    zIndex: 24,
    elevation: 24,
    alignItems: 'stretch',
  },
});
