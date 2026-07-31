/**
 * Development-only Longsword pose alignment overlay.
 * Enabled via PLAYER_POSE_ALIGN_DEBUG — not player-facing combat UI.
 */

import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type {
  ActorGroundAnchor,
  RegisteredPoseKind,
  RegisteredPoseLayout,
} from '../../utils/combatPoseRegistration';
import {
  cyclePoseAlignDebugForcedPose,
  getPoseAlignDebugForcedPose,
  subscribePoseAlignDebugForcedPose,
} from '../../utils/combatPoseRegistration';

interface PlayerPoseAlignOverlayProps {
  box: { width: number; height: number };
  idle: RegisteredPoseLayout;
  attack: RegisteredPoseLayout;
  anchor: ActorGroundAnchor;
  /** Pose currently visible (forced or live crossfade estimate). */
  activePose: RegisteredPoseKind;
}

export default function PlayerPoseAlignOverlay({
  box,
  idle,
  attack,
  anchor,
  activePose,
}: PlayerPoseAlignOverlayProps): React.JSX.Element | null {
  const [forced, setForced] = useState(getPoseAlignDebugForcedPose);
  useEffect(() => subscribePoseAlignDebugForcedPose(setForced), []);

  if (box.width <= 0 || box.height <= 0) return null;

  const layout = activePose === 'attack' ? attack : idle;
  const bodyH = layout.renderedBodyHeight;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Shared battlefield ground line */}
      <View
        style={[
          styles.groundLine,
          { top: anchor.y - 0.5, width: box.width },
        ]}
        pointerEvents="none"
      />
      {/* Fixed root / ground anchor */}
      <View
        style={[
          styles.anchorCross,
          { left: anchor.x - 6, top: anchor.y - 6 },
        ]}
        pointerEvents="none"
      />
      {/* Current pose planted foot */}
      <View
        style={[
          styles.footDot,
          { left: layout.footX - 4, top: layout.footY - 4 },
        ]}
        pointerEvents="none"
      />
      {/* Body top / bottom guides */}
      <View
        style={[
          styles.bodyGuide,
          { top: layout.bodyTopY, width: box.width },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.bodyGuide,
          styles.bodyGuideBottom,
          { top: layout.bodyBottomY, width: box.width },
        ]}
        pointerEvents="none"
      />
      {/* Rendered pose bounds */}
      <View
        style={[
          styles.poseBounds,
          {
            left: layout.left,
            top: layout.top,
            width: layout.width,
            height: layout.height,
          },
        ]}
        pointerEvents="none"
      />
      {/* Readout */}
      <View style={styles.readout} pointerEvents="none">
        <Text style={styles.readoutText}>{layout.poseId}</Text>
        <Text style={styles.readoutText}>
          {`bodyH ${bodyH.toFixed(1)}px  foot (${layout.footX.toFixed(1)}, ${layout.footY.toFixed(1)})`}
        </Text>
        <Text style={styles.readoutText}>
          {`Δfoot vs idle X=${(layout.footX - idle.footX).toFixed(2)} Y=${(layout.footY - idle.footY).toFixed(2)}`}
        </Text>
        <Text style={styles.readoutText}>
          {`forced=${forced ?? 'auto'}  active=${activePose}`}
        </Text>
      </View>
      {/* Cycle idle → attack → auto */}
      <Pressable
        style={styles.cycleBtn}
        onPress={() => cyclePoseAlignDebugForcedPose()}
        accessibilityLabel="Cycle Longsword pose alignment debug"
      >
        <Text style={styles.cycleBtnText}>
          {forced == null ? 'POSE: AUTO' : `POSE: ${forced.toUpperCase()}`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  groundLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: 'rgba(0, 255, 180, 0.85)',
  },
  anchorCross: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 180, 1)',
    backgroundColor: 'rgba(0, 255, 180, 0.25)',
  },
  footDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 80, 80, 0.95)',
  },
  bodyGuide: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: 'rgba(255, 220, 0, 0.7)',
  },
  bodyGuideBottom: {
    backgroundColor: 'rgba(255, 160, 0, 0.7)',
  },
  poseBounds: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(120, 180, 255, 0.55)',
    borderStyle: Platform.OS === 'web' ? 'dashed' : 'solid',
  },
  readout: {
    position: 'absolute',
    left: 4,
    top: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    maxWidth: 280,
  },
  readoutText: {
    color: '#9ff5d0',
    fontSize: 9,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    lineHeight: 12,
  },
  cycleBtn: {
    position: 'absolute',
    right: 4,
    top: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 40, 32, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 180, 0.7)',
  },
  cycleBtnText: {
    color: '#9ff5d0',
    fontSize: 10,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    fontWeight: '700',
  },
});
