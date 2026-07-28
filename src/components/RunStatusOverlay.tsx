import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RunOverlay from './runField/RunOverlay';
import FieldPlate from './runField/FieldPlate';
import FieldMetricStrip from './runField/FieldMetricStrip';
import type { FieldMetricItem } from './runField/FieldMetricStrip';
import { RUN_FIELD, type RunFieldTone } from '../theme/runFieldTokens';
import { useRun } from '../context/RunContext';
import type { TerminalTheme } from '../types/theme';
import {
  RUN_STATUS_CATEGORY_LABELS,
  buildRunStatusSnapshot,
  groupRunStatusEntries,
} from '../utils/runStatusSnapshot';
import type { RunStatusCategory, RunStatusEntry } from '../utils/runStatusSnapshot';
import { RESONANCE_SYSTEM_ACTIVE } from '../data/featureFlags';

const CATEGORY_ORDER: RunStatusCategory[] = RESONANCE_SYSTEM_ACTIVE
  ? ['SECTOR', 'BOON', 'HAZARD', 'MACRO', 'ENVIRONMENT', 'RESONANCE']
  : ['SECTOR', 'BOON', 'HAZARD', 'MACRO', 'ENVIRONMENT'];

const CATEGORY_TONE: Record<RunStatusCategory, RunFieldTone> = {
  SECTOR: 'neutral',
  BOON: 'mint',
  HAZARD: 'danger',
  MACRO: 'neutral',
  ENVIRONMENT: 'occult',
  RESONANCE: 'occult',
};

interface RunStatusOverlayProps {
  visible: boolean;
  theme: TerminalTheme;
  accentColor?: string;
  onClose: () => void;
  combatMode?: boolean;
}

function resourcePercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((current / max) * 100);
}

function CategoryBlock({
  category,
  entries,
  bodyFont,
  bodyLine,
  labelFont,
  labelLine,
  columnStyle,
}: {
  category: RunStatusCategory;
  entries: RunStatusEntry[];
  bodyFont: number;
  bodyLine: number;
  labelFont: number;
  labelLine: number;
  columnStyle: object;
}): React.JSX.Element {
  return (
    <FieldPlate
      density="wash"
      tone={CATEGORY_TONE[category]}
      brackets={false}
      style={[styles.categoryPlate, columnStyle]}
      contentStyle={styles.categoryContent}
    >
      <Text
        style={[
          styles.categoryLabel,
          { fontSize: labelFont, lineHeight: labelLine },
        ]}
      >
        {RUN_STATUS_CATEGORY_LABELS[category].toUpperCase()}
      </Text>
      {entries.map((entry) => (
        <View key={entry.id} style={styles.entry}>
          <Text
            style={[
              styles.entryLabel,
              { fontSize: bodyFont, lineHeight: bodyLine },
            ]}
          >
            {entry.label}
          </Text>
          <Text
            style={[
              styles.entryDescription,
              { fontSize: bodyFont - 1, lineHeight: bodyLine - 1 },
            ]}
          >
            {entry.description}
          </Text>
        </View>
      ))}
    </FieldPlate>
  );
}

export default function RunStatusOverlay({
  visible,
  theme: _theme,
  accentColor = RUN_FIELD.mint,
  onClose,
  combatMode = false,
}: RunStatusOverlayProps): React.JSX.Element {
  const { runState, activeIncursion } = useRun();

  const vitals = useMemo<FieldMetricItem[]>(() => {
    const healthPct = resourcePercent(runState.soulAnchorIntegrity, runState.maxSoulAnchor);
    const depth = activeIncursion.currentDepth ?? 1;
    return [
      { label: 'Health', value: `${healthPct}%`, accent: healthPct > 40, danger: healthPct <= 40 },
      { label: 'Depth', value: `${depth}` },
    ];
  }, [activeIncursion.currentDepth, runState.maxSoulAnchor, runState.soulAnchorIntegrity]);

  const categories = useMemo(() => {
    const entries = buildRunStatusSnapshot(activeIncursion);
    const grouped = groupRunStatusEntries(entries);
    return CATEGORY_ORDER
      .map((category) => ({ category, entries: grouped[category] }))
      .filter((block) => block.entries.length > 0);
  }, [activeIncursion]);

  const bodyFont = combatMode ? RUN_FIELD.type.body : RUN_FIELD.type.secondary;
  const bodyLine = bodyFont + 5;
  const labelFont = RUN_FIELD.type.eyebrow;
  const labelLine = labelFont + 4;

  return (
    <RunOverlay
      visible={visible}
      title="OPERATIVE DOSSIER"
      onClose={onClose}
      combatMode={combatMode}
      accentColor={accentColor}
      maxWidth={combatMode ? 640 : 520}
      width={combatMode ? '88%' : '92%'}
      contentPadding={combatMode ? 20 : 18}
      bodyStyle={styles.body}
    >
      <FieldMetricStrip items={vitals} style={styles.vitalsStrip} />

      <View style={styles.categoryHost}>
        {categories.length === 0 ? (
          <Text style={[styles.emptyState, { fontSize: bodyFont, lineHeight: bodyLine }]}>
            No active buffs, debuffs, or boons. Sector conditions nominal.
          </Text>
        ) : (
          <View style={styles.categoryGrid}>
            {categories.map(({ category, entries }) => (
              <CategoryBlock
                key={category}
                category={category}
                entries={entries}
                bodyFont={bodyFont}
                bodyLine={bodyLine}
                labelFont={labelFont}
                labelLine={labelLine}
                columnStyle={styles.categoryColumn}
              />
            ))}
          </View>
        )}
      </View>
    </RunOverlay>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
    paddingBottom: 4,
  },
  vitalsStrip: {
    flexShrink: 0,
  },
  categoryHost: {
    flexGrow: 0,
    flexShrink: 1,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryColumn: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 210,
  },
  categoryPlate: {
    marginBottom: 0,
  },
  categoryContent: {
    // Override FieldPlate flex:1 so wash plates size to their copy.
    flexGrow: 0,
    flexBasis: 'auto',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  categoryLabel: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: RUN_FIELD.textSecondary,
  },
  entry: {
    gap: 4,
  },
  entryLabel: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: RUN_FIELD.text,
  },
  entryDescription: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '500',
    letterSpacing: 0.15,
    color: RUN_FIELD.textSecondary,
  },
  emptyState: {
    fontFamily: RUN_FIELD.mono,
    fontWeight: '500',
    letterSpacing: 0.2,
    color: RUN_FIELD.textSecondary,
    paddingVertical: 8,
  },
});
