import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import SanctuaryBg from '../../assets/images/location images/sanctuary.png';
import ClassGraftUI, { type GraftInjectSelection } from '../components/ClassGraftUI';
import TacticalButton from '../components/TacticalButton';
import TerminalOverlay from '../components/TerminalOverlay';
import { canAffordAnySanctuaryGraft, getMinimumClassGraftCost } from '../data/classGraftEngine';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { resolveHubCtaFill } from '../constants/hubCta';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventImmersiveBackdrop from '../components/layout/RunEventImmersiveBackdrop';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import { readPressableHover, terminalHoverStyle } from '../utils/terminalHoverStyle';
import { resolveRunEventNodeHeaderFromNode } from '../utils/resolveRunEventNodeHeader';

const TERMINAL_ACCENT = '#00ff33';
const MUTED_STAT = '#94A3B8';
const HEAL_GREEN = '#4ade80';
const GRAFT_PURPLE = '#c084fc';
const CANCEL_ACCENT = '#64748B';
const CHOICE_BORDER = '#334155';
const TELEMETRY_BG = 'rgba(15, 23, 42, 0.85)';
const TELEMETRY_BORDER = 'rgba(255, 255, 255, 0.1)';

const FLAT_CTA_OVERRIDE: ViewStyle = Platform.select({
  web: { boxShadow: 'none' },
  default: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
}) ?? { shadowOpacity: 0, shadowRadius: 0, elevation: 0 };

type SanctuaryChoice = 'ATTUNE' | 'GRAFT' | null;

const GRAFT_INJECT_ACCENT = '#06B6D4';
const CONTENT_MAX_WIDTH = 540;
const GRAFT_CONTENT_MAX_WIDTH = 720;

interface SanctuaryChoiceBlockProps {
  primaryLabel: string;
  secondaryLabel: string;
  selected: boolean;
  dimmed: boolean;
  locked: boolean;
  accentColor: string;
  secondaryColor: string;
  primaryColor: string;
  primaryFontSize: number;
  secondaryFontSize: number;
  paddingVertical: number;
  paddingHorizontal: number;
  onPress: () => void;
  disabled: boolean;
}

function SanctuaryChoiceBlock({
  primaryLabel,
  secondaryLabel,
  selected,
  dimmed,
  locked,
  accentColor,
  secondaryColor,
  primaryColor,
  primaryFontSize,
  secondaryFontSize,
  paddingVertical,
  paddingHorizontal,
  onPress,
  disabled,
}: SanctuaryChoiceBlockProps): React.JSX.Element {
  const borderColor = selected ? accentColor : CHOICE_BORDER;
  const labelColor = locked
    ? MUTED_STAT
    : selected
      ? accentColor
      : primaryColor;

  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled}
      style={(state) => [
        styles.choiceBtn,
        {
          paddingVertical,
          paddingHorizontal,
          borderColor,
          borderWidth: 2,
          backgroundColor: selected ? `${accentColor}14` : TELEMETRY_BG,
          opacity: dimmed ? 0.35 : locked ? 0.4 : state.pressed ? 0.85 : 1,
        },
        terminalHoverStyle(readPressableHover(state), state.pressed),
      ]}
    >
      <Text
        style={[
          styles.choicePrimary,
          {
            color: labelColor,
            fontSize: primaryFontSize,
            lineHeight: primaryFontSize * 1.25,
          },
        ]}
      >
        {primaryLabel}
      </Text>
      <Text
        style={[
          styles.choiceSecondary,
          {
            color: locked ? MUTED_STAT : secondaryColor,
            fontSize: secondaryFontSize,
            lineHeight: secondaryFontSize * 1.35,
          },
        ]}
      >
        {secondaryLabel}
      </Text>
    </HapticPressable>
  );
}

