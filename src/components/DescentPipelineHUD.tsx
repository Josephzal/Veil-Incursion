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

  const renderNodeIcon = (node: IncursionNode) => {
    const isCurrent = node.index === currentNodeIndex;
    const isSelected = selectedNodeIndex === node.index;
    const isComplete = node.isCompleted;
    const isLocked = node.index > currentNodeIndex;
    const isSelectable = interactive && isCurrent && !isComplete;
    const icon = NODE_ICON[node.type] ?? '●';

    const iconShell = (
      <View
        style={[
          styles.nodeIcon,
          compact ? styles.nodeIconCompact : styles.nodeIconExpanded,
          {
            borderColor: isSelected || isCurrent ? accentColor : isComplete ? accentColor : borderColor,
            backgroundColor: isSelected || isCurrent ? `${accentColor}22` : isComplete ? `${accentColor}11` : '#0a0b0f',
            opacity: isLocked ? 0.35 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.iconText,
            compact ? styles.iconTextCompact : styles.iconTextExpanded,
            { color: isCurrent || isComplete || isSelected ? accentColor : mutedColor },
          ]}
        >
          {isComplete ? '✓' : icon}
        </Text>
      </View>
    );

    if (isSelectable && onNodePress) {
      return (
        <Pressable onPress={() => onNodePress(node.index)} hitSlop={6}>
          {iconShell}
        </Pressable>
      );
    }

    return iconShell;
  };

  return (
    <View style={[styles.root, compact ? styles.rootCompact : styles.rootExpanded, { borderColor }]}>
      {!hideLabel && (
        <Text style={[styles.tierLabel, { color: mutedColor }]}>
          VEIL DESCENT // TIER {tier} // NODE {currentNodeIndex + 1}/7
        </Text>
      )}
      <View style={styles.pipeline}>
        {tierNodes.flatMap((node, index) => {
          const items: React.JSX.Element[] = [
            <View key={node.id} style={styles.nodeCell}>
              {renderNodeIcon(node)}
            </View>,
          ];

          if (index < tierNodes.length - 1) {
            items.push(
              <View
                key={`${node.id}-connector`}
                style={[
                  styles.connector,
                  { backgroundColor: node.isCompleted ? accentColor : borderColor },
                ]}
              />,
            );
          }

          return items;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: 1,
    backgroundColor: '#050608',
    overflow: 'hidden',
  },
  rootCompact: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rootExpanded: {
    paddingVertical: 14,
    paddingHorizontal: 16,
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
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nodeCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  nodeIcon: {
    aspectRatio: 1,
    width: '72%',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeIconCompact: {
    maxWidth: 28,
  },
  nodeIconExpanded: {
    maxWidth: 32,
  },
  iconText: {
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  iconTextCompact: {
    fontSize: 11,
  },
  iconTextExpanded: {
    fontSize: 12,
  },
  connector: {
    flex: 1,
    height: 2,
    alignSelf: 'center',
    minWidth: 2,
    maxWidth: 14,
    marginHorizontal: 1,
  },
});
