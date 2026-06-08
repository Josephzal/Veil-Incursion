import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IncursionNode } from '../types/game';

interface DescentPipelineHUDProps {
  depth: number;
  currentEncounterIndex: number;
  encounterPath: IncursionNode[];
  accentColor?: string;
  borderColor?: string;
  mutedColor?: string;
  interactive?: boolean;
  selectedNodeIndex?: number | null;
  onNodePress?: (index: number) => void;
  compact?: boolean;
  hideLabel?: boolean;
  showExtract?: boolean;
  onExtractPress?: () => void;
}

const NODE_ICON: Record<string, string> = {
  NARRATIVE_EVENT: '◆',
  STANDARD_COMBAT: '⚔',
  ELITE_COMBAT: '☠',
  BOSS_COMBAT: '⬡',
  SANCTUARY: '+',
  BLACK_MARKET: '◈',
};

export default function DescentPipelineHUD({
  depth,
  currentEncounterIndex,
  encounterPath,
  accentColor = '#00ff33',
  borderColor = '#334155',
  mutedColor = '#64748b',
  interactive = false,
  selectedNodeIndex = null,
  onNodePress,
  compact = true,
  hideLabel = false,
  showExtract = false,
  onExtractPress,
}: DescentPipelineHUDProps): React.JSX.Element | null {
  if (encounterPath.length === 0) return null;

  const renderNodeIcon = (node: IncursionNode) => {
    const isCurrent = node.index === currentEncounterIndex;
    const isSelected = selectedNodeIndex === node.index;
    const isComplete = node.isCompleted;
    const isLocked = node.index > currentEncounterIndex;
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
      {!hideLabel ? (
        <View style={styles.headerRow}>
          <View style={styles.headerLabelWrap}>
            <Text style={[styles.depthLabel, { color: mutedColor }]}>
              VEIL DESCENT // DEPTH {depth} // ENCOUNTER {currentEncounterIndex + 1}/10
            </Text>
          </View>
          {showExtract ? (
            <Pressable
              onPress={onExtractPress}
              style={[styles.extractBtn, { borderColor }]}
              accessibilityRole="button"
              accessibilityLabel="End run and return to identity badge"
            >
              <Text style={[styles.extractBtnText, { color: mutedColor }]}>[ EXTRACT ]</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={styles.pipeline}>
        {encounterPath.flatMap((node, index) => {
          const items: React.JSX.Element[] = [
            <View key={node.id} style={styles.nodeCell}>
              {renderNodeIcon(node)}
            </View>,
          ];

          if (index < encounterPath.length - 1) {
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
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  rootExpanded: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 9,
    minHeight: 24,
  },
  headerLabelWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depthLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1,
    textAlign: 'center',
  },
  extractBtn: {
    flexShrink: 0,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#0a0b0f',
  },
  extractBtnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
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