export default function RestScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    applySanctuaryAttune,
    openSanctuaryGraftTerminal,
    applyClassGraftToAbility,
    getVeilResidueBalance,
    getSelectedVectorNode,
  } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const {
    isDesktop,
    activeViewportWidth,
    fontScale,
    scaleFont,
    scaleSpacing,
  } = useResponsiveLayout();

  const [graftSelection, setGraftSelection] = useState<GraftInjectSelection>({
    graftId: null,
    abilityId: null,
    canInject: false,
  });
  const [selectedChoice, setSelectedChoice] = useState<SanctuaryChoice>(null);
  const [graftTerminalOpen, setGraftTerminalOpen] = useState(false);
  const [graftComplete, setGraftComplete] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const activeClass = activeIncursion.activeClass ?? 'AEGIS';
  const residueBalance = getVeilResidueBalance();
  const graftOffers = activeIncursion.sanctuaryGraftOffers ?? [];
  const graftAffordable = canAffordAnySanctuaryGraft(activeClass, residueBalance);
  const minimumGraftCost = getMinimumClassGraftCost(activeClass);

  const loadout = useMemo(() => {
    if (activeClass === 'HEX_SHOT') return activeIncursion.hexShotLoadout;
    if (activeClass === 'ENVOY') return activeIncursion.envoyLoadout;
    return activeIncursion.aegisLoadout;
  }, [activeClass, activeIncursion.aegisLoadout, activeIncursion.envoyLoadout, activeIncursion.hexShotLoadout]);

  const abilityGrafts = useMemo(() => {
    if (activeClass === 'HEX_SHOT') return activeIncursion.hexShotAbilityGrafts;
    if (activeClass === 'ENVOY') return activeIncursion.envoyAbilityGrafts;
    return activeIncursion.abilityGrafts;
  }, [activeClass, activeIncursion.abilityGrafts, activeIncursion.envoyAbilityGrafts, activeIncursion.hexShotAbilityGrafts]);

  const contentPadding = isDesktop ? scaleSpacing(graftTerminalOpen ? 12 : 16) : scaleSpacing(10);
  const contentMaxWidth = isDesktop
    ? Math.min(
      graftTerminalOpen ? GRAFT_CONTENT_MAX_WIDTH : CONTENT_MAX_WIDTH,
      activeViewportWidth,
    )
    : activeViewportWidth;

  const vectorNode = getSelectedVectorNode();
  const headerCopy = resolveRunEventNodeHeaderFromNode(
    vectorNode,
    'SANCTUARY',
    'RE-TUNE CONDUIT',
  );

  const telemetryPadding = scaleSpacing(graftTerminalOpen ? 10 : 16);
  const choicePaddingVertical = scaleSpacing(graftTerminalOpen ? 12 : 14);
  const choicePaddingHorizontal = scaleSpacing(graftTerminalOpen ? 16 : 20);
  const choiceGap = scaleSpacing(graftTerminalOpen ? 8 : 12);
  const columnGap = scaleSpacing(graftTerminalOpen ? 8 : 12);

  const narrativeSize = scaleFont(graftTerminalOpen ? 10 : 11);
  const statSize = scaleFont(9);
  const choicePrimarySize = 11 * fontScale * 1.2;
  const choiceSecondarySize = scaleFont(10);

  const handleSelectAttune = () => {
    if (confirmed) return;
    setSelectedChoice('ATTUNE');
    setGraftTerminalOpen(false);
    setGraftComplete(false);
  };

  const handleSelectGraft = () => {
    if (confirmed || !graftAffordable) return;
    setSelectedChoice('GRAFT');
    setGraftTerminalOpen(true);
    setGraftSelection({ graftId: null, abilityId: null, canInject: false });
    openSanctuaryGraftTerminal();
  };

  const handleApplyGraft = (abilityId: string, graftId: string) => {
    const result = applyClassGraftToAbility(abilityId, graftId);
    if (result.success) {
      setGraftComplete(true);
      setGraftSelection({ graftId: null, abilityId: null, canInject: false });
    }
  };

  const handleGraftSelectionChange = useCallback((selection: GraftInjectSelection) => {
    setGraftSelection(selection);
  }, []);

  const handleInjectGraft = () => {
    if (!graftSelection.canInject || !graftSelection.graftId || !graftSelection.abilityId) return;
    handleApplyGraft(graftSelection.abilityId, graftSelection.graftId);
  };

  const handleCancelGraft = () => {
    if (confirmed) return;
    setSelectedChoice(null);
    setGraftTerminalOpen(false);
    setGraftComplete(false);
    setGraftSelection({ graftId: null, abilityId: null, canInject: false });
  };

  const canContinue = selectedChoice === 'ATTUNE'
    || (selectedChoice === 'GRAFT' && graftComplete);

  const continueEnabled = (graftTerminalOpen ? graftComplete : canContinue) && !confirmed;

  const handleContinue = () => {
    if (!continueEnabled) return;
    setConfirmed(true);
    if (selectedChoice === 'ATTUNE') {
      applySanctuaryAttune();
    }
    const msg = selectedChoice === 'ATTUNE'
      ? 'Soul anchor stabilized.'
      : 'Class graft mutation secured.';
    setTimeout(() => completeCurrentNode(msg), 1200);
  };

  const graftTerminalLabel = activeClass === 'HEX_SHOT'
    ? '[ ACCESS HEX-SHOT GRAFT TERMINAL ]'
    : activeClass === 'ENVOY'
      ? '[ ACCESS ENVOY GRAFT TERMINAL ]'
      : '[ ACCESS VEIL-GRAFT TERMINAL ]';

  const showInjectButton = graftTerminalOpen && !graftComplete;
  const actionLabel = showInjectButton ? '[ INJECT GRAFT ]' : '[ CONTINUE ]';
  const actionEnabled = showInjectButton
    ? graftSelection.canInject && !confirmed
    : continueEnabled;
  const actionAccent = showInjectButton && graftSelection.canInject
    ? GRAFT_INJECT_ACCENT
    : TERMINAL_ACCENT;

  const handleAction = () => {
    if (showInjectButton) {
      handleInjectGraft();
      return;
    }
    handleContinue();
  };

  const continueButtonStyle = useCallback(
    (state: { pressed: boolean; hovered?: boolean }) => [
      styles.continueBtn,
      {
        width: showInjectButton ? undefined : '100%' as const,
        flex: showInjectButton ? 1 : undefined,
        alignSelf: 'stretch' as const,
        backgroundColor: resolveHubCtaFill(actionAccent),
        borderColor: actionAccent,
        borderWidth: 2,
        minHeight: choicePaddingVertical * 2 + scaleFont(14),
        paddingVertical: choicePaddingVertical,
        paddingHorizontal: choicePaddingHorizontal,
        opacity: actionEnabled ? (state.pressed ? 0.85 : 1) : 0.2,
      },
      FLAT_CTA_OVERRIDE,
      terminalHoverStyle(readPressableHover(state), state.pressed),
    ],
    [
      actionAccent,
      actionEnabled,
      choicePaddingHorizontal,
      choicePaddingVertical,
      scaleFont,
      showInjectButton,
    ],
  );

  const cancelButtonStyle = useCallback(
    (state: { pressed: boolean; hovered?: boolean }) => [
      styles.continueBtn,
      {
        flex: 1,
        alignSelf: 'stretch' as const,
        backgroundColor: 'rgba(100, 116, 139, 0.12)',
        borderColor: CANCEL_ACCENT,
        borderWidth: 2,
        minHeight: choicePaddingVertical * 2 + scaleFont(14),
        paddingVertical: choicePaddingVertical,
        paddingHorizontal: choicePaddingHorizontal,
        opacity: state.pressed ? 0.85 : 1,
      },
      FLAT_CTA_OVERRIDE,
      terminalHoverStyle(readPressableHover(state), state.pressed),
    ],
    [choicePaddingHorizontal, choicePaddingVertical, scaleFont],
  );

  const leftPanelContent = (
    <>
      <View
        style={[
          styles.telemetryBox,
          {
            padding: telemetryPadding,
            borderColor: TELEMETRY_BORDER,
            gap: graftTerminalOpen ? 0 : 12,
            flexShrink: graftTerminalOpen ? 1 : 0,
          },
        ]}
      >
        {!graftTerminalOpen ? (
          <Text
            style={[
              styles.narrativeText,
              {
                color: theme.primaryColor,
                fontSize: narrativeSize,
                lineHeight: narrativeSize * 1.55,
              },
            ]}
          >
            Stabilizing ley-energy hums through the anchor chapel. Choose attunement or graft mutation — not both.
          </Text>
        ) : null}
        <View style={[styles.statsGrid, isDesktop ? styles.statsGridDesktop : null]}>
          <Text
            style={[
              styles.statLine,
              {
                color: MUTED_STAT,
                fontSize: statSize,
                lineHeight: statSize * 1.45,
              },
            ]}
          >
            {`SOUL ANCHOR: ${runState.soulAnchorIntegrity}/${runState.maxSoulAnchor}`}
          </Text>
          <Text
            style={[
              styles.statLine,
              {
                color: MUTED_STAT,
                fontSize: statSize,
                lineHeight: statSize * 1.45,
              },
            ]}
          >
            {`VEIL RESIDUE: ${residueBalance}`}
          </Text>
          <Text
            style={[
              styles.statLine,
              {
                color: MUTED_STAT,
                fontSize: statSize,
                lineHeight: statSize * 1.45,
              },
            ]}
          >
          </Text>
        </View>
      </View>

      {!graftTerminalOpen ? (
        <View style={[styles.choiceCol, { gap: choiceGap }]}>
          <SanctuaryChoiceBlock
            primaryLabel="[ ATTUNE ]"
            secondaryLabel="Restore 30% of Maximum Health"
            selected={selectedChoice === 'ATTUNE'}
            dimmed={selectedChoice === 'GRAFT' || (confirmed && selectedChoice !== 'ATTUNE')}
            locked={false}
            accentColor={TERMINAL_ACCENT}
            secondaryColor={HEAL_GREEN}
            primaryColor={theme.primaryColor}
            primaryFontSize={choicePrimarySize}
            secondaryFontSize={choiceSecondarySize}
            paddingVertical={choicePaddingVertical}
            paddingHorizontal={choicePaddingHorizontal}
            onPress={handleSelectAttune}
            disabled={confirmed || selectedChoice === 'GRAFT'}
          />

          <SanctuaryChoiceBlock
            primaryLabel={graftTerminalLabel}
            secondaryLabel={
              !graftAffordable
                ? `INSUFFICIENT RESIDUE — REQUIRES ${minimumGraftCost}+`
                : 'Spend Veil Residue to mutate an equipped ability'
            }
            selected={selectedChoice === 'GRAFT'}
            dimmed={selectedChoice === 'ATTUNE' || (confirmed && selectedChoice !== 'GRAFT')}
            locked={!graftAffordable}
            accentColor={GRAFT_PURPLE}
            secondaryColor={GRAFT_PURPLE}
            primaryColor={theme.primaryColor}
            primaryFontSize={choicePrimarySize}
            secondaryFontSize={choiceSecondarySize}
            paddingVertical={choicePaddingVertical}
            paddingHorizontal={choicePaddingHorizontal}
            onPress={handleSelectGraft}
            disabled={confirmed || selectedChoice === 'ATTUNE' || !graftAffordable}
          />
        </View>
      ) : (
        <View style={styles.graftHost}>
          <ClassGraftUI
            activeClass={activeClass}
            loadout={loadout}
            offers={graftOffers}
            residueBalance={residueBalance}
            abilityGrafts={abilityGrafts}
            onSelectionChange={handleGraftSelectionChange}
            compact
            borderColor={theme.borderColor}
            primaryColor={theme.primaryColor}
            mutedColor={theme.mutedColor}
          />
        </View>
      )}
    </>
  );

  const actionColumn = (
    <View style={[styles.actionCol, { gap: scaleSpacing(12) }]}>
      {showInjectButton ? (
        <>
          <TacticalButton
            label="[ CANCEL ]"
            active
            onPress={handleCancelGraft}
            accentColor={CANCEL_ACCENT}
            mutedColor={theme.mutedColor}
            variant="cta"
            disabled={confirmed}
            style={cancelButtonStyle}
          />
          <TacticalButton
            label={actionLabel}
            active={actionEnabled}
            onPress={handleAction}
            accentColor={actionAccent}
            mutedColor={theme.mutedColor}
            variant="cta"
            disabled={!actionEnabled}
            style={continueButtonStyle}
          />
        </>
      ) : (
        <TacticalButton
          label={actionLabel}
          active={actionEnabled}
          onPress={handleAction}
          accentColor={actionAccent}
          mutedColor={theme.mutedColor}
          variant="cta"
          disabled={!actionEnabled}
          style={continueButtonStyle}
        />
      )}
    </View>
  );

  return (
    <IncursionShell>
      <IncursionRunLayout hideRunChrome={!graftTerminalOpen} style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventImmersiveBackdrop
          backgroundImage={SanctuaryBg}
          contentPadding={contentPadding}
          overlay={<TerminalOverlay />}
        >
          {!graftTerminalOpen ? (
            <RunEventNodeHeader
              title={headerCopy.title}
              subtitle={headerCopy.subtitle}
              fontScale={fontScale}
              showRunChrome
            />
          ) : null}

          <View style={styles.bodyStage}>
            <View
              style={[
                styles.contentColumn,
                {
                  maxWidth: contentMaxWidth,
                  gap: columnGap,
                  flex: 1,
                  minHeight: 0,
                },
              ]}
            >
              {leftPanelContent}
              {actionColumn}
            </View>
          </View>
        </RunEventImmersiveBackdrop>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  bodyStage: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'center',
  },
  contentColumn: {
    width: '100%',
    alignSelf: 'center',
  },
  graftHost: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  telemetryBox: {
    width: '100%',
    backgroundColor: TELEMETRY_BG,
    borderWidth: 1,
    gap: 12,
  },
  narrativeText: {
    fontFamily: 'monospace',
    letterSpacing: 0.25,
  },
  statsGrid: {
    gap: 8,
  },
  statsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statLine: {
    fontFamily: 'monospace',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  choiceCol: {
    width: '100%',
  },
  choiceBtn: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  choicePrimary: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  choiceSecondary: {
    fontFamily: 'monospace',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  continueBtn: {
    width: '100%',
    marginTop: 4,
  },
  actionCol: {
    width: '100%',
    flexShrink: 0,
  },
});
