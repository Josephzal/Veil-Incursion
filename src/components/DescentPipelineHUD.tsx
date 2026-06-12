import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { IncursionNode } from '../types/game';
import { MAX_SECTOR_NODES } from '../types/sector';

const ICON_SIZE_COMPACT = 26;
const ICON_SIZE_EXPANDED = 30;
const CONNECTOR_WIDTH = 10;

interface DescentPipelineHUDProps {
  sectorTier: number;
  nodesCleared: number;
  resonancePercent: number;
  attunementCurrent: number;
  attunementMax: number;
  currentEncounterIndex: number;
  encounterPath: IncursionNode[];
  accentColor?: string;
  borderColor?: string;
  mutedColor?: string;
  compact?: boolean;
  hideLabel?: boolean;
}

const NODE_ICON: Record<string, string> = {
  NARRATIVE_EVENT: '◆',
  STANDARD_COMBAT: '⚔',
  ELITE_COMBAT: '☠',
  BOSS_COMBAT: '⬡',
  SANCTUARY: '+',
  BLACK_MARKET: '◈',
  EMERGENCY_EXTRACTION: '↗',
  SAFE_ANCHOR_EXTRACTION: '◎',
  MASTER_EXTRACTION_LINK: '★',
  RESOURCE_HARVEST: '◇',
};

export default function DescentPipelineHUD({
  sectorTier,
  nodesCleared,
  resonancePercent,
  attunementCurrent,
  attunementMax,
  currentEncounterIndex,
  encounterPath,
  accentColor = '#00ff33',
  borderColor = '#334155',
  mutedColor = '#64748b',
  compact = true,
  hideLabel = false,
}: DescentPipelineHUDProps): React.JSX.Element | null {
  if (encounterPath.length === 0) return null;

  const renderNodeIcon = (node: IncursionNode) => {
    const isCurrent = node.index === currentEncounterIndex;
    const isComplete = node.isCompleted;
    const isLocked = node.index > currentEncounterIndex;
    const icon = NODE_ICON[node.type] ?? '●';

    return (
      <View
        style={[
          styles.nodeIcon,
          compact ? styles.nodeIconCompact : styles.nodeIconExpanded,
          {
            borderColor: isCurrent ? accentColor : isComplete ? accentColor : borderColor,
            backgroundColor: isCurrent ? `${accentColor}22` : isComplete ? `${accentColor}11` : '#0a0b0f',
            opacity: isLocked ? 0.35 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.iconText,
            compact ? styles.iconTextCompact : styles.iconTextExpanded,
            { color: isCurrent || isComplete ? accentColor : mutedColor },
          ]}
        >
          {isComplete ? '✓' : icon}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.root, compact ? styles.rootCompact : styles.rootExpanded, { borderColor }]}>
      {!hideLabel ? (
        <View style={styles.headerRow}>
          <Text style={[styles.depthLabel, { color: mutedColor }]}>
            {`OPEN SECTOR T${sectorTier} // NODE ${nodesCleared}/${MAX_SECTOR_NODES} // ATT ${attunementCurrent}/${attunementMax}`}
          </Text>
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pipelineContent}
        style={styles.pipelineScroll}
      >
        {encounterPath.map((node, index) => (
          <React.Fragment key={node.id}>
            <View style={styles.nodeCell}>{renderNodeIcon(node)}</View>
            {index < encounterPath.length - 1 ? (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: node.isCompleted ? accentColor : borderColor },
                ]}
              />
            ) : null}
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignSelf: 'stretch',
    flexShrink: 0,
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
    justifyContent: 'center',
    marginBottom: 9,
    minHeight: 24,
  },
  depthLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1,
    textAlign: 'center',
  },
  pipelineScroll: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  pipelineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: ICON_SIZE_COMPACT + 4,
    paddingVertical: 2,
  },
  nodeCell: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nodeIcon: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeIconCompact: {
    width: ICON_SIZE_COMPACT,
    height: ICON_SIZE_COMPACT,
  },
  nodeIconExpanded: {
    width: ICON_SIZE_EXPANDED,
    height: ICON_SIZE_EXPANDED,
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
    width: CONNECTOR_WIDTH,
    height: 2,
    flexShrink: 0,
    marginHorizontal: 2,
  },
});
