import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IncursionNode } from '../types/game';

interface DescentPipelineHUDProps {
  tier: number;
  currentNodeIndex: number;
  tierNodes: IncursionNode[];
  accentColor?: string;
  borderColor?: string;
  mutedColor?: string;
  interactive?: boolean;
  selectedNodeIndex?: number | null;
  onNodePress?: (index: number) => void;
  compact?: boolean;
  hideLabel?: boolean;
}

const NODE_ICON: Record<string, string> = {
  NARRATIVE_EVENT: '◆',
  STANDARD_COMBAT: '⚔',
  ELITE_COMBAT: '☠',
  BOSS_COMBAT: '⬡',
  SANCTUARY: '+',
};

export default function DescentPipelineHUD({
  tier,
  currentNodeIndex,
  tierNodes,
  accentColor = '#00ff33',
  borderColor = '#334155',
  mutedColor = '#64748b',
  interactive = false,
  selectedNodeIndex = null,
  onNodePress,
  compact = true,
  hideLabel = false,
}: DescentPipelineHUDProps): React.JSX.Element | null {
  if (tierNodes.length === 0) return null;

  const renderNode = (node: IncursionNode) => {
    const isCurrent = node.index === currentNodeIndex;
    const isSelected = selectedNodeIndex === node.index;
    const isComplete = node.isCompleted;
    const isLocked = node.index > currentNodeIndex;
    const isSelectable = interactive && isCurrent && !isComplete;
    const icon = NODE_ICON[node.type] ?? '●';
    const nodeSize = compact ? 28 : 36;

    const iconShell = (
      <View
        style={[
          styles.nodeIcon,
          {
            width: nodeSize,
            height: nodeSize,
            borderColor: isSelected || isCurrent ? accentColor : isComplete ? accentColor : borderColor,
            backgroundColor: isSelected || isCurrent ? `${accentColor}22` : isComplete ? `${accentColor}11` : '#0a0b0f',
            opacity: isLocked ? 0.35 : 1,
          },
        ]}
      >
        <Text style={[styles.iconText, { color: isCurrent || isComplete || isSelected ? accentColor : mutedColor, fontSize: compact ? 11 : 13 }]}>
          {isComplete ? '✓' : icon}
        </Text>
      </View>
    );

    return (
      <View key={node.id} style={styles.nodeWrap}>
        {isSelectable && onNodePress ? (
          <Pressable onPress={() => onNodePress(node.index)} hitSlop={6}>
            {iconShell}
          </Pressable>
        ) : (
          iconShell
        )}
        {node.index < tierNodes.length - 1 && (
          <View
            style={[
              styles.connector,
              { backgroundColor: isComplete ? accentColor : borderColor, width: compact ? 10 : 14 },
            ]}
          />
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, compact ? styles.rootCompact : styles.rootExpanded, { borderColor }]}>
      {!hideLabel && (
        <Text style={[styles.tierLabel, { color: mutedColor }]}>
          VEIL DESCENT // TIER {tier} // NODE {currentNodeIndex + 1}/7
        </Text>
      )}
      <View style={styles.pipeline}>{tierNodes.map(renderNode)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    backgroundColor: '#050608',
  },
  rootCompact: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  rootExpanded: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 0,
  },
  tierLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  pipeline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nodeIcon: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  connector: {
    height: 2,
    marginHorizontal: 2,
  },
});
