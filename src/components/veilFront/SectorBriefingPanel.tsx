import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import { ProgressBar } from './VeilFrontUiPrimitives';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import { FACTION_DEFINITIONS } from '../../data/factions';
import { operationProgressPercent } from '../../data/worldStateHelpers';
import { anchorIdForSector, getSectorWorldTemplate } from '../../data/sectorWorldCatalog';
import { HUB_DATA_DIVIDER } from '../../styles/hubTerminalUi';
import type { CabalEmployerId, SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import {
  describeAnchorInRunPressure,
  formatOperationContributes,
  operationTypeChip,
} from '../../utils/veilFrontSectorUi';
import {
  describeEmployerPerks,
  employerSponsorLabel,
} from '../../utils/employerContractUi';
import { useWorldState } from '../../context/WorldStateContext';
import { viewShadow } from '../../utils/adaptiveStyles';

const ALL_EMPLOYERS: CabalEmployerId[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];
type BriefingTab = 'operation' | 'anchor' | 'contracts';

interface SectorBriefingPanelProps {
  theme: TerminalTheme;
  sector: SectorState;
  selectedEmployer: CabalEmployerId | null;
  onSelectEmployer: (employer: CabalEmployerId | null) => void;
  onRequestDeploy: () => void;
  runDisabled: boolean;
  launching: boolean;
}

function TypeChip({ label, accentColor }: { label: string; accentColor: string }) {
  const { scaleFont, scaleSpacing } = useVeilFrontLayout();
  return (
    <View style={[styles.typeChip, { borderColor: `${accentColor}55`, paddingHorizontal: scaleSpacing(6), paddingVertical: scaleSpacing(3), alignSelf: 'flex-start' }]}>
      <TerminalText size={scaleFont(6)} style={{ color: accentColor }}>
        {label}
      </TerminalText>
    </View>
  );
}

function ContributionRow({ label, color }: { label: string; color: string }) {
  const { scaleFont, scaleSpacing } = useVeilFrontLayout();
  return (
    <View style={[styles.contributionRow, { gap: scaleSpacing(5) }]}>
      <TerminalText size={scaleFont(6)} style={{ color }}>{'•'}</TerminalText>
      <TerminalText size={scaleFont(6.5)} style={[styles.contributionText, { color }]} selectable={false}>
        {label}
      </TerminalText>
    </View>
  );
}

function BriefingTabs({
  theme,
  activeTab,
  onSelectTab,
}: {
  theme: TerminalTheme;
  activeTab: BriefingTab;
  onSelectTab: (tab: BriefingTab) => void;
}) {
  const { scaleSpacing, scaleFont } = useVeilFrontLayout();
  const tabs: { id: BriefingTab; label: string }[] = [
    { id: 'operation', label: 'OPERATION' },
    { id: 'anchor', label: 'ANCHOR' },
    { id: 'contracts', label: 'CONTRACTS' },
  ];

  return (
    <View style={[styles.tabRow, { borderColor: `${theme.statusColor}20`, padding: scaleSpacing(3) }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <HapticPressable
            key={tab.id}
            onPress={() => onSelectTab(tab.id)}
            style={({ pressed }) => [
              styles.tab,
              {
                borderColor: isActive ? `${theme.statusColor}88` : 'transparent',
                backgroundColor: isActive ? `${theme.statusColor}18` : 'transparent',
                minHeight: scaleSpacing(32),
                paddingHorizontal: scaleSpacing(6),
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <TerminalText
              size={scaleFont(6.2)}
              letterSpacing={0.35}
              style={{ color: isActive ? theme.statusColor : theme.mutedColor, fontWeight: isActive ? '800' : '600' }}
            >
              {tab.label}
            </TerminalText>
          </HapticPressable>
        );
      })}
    </View>
  );
}

function OperationTabContent({ theme, sector }: { theme: TerminalTheme; sector: SectorState }) {
  const { scaleFont, scaleSize, scaleSpacing, descriptionLines, showOptionalCopy } = useVeilFrontLayout();
  const operationPct = operationProgressPercent(
    sector.activeOperation.progressCurrent,
    sector.activeOperation.progressRequired,
  );
  const contributes = formatOperationContributes(sector.activeOperation.contributionRules);

  return (
    <View style={[styles.tabBody, { gap: scaleSpacing(9) }]}>
      <TerminalText size={scaleFont(6)} letterSpacing={0.7} style={{ color: theme.statusColor, fontWeight: '700' }}>
        ACTIVE OPERATION
      </TerminalText>
      <TerminalText size={scaleFont(8.2)} style={[styles.wrapText, { color: theme.textColor, fontWeight: '800', lineHeight: scaleSize(11) }]}>
        {sector.activeOperation.title}
      </TerminalText>
      <TypeChip label={operationTypeChip(sector.activeOperation.objectiveKind)} accentColor={theme.statusColor} />
      {showOptionalCopy ? (
        <TerminalText
          size={scaleFont(6.8)}
          style={[styles.wrapText, { color: theme.mutedColor, lineHeight: scaleSize(11) }]}
          numberOfLines={descriptionLines}
        >
          {sector.activeOperation.description}
        </TerminalText>
      ) : null}
      <View style={{ gap: scaleSpacing(4) }}>
        <TerminalText size={scaleFont(6)} style={{ color: theme.mutedColor }}>
          {`Progress: ${operationPct}%`}
        </TerminalText>
        <ProgressBar percent={operationPct} accentColor={theme.statusColor} height={scaleSize(5)} />
      </View>
      {contributes.length > 0 ? (
        <View style={[styles.listBlock, { gap: scaleSpacing(5), borderTopColor: `${theme.statusColor}24`, paddingTop: scaleSpacing(7) }]}>
          <TerminalText size={scaleFont(5.5)} letterSpacing={0.6} style={{ color: theme.mutedColor }}>
            CONTRIBUTES
          </TerminalText>
          <View style={styles.contributionList}>
            {contributes.map((line) => (
              <ContributionRow key={line} label={line} color={theme.textColor} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function AnchorTabContent({ theme, sector }: { theme: TerminalTheme; sector: SectorState }) {
  const { scaleFont, scaleSize, scaleSpacing, isCompactHeight, showOptionalCopy } = useVeilFrontLayout();
  const { persisted } = useWorldState();
  const sectorTemplate = getSectorWorldTemplate(sector.id);
  const dormantAnchorRunsRemaining = sectorTemplate.anchor
    ? persisted.dormantAnchorRuns[anchorIdForSector(sector.id, sectorTemplate.anchor.type)] ?? 0
    : 0;
  const pressureLines = sector.activeAnchor ? describeAnchorInRunPressure(sector.activeAnchor) : [];

  return (
    <View style={[styles.tabBody, { gap: scaleSpacing(9) }]}>
      <TerminalText size={scaleFont(6)} letterSpacing={0.7} style={{ color: '#a855f7', fontWeight: '700' }}>
        ACTIVE ANCHOR
      </TerminalText>
      {sector.activeAnchor ? (
        <>
          <TerminalText size={scaleFont(8.2)} style={[styles.wrapText, { color: theme.textColor, fontWeight: '800', lineHeight: scaleSize(11) }]}>
            {sector.activeAnchor.displayName}
          </TerminalText>
          {showOptionalCopy ? (
            <TerminalText
              size={scaleFont(6.8)}
              style={[styles.wrapText, { color: theme.mutedColor, lineHeight: scaleSize(11.5) }]}
              numberOfLines={isCompactHeight ? 2 : 3}
            >
              {sector.activeAnchor.description}
            </TerminalText>
          ) : null}
          {pressureLines.length > 0 ? (
            <View style={[styles.listBlock, { gap: scaleSpacing(5), borderTopColor: 'rgba(168, 85, 247, 0.2)', paddingTop: scaleSpacing(7) }]}>
              <TerminalText size={scaleFont(5.5)} letterSpacing={0.6} style={{ color: theme.mutedColor }}>
                PRESSURE
              </TerminalText>
              <View style={styles.contributionList}>
                {pressureLines.map((line) => (
                  <ContributionRow key={line} label={line} color={theme.textColor} />
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : dormantAnchorRunsRemaining > 0 && sectorTemplate.anchor ? (
        <TerminalText size={scaleFont(6.5)} style={[styles.wrapText, { color: theme.mutedColor }]}>
          {`${sectorTemplate.anchor.displayName} dormant — ${dormantAnchorRunsRemaining} run(s) remaining.`}
        </TerminalText>
      ) : (
        <TerminalText size={scaleFont(6.5)} style={[styles.wrapText, { color: theme.mutedColor }]}>
          No active anchor. Standard breach conditions apply.
        </TerminalText>
      )}
    </View>
  );
}

function ContractsTabContent({
  theme,
  sector,
  selectedEmployer,
  onSelectEmployer,
}: {
  theme: TerminalTheme;
  sector: SectorState;
  selectedEmployer: CabalEmployerId | null;
  onSelectEmployer: (employer: CabalEmployerId | null) => void;
}) {
  const { scaleSpacing } = useVeilFrontLayout();
  const availableEmployers = ALL_EMPLOYERS.filter(
    (id) => sector.employerPresence?.includes(id) ?? true,
  );

  return (
    <View style={[styles.tabBody, { gap: scaleSpacing(7) }]}>
      <ContractCard
        title="NO SPONSOR"
        perks={[]}
        isSelected={selectedEmployer === null}
        accentColor={theme.statusColor}
        textColor={theme.textColor}
        onPress={() => onSelectEmployer(null)}
      />
      {availableEmployers.map((employerId) => {
        const def = FACTION_DEFINITIONS[employerId];
        return (
          <ContractCard
            key={employerId}
            title={employerSponsorLabel(employerId).toUpperCase()}
            perks={describeEmployerPerks(employerId)}
            isSelected={selectedEmployer === employerId}
            accentColor={def.accentColor}
            textColor={theme.textColor}
            onPress={() => onSelectEmployer(employerId)}
          />
        );
      })}
    </View>
  );
}

function ContractCard({
  title,
  perks,
  isSelected,
  accentColor,
  textColor,
  onPress,
}: {
  title: string;
  perks: string[];
  isSelected: boolean;
  accentColor: string;
  textColor: string;
  onPress: () => void;
}) {
  const { cardPadding, scaleFont, scaleSpacing } = useVeilFrontLayout();

  return (
    <HapticPressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.contractCard,
        {
          borderColor: isSelected ? accentColor : HUB_DATA_DIVIDER,
          backgroundColor: isSelected ? `${accentColor}14` : 'rgba(15, 23, 42, 0.28)',
          paddingHorizontal: cardPadding,
          paddingVertical: scaleSpacing(6),
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <TerminalText size={scaleFont(6.8)} style={{ color: isSelected ? accentColor : textColor, fontWeight: '700' }}>
        {title}
      </TerminalText>
      {perks.length > 0 ? (
        <View style={[styles.perkList, { gap: scaleSpacing(3), marginTop: scaleSpacing(4) }]}>
          {perks.map((perk) => (
            <View
              key={perk}
              style={[styles.perkChip, { borderColor: `${accentColor}44`, paddingHorizontal: scaleSpacing(5), paddingVertical: scaleSpacing(2) }]}
            >
              <TerminalText size={scaleFont(5.5)} style={{ color: textColor }}>
                {perk}
              </TerminalText>
            </View>
          ))}
        </View>
      ) : null}
    </HapticPressable>
  );
}

/** Right panel — tabs + tab content + deploy only. Summary lives on map top band. */
export default function SectorBriefingPanel({
  theme,
  sector,
  selectedEmployer,
  onSelectEmployer,
  onRequestDeploy,
  runDisabled,
  launching,
}: SectorBriefingPanelProps): React.JSX.Element {
  const {
    sectionGap,
    cardPadding,
    scaleFont,
    deployButtonHeight,
  } = useVeilFrontLayout();
  const [activeTab, setActiveTab] = useState<BriefingTab>('operation');

  const canLaunch = !runDisabled && !launching;
  const deployLabel = launching
    ? '[ DEPLOYING... ]'
    : '[ INITIATE BREACH ]';

  return (
    <View style={[styles.panel, { gap: sectionGap }]}>
      <BriefingTabs theme={theme} activeTab={activeTab} onSelectTab={setActiveTab} />

      <View style={[styles.tabContent, { padding: cardPadding, borderColor: `${theme.statusColor}33` }]}>
        {activeTab === 'operation' ? (
          <OperationTabContent theme={theme} sector={sector} />
        ) : activeTab === 'anchor' ? (
          <AnchorTabContent theme={theme} sector={sector} />
        ) : (
          <ContractsTabContent
            theme={theme}
            sector={sector}
            selectedEmployer={selectedEmployer}
            onSelectEmployer={onSelectEmployer}
          />
        )}
      </View>

      <HapticPressable
        onPress={onRequestDeploy}
        disabled={!canLaunch}
        style={({ pressed }) => [
          styles.deployButton,
          {
            borderColor: theme.statusColor,
            backgroundColor: `${theme.statusColor}28`,
            height: deployButtonHeight,
            opacity: !canLaunch ? 0.45 : pressed ? 0.88 : 1,
            ...viewShadow({
              color: theme.statusColor,
              opacity: !canLaunch ? 0.2 : 0.75,
              radius: 10,
              offset: { width: 0, height: 0 },
            }),
          },
        ]}
      >
        <TerminalText
          size={scaleFont(7)}
          letterSpacing={0.6}
          style={{ color: canLaunch ? theme.statusColor : theme.mutedColor, fontWeight: '800' }}
        >
          {deployLabel}
        </TerminalText>
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    flexShrink: 0,
    borderWidth: 1,
    backgroundColor: 'rgba(8, 13, 22, 0.5)',
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    ...Platform.select({
      web: { cursor: 'pointer' as const },
      default: {},
    }),
  },
  tabContent: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    backgroundColor: 'rgba(18, 28, 44, 0.72)',
    overflow: 'hidden',
  },
  tabBody: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  wrapText: {
    flexShrink: 1,
  },
  typeChip: {
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  contributionList: {
    gap: 3,
  },
  listBlock: {
    borderTopWidth: 1,
  },
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  contributionText: {
    flex: 1,
    flexShrink: 1,
  },
  perkList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  perkChip: {
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  contractCard: {
    borderWidth: 1,
    borderLeftWidth: 2,
    overflow: 'visible',
    ...Platform.select({
      web: { cursor: 'pointer' as const },
      default: {},
    }),
  },
  deployButton: {
    width: '100%',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
