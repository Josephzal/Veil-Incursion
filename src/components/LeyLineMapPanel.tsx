import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DescentPipelineHUD from './DescentPipelineHUD';
import { IncursionNode, RunNodeType } from '../types/game';

const TERMINAL_ACCENT = '#00ff33';

const NODE_TYPE_LABEL: Record<RunNodeType, string> = {
  NARRATIVE_EVENT: 'NARRATIVE EVENT',
  STANDARD_COMBAT: 'COMBAT VECTOR',
  ELITE_COMBAT: 'ELITE CHECKPOINT',
  BOSS_COMBAT: 'REGION-PRIME BOSS',
  SANCTUARY: 'SANCTUARY ANCHOR',
  BLACK_MARKET: 'BLACK MARKET',
  EMERGENCY_EXTRACTION: 'EXTRACTION LINK',
  SAFE_ANCHOR_EXTRACTION: 'SAFE ANCHOR',
  MASTER_EXTRACTION_LINK: 'MASTER LINK',
  RESOURCE_HARVEST: 'RESOURCE NODE',
};

interface LeyLineMapPanelProps {
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
  onCommit: () => void;
}

export default function LeyLineMapPanel({
  sectorTier,
  nodesCleared,
  resonancePercent,
  attunementCurrent,
  attunementMax,
  currentEncounterIndex,
  encounterPath,
  accentColor = TERMINAL_ACCENT,
  borderColor = '#334155',
  mutedColor = '#64748b',
  onCommit,
}: LeyLineMapPanelProps): React.JSX.Element | null {
  const activeNode = encounterPath[currentEncounterIndex] ?? null;

  const nodeSummary = useMemo(() => {
    if (!activeNode) return null;
    return {
      label: NODE_TYPE_LABEL[activeNode.type],
      detail: activeNode.label,
    };
  }, [activeNode]);

  if (encounterPath.length === 0) return null;

  return (
    <View style={styles.root}>
      <View style={[styles.headerBar, { borderColor }]}>
        <Text style={[styles.headerTitle, { color: accentColor }]}>
          LEY-LINE VECTOR GRID SCAN
        </Text>
        <Text style={[styles.headerSub, { color: mutedColor }]}>
          SECTOR T{sectorTier} // NODE {nodesCleared} // RES {resonancePercent}%
        </Text>
      </View>

      <DescentPipelineHUD
        sectorTier={sectorTier}
        nodesCleared={nodesCleared}
        resonancePercent={resonancePercent}
        attunementCurrent={attunementCurrent}
        attunementMax={attunementMax}
        currentEncounterIndex={currentEncounterIndex}
        encounterPath={encounterPath}
        accentColor={accentColor}
        borderColor={borderColor}
        mutedColor={mutedColor}
        compact={false}
      />

      {nodeSummary && (
        <View style={[styles.readout, { borderColor }]}>
          <Text style={[styles.readoutLabel, { color: mutedColor }]}>ACTIVE VECTOR PROFILE</Text>
          <Text style={[styles.readoutType, { color: accentColor }]}>{nodeSummary.label}</Text>
          <Text style={[styles.readoutDetail, { color: mutedColor }]}>{nodeSummary.detail}</Text>
        </View>
      )}

      <Pressable
        onPress={onCommit}
        disabled={!activeNode}
        style={({ pressed }) => [
          styles.commitBtn,
          {
            borderColor: accentColor,
            opacity: !activeNode ? 0.4 : pressed ? 0.75 : 1,
            backgroundColor: pressed ? '#0d1a12' : '#0a0b0f',
          },
        ]}
      >
        <Text style={[styles.commitBtnText, { color: accentColor }]}>
          [ COMMIT VECTOR // DEPLOY ENCOUNTER {currentEncounterIndex + 1} ]
        </Text>
      </Pressable>

      <Text style={[styles.hint, { color: mutedColor }]}>
        Commit vector to deploy directly into combat or narrative layer.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    justifyContent: 'center',
  },
  headerBar: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    backgroundColor: '#050608',
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textAlign: 'center',
    marginBottom: 6,
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 1,
    textAlign: 'center',
  },
  readout: {
    borderWidth: 1,
    padding: 14,
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: '#0a0b0f',
  },
  readoutLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  readoutType: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  readoutDetail: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  commitBtn: {
    borderWidth: 2,
    paddingVertical: 16,
    alignItems: 'center',
  },
  commitBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  hint: {
    fontFamily: 'monospace',
    fontSize: 8,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 12,
    letterSpacing: 0.5,
  },
});
