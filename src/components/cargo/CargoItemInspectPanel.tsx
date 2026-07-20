import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import type { CargoItemInspectInfo } from '../../utils/cargoItemInspect';
import { OTT } from '../../constants/occultTacticalTerminalTheme';

export interface CargoItemInspectAnchor {
  /** Window coordinates from measureInWindow. */
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CargoItemInspectPanelProps {
  info: CargoItemInspectInfo;
  anchor: CargoItemInspectAnchor;
  /** Subtract when rendering inside a measured parent (board pageX/pageY). */
  originOffset?: { x: number; y: number };
  accentColor?: string;
}

const PANEL_WIDTH = 220;
const PANEL_GAP = 10;
const SCREEN_PAD = 12;
const ESTIMATED_HEIGHT = 168;

/**
 * Extraction-style item inspect card — floats beside the hovered sprite.
 * Flips to the left when the right side would clip off-screen.
 * Hover-only: parent clears this when the cursor leaves the item.
 */
export default function CargoItemInspectPanel({
  info,
  anchor,
  originOffset = { x: 0, y: 0 },
  accentColor = OTT.terminalGreenMuted,
}: CargoItemInspectPanelProps): React.JSX.Element {
  const layout = useMemo(() => {
    const { width: screenW, height: screenH } = Dimensions.get('window');
    const preferRight = anchor.x + anchor.width + PANEL_GAP + PANEL_WIDTH + SCREEN_PAD <= screenW;
    const windowLeft = preferRight
      ? anchor.x + anchor.width + PANEL_GAP
      : Math.max(SCREEN_PAD, anchor.x - PANEL_GAP - PANEL_WIDTH);
    const idealTop = anchor.y + anchor.height / 2 - ESTIMATED_HEIGHT / 2;
    const windowTop = Math.max(
      SCREEN_PAD,
      Math.min(idealTop, screenH - ESTIMATED_HEIGHT - SCREEN_PAD),
    );
    return {
      left: windowLeft - originOffset.x,
      top: windowTop - originOffset.y,
      side: preferRight ? 'right' as const : 'left' as const,
    };
  }, [anchor.height, anchor.width, anchor.x, anchor.y, originOffset.x, originOffset.y]);

  const stackLine = info.stackable
    ? `STACK  ${info.quantity}/${info.stackCap}`
    : info.quantity > 1
      ? `QTY  x${info.quantity}`
      : null;
  const valueLine = info.quantity > 1
    ? `VALUE  ${info.unitValue} ea · ${info.unitValue * info.quantity} total`
    : `VALUE  ${info.unitValue}`;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.panel,
        {
          left: layout.left,
          top: layout.top,
          borderColor: accentColor,
        },
      ]}
    >
      <View
        style={[
          styles.sideTick,
          layout.side === 'right' ? styles.tickLeft : styles.tickRight,
          { borderColor: accentColor },
        ]}
      />
      <Text style={[styles.name, { color: accentColor }]} numberOfLines={2}>
        {info.name.toUpperCase()}
      </Text>
      {(info.rarityLabel || info.categoryLabel) ? (
        <Text style={styles.meta} numberOfLines={1}>
          {[info.rarityLabel, info.categoryLabel].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      <Text style={styles.body}>{info.description}</Text>
      {info.sourceHint ? (
        <Text style={styles.source} numberOfLines={2}>{info.sourceHint}</Text>
      ) : null}
      <View style={styles.footer}>
        {stackLine ? <Text style={styles.footerLine}>{stackLine}</Text> : null}
        <Text style={styles.footerLine}>{valueLine}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    width: PANEL_WIDTH,
    zIndex: 80,
    borderWidth: 1,
    backgroundColor: 'rgba(6, 10, 12, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 4,
  },
  sideTick: {
    position: 'absolute',
    top: 16,
    width: 8,
    height: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(6, 10, 12, 0.94)',
    transform: [{ rotate: '45deg' }],
  },
  tickLeft: {
    left: -5,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  tickRight: {
    right: -5,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  name: {
    fontFamily: OTT.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  meta: {
    fontFamily: OTT.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: OTT.warningAmber,
  },
  body: {
    fontFamily: OTT.mono,
    fontSize: 9,
    lineHeight: 13,
    color: OTT.textPrimary,
    marginTop: 2,
  },
  source: {
    fontFamily: OTT.mono,
    fontSize: 8,
    lineHeight: 11,
    color: OTT.textMuted,
  },
  footer: {
    marginTop: 4,
    paddingTop: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OTT.borderMuted,
    gap: 2,
  },
  footerLine: {
    fontFamily: OTT.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: OTT.textSecondary,
  },
});
