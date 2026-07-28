import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../../../components/HapticPressable';
import { COMBAT_HUD_TYPE } from '../../../constants/combatHudTypography';
import { OTT, OTT_LAYOUT } from '../../../constants/occultTacticalTerminalTheme';

export interface CombatQuestLogInfo {
  contractTitle: string;
  sponsorLabel: string;
  objectiveText: string;
  bonusText?: string | null;
  rewardText?: string | null;
  difficultyLabel?: string | null;
  operationTitle?: string | null;
  operationBrief?: string | null;
  sectorLabel?: string | null;
}

interface CombatMissionReadoutProps {
  depthLabel: string;
  sectorLabel: string;
  objectiveLabel: string | null;
  /** Contract / operation brief shown when the objective is toggled open. */
  questLog?: CombatQuestLogInfo | null;
}

/**
 * Top-left mission readout. Tapping OBJECTIVE opens a compact quest-log panel
 * with active contract info; tapping again closes it (WoW-style quest log).
 */
export default function CombatMissionReadout({
  depthLabel,
  sectorLabel,
  objectiveLabel,
  questLog = null,
}: CombatMissionReadoutProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const objectiveLine = `> ${objectiveLabel ?? 'Survive the encounter'}`;

  return (
    <View style={[styles.host, open ? styles.hostOpen : null]} pointerEvents="box-none">
      <Text style={styles.depth} numberOfLines={1}>
        {depthLabel}
      </Text>
      <Text style={styles.sector} numberOfLines={1}>
        {sectorLabel}
      </Text>
      <View style={styles.rule} />

      <HapticPressable
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Close contract quest log' : 'Open contract quest log'}
        style={({ pressed }) => [
          styles.objectiveHit,
          open ? styles.objectiveHitOpen : null,
          pressed ? styles.objectiveHitPressed : null,
        ]}
      >
        <View style={styles.objectiveHeaderRow}>
          <Text style={styles.objectiveHeader}>OBJECTIVE</Text>
          <Text style={[styles.chevron, open ? styles.chevronOpen : null]}>
            {open ? '▾' : '▸'}
          </Text>
        </View>
        <Text style={styles.objective} numberOfLines={open ? 3 : 2}>
          {objectiveLine}
        </Text>
      </HapticPressable>

      {open ? (
        <View style={styles.logPanel} pointerEvents="auto">
          <Text style={styles.logEyebrow}>CONTRACT LOG // ACTIVE MANDATE</Text>

          {questLog ? (
            <>
              <LogBlock label="CONTRACT" value={questLog.contractTitle} accent />
              <LogBlock label="SPONSOR" value={questLog.sponsorLabel} />
              {questLog.difficultyLabel ? (
                <LogBlock label="RISK" value={questLog.difficultyLabel} />
              ) : null}
              <LogBlock label="OBJECTIVE" value={questLog.objectiveText} body />
              {questLog.bonusText ? (
                <LogBlock label="BONUS" value={questLog.bonusText} body />
              ) : null}
              {questLog.rewardText ? (
                <LogBlock label="PAYOUT" value={questLog.rewardText} />
              ) : null}
              {questLog.operationTitle ? (
                <LogBlock label="OPERATION" value={questLog.operationTitle} accent />
              ) : null}
              {questLog.operationBrief ? (
                <LogBlock label="BRIEF" value={questLog.operationBrief} body />
              ) : null}
              {questLog.sectorLabel ? (
                <LogBlock label="SECTOR" value={questLog.sectorLabel} />
              ) : null}
            </>
          ) : (
            <Text style={styles.logEmpty}>
              No sponsor mandate locked for this descent. Survive the encounter and extract.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function LogBlock({
  label,
  value,
  accent = false,
  body = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  body?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.logBlock}>
      <Text style={styles.logLabel}>{label}</Text>
      <Text
        style={[
          styles.logValue,
          accent ? styles.logValueAccent : null,
          body ? styles.logValueBody : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: OTT_LAYOUT.missionTop,
    left: OTT_LAYOUT.missionLeft,
    zIndex: 26,
    maxWidth: '28%',
    minWidth: 168,
    gap: 2,
    paddingHorizontal: 2,
  },
  hostOpen: {
    maxWidth: 320,
    zIndex: 40,
  },
  depth: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.title,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: OTT.textPrimary,
  },
  sector: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.label,
    fontWeight: '600',
    letterSpacing: 1,
    color: OTT.textSecondary,
    textTransform: 'uppercase',
  },
  rule: {
    marginTop: 5,
    marginBottom: 3,
    height: StyleSheet.hairlineWidth,
    backgroundColor: OTT.borderSubtle,
    width: '72%',
  },
  objectiveHit: {
    gap: 2,
    paddingVertical: 2,
    paddingRight: 4,
  },
  objectiveHitOpen: {
    borderLeftWidth: 1,
    borderLeftColor: OTT.cyanSelect,
    paddingLeft: 6,
  },
  objectiveHitPressed: {
    opacity: 0.82,
  },
  objectiveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  objectiveHeader: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: OTT.terminalGreenMuted,
  },
  chevron: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '700',
    color: OTT.cyanSelect,
  },
  chevronOpen: {
    color: OTT.terminalGreen,
  },
  objective: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.title,
    fontWeight: '600',
    letterSpacing: 0.35,
    color: OTT.textPrimary,
    lineHeight: COMBAT_HUD_TYPE.lineLabel + 2,
  },
  logPanel: {
    marginTop: 8,
    backgroundColor: OTT.deepPanel,
    borderWidth: 1,
    borderColor: OTT.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
    maxWidth: 320,
    minWidth: 220,
    shadowColor: OTT.cyanSelect,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  logEyebrow: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: OTT.cyanSelect,
  },
  logBlock: {
    gap: 2,
  },
  logLabel: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: OTT.textMuted,
  },
  logValue: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '700',
    letterSpacing: 0.35,
    color: OTT.textPrimary,
  },
  logValueAccent: {
    color: OTT.terminalGreenMuted,
  },
  logValueBody: {
    fontWeight: '500',
    lineHeight: COMBAT_HUD_TYPE.lineBody,
    color: OTT.textSecondary,
  },
  logEmpty: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '500',
    letterSpacing: 0.3,
    color: OTT.textSecondary,
    lineHeight: COMBAT_HUD_TYPE.lineBody,
  },
});
