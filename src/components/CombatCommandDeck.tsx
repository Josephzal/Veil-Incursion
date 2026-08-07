import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type CardShellRef = React.ElementRef<typeof View>;

function renderAbilityHoverPortal(node: React.ReactNode): React.ReactNode {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return node;
  }
  // Escape transformed / overflow-clipped combat ancestors on web.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const reactDom = require('react-dom') as {
    createPortal: (children: React.ReactNode, container: Element) => React.ReactNode;
  };
  return reactDom.createPortal(node, document.body);
}
import { USE_NATIVE_DRIVER } from '../utils/platformMotion';
import { textGlow, viewShadow } from '../utils/adaptiveStyles';
import { combatConsoleChromeStyle } from '../theme/combatConsoleChrome';
import HapticPressable from './HapticPressable';
import type { AegisAbilityId } from '../types/aegisCombat';
import { PLAYER_ACTION_POINTS_PER_TURN } from '../types/aegisCombat';
import CombatApPipRow from './combat/CombatApPipRow';
import RunFeedChromeButtons from './run/RunFeedChromeButtons';
import { useCombatDesktopLayout } from '../hooks/useCombatDesktopLayout';
import { DOSSIER_CTA_BG, DOSSIER_ROW_BG } from '../constants/dossierSurface';
import { COMBAT_HUD_TYPE } from '../constants/combatHudTypography';
import { OTT } from '../constants/occultTacticalTerminalTheme';
import type { AbilityTargetMode } from '../data/combatTargeting';

/** Shared rest chrome for utility buttons (STATUS / muted End Turn). */
const UTILITY_CARD_ACCENT = '#8AA0A8';

const MONO = OTT.mono;
const TILE_HEIGHT = 40;
const TILE_HEIGHT_DASHBOARD = 25;
const TILE_MARGIN_BOTTOM = 8;
const TILE_MARGIN_BOTTOM_DASHBOARD = 2;
const DASHBOARD_MINIGAME_BTN_HEIGHT = TILE_HEIGHT_DASHBOARD;
const DASHBOARD_END_TURN_HEIGHT = TILE_HEIGHT_DASHBOARD - 4;
const GRID_GAP = 6;
const AP_ROW_HEIGHT = 22;
const GRID_BODY_HEIGHT = TILE_HEIGHT * 2 + TILE_MARGIN_BOTTOM * 2 + GRID_GAP;
const INITIATIVE_FLOAT_MS = 800;
const INITIATIVE_SURGE_MS = 300;
const INITIATIVE_GLOW = OTT.fluxViolet;
const INITIATIVE_GLOW_PALE = OTT.cyanSelect;
const END_TURN_ENABLED = OTT.soulRed;
const END_TURN_BORDER = OTT.dangerRedDark;
const END_TURN_BORDER_MUTED = 'rgba(158, 40, 48, 0.45)';

/** Hover detail — prose only; strip tag dumps and card scan-line echoes. */
function sanitizeAbilityHoverBody(raw: string): string {
  return raw
    .replace(/\s*\/\/\s*TAGS:\s*.+$/i, '')
    .replace(/\s*TAGS:\s*.+$/i, '')
    .replace(/\s*\/\/\s*\d+\s+DAMAGE\b.*$/i, '')
    .trim();
}

/** Decision-card scan lines — name / AP / effect / one keyword. Details stay in tooltip. */
function parseDecisionCardLines(costImpact: string, effectTags: string): {
  apCost: string;
  effectLine: string | null;
  keyword: string | null;
} {
  const apMatch = costImpact.match(/(\d+)\s*AP/i);
  const apCost = apMatch?.[1] ?? '1';
  const chips = effectTags
    .split(/\s*\/\/\s*/)
    .map((chip) => chip.trim())
    .filter(Boolean);
  let effectLine: string | null = null;
  let effectIdx = -1;
  for (let i = 0; i < chips.length; i += 1) {
    const chip = chips[i];
    const dmg = chip.match(/^(\d+)\s+(KINETIC|OCCULT|TRUE)(?:\s+DAMAGE)?$/i);
    if (dmg) {
      effectLine = `${dmg[1]} DAMAGE`;
      effectIdx = i;
      break;
    }
    if (/^\d+\s/.test(chip) || /(?:DAMAGE|HEAL|RESTORE|WARD|ARMOR|DEFENSE)/i.test(chip)) {
      effectLine = chip.toUpperCase();
      effectIdx = i;
      break;
    }
  }
  const keywordChip = chips.find((chip, i) => (
    i !== effectIdx
    && !/^\d+\s*AP/i.test(chip)
    && !/^COST:/i.test(chip)
  ));
  return {
    apCost,
    effectLine,
    keyword: keywordChip ? keywordChip.toUpperCase() : null,
  };
}

/** Compact amber footer copy — replace long REQUIRE sentences. */
function formatCompactLockReason(reason: string): { headline: string; detail: string } {
  const raw = reason.replace(/\s+/g, ' ').trim();
  const upper = raw.toUpperCase();
  const brand = upper.match(/(\d+)\s*RUNIC BRAND/);
  if (upper.includes('RUNIC BRAND')) {
    return { headline: 'LOCKED', detail: `NEED ${brand?.[1] ?? '1'} RUNIC BRAND` };
  }
  const ap = upper.match(/(\d+)\s*AP/);
  if (ap && (upper.includes('REQUIRE') || upper.includes('NEED') || upper.includes('INSUFFICIENT') || upper.includes('NOT ENOUGH'))) {
    return { headline: 'LOCKED', detail: `NEED ${ap[1]} AP` };
  }
  const ammo = upper.match(/(\d+)\s*(ROUND|AMMO|SHELL)/);
  if (ammo || upper.includes('AMMO') || upper.includes('MAGAZINE') || upper.includes('RELOAD')) {
    return { headline: 'LOCKED', detail: ammo ? `NEED ${ammo[1]} ${ammo[2]}` : 'NEED AMMO' };
  }
  if (upper.includes('TARGET') || upper.includes('NO VALID') || upper.includes('INVALID')) {
    return { headline: 'NO TARGET', detail: 'SELECT VALID FOE' };
  }
  let detail = upper
    .replace(/^REQUIRES?\s+(AT LEAST\s+)?/i, 'NEED ')
    .replace(/\s*\(HAVE\s*\d+\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!detail.startsWith('NEED ') && !detail.startsWith('NO ')) {
    detail = detail.length > 0 ? detail : 'UNAVAILABLE';
  }
  if (detail.length > 22) detail = `${detail.slice(0, 21)}…`;
  return { headline: 'LOCKED', detail };
}

export const COMMAND_DECK_MIN_HEIGHT = AP_ROW_HEIGHT + GRID_GAP + GRID_BODY_HEIGHT + 10;
export const COMMAND_DECK_MIN_HEIGHT_WITH_ULTIMATE = COMMAND_DECK_MIN_HEIGHT;

interface CombatCommandDeckProps {
  loadout: readonly string[];
  selectedAbility: string | null;
  onSelectAbility: (ability: string) => void;
  onConfirm: () => void;
  onAbort: () => void;
  onEndTurn: () => void;
  actionPoints: number;
  displayActionPoints?: number | null;
  maxActionPoints?: number;
  isActionEnabled: (ability: string) => boolean;
  canSelectActions?: boolean;
  getActionDisableReason?: (ability: string) => string | null;
  canEndTurn: boolean;
  getAbilityLabel: (ability: string) => string;
  /** Concept card category line (MELEE / DEFENSE / …). */
  getAbilityCategory?: (ability: string) => string;
  /** Damage / buff / debuff chips — same idle and selected. */
  getAbilityEffectTags?: (ability: string) => string;
  /** Target mode drives confirm-on-card for NONE abilities. */
  getAbilityTargetMode?: (ability: string) => AbilityTargetMode;
  /**
   * Phase B Aegis — when set, loadout is [weaponActions…, techniques…] and
   * renders as two labeled groups instead of a flat four-card strip.
   */
  weaponActionCount?: number;
  techniqueCount?: number;
  /** Optional second-group label (default TECHNIQUES). Hex uses FLEX ABILITIES. */
  techniqueGroupLabel?: string;
  /** Dual-target pick progress (Divergence) — enables CONFIRM when both set. */
  dualTargetsReady?: boolean;
  dualTargetLabel?: string | null;
  initiativeQueued?: boolean;
  initiativeProcSeq?: number;
  onInitiativeProcComplete?: () => void;
  getStagedCostImpact: (ability: string) => string;
  getStagedAbilityDescription: (ability: string) => string;
  getActionAccent?: (ability: string) => string | undefined;
  bloodForTimeAvailable?: boolean;
  bloodForTimeEnabled?: boolean;
  onBloodForTime?: () => void;
  combatReloadAvailable?: boolean;
  combatReloadEnabled?: boolean;
  onCombatReload?: () => void;
  voidWardAvailable?: boolean;
  voidWardEnabled?: boolean;
  voidWardPrimed?: boolean;
  onVoidWardPrime?: () => void;
  /** Phase 3 — Aegis Riposte Ready (status chip + Strike accents). Never renames Parry. */
  riposteReady?: boolean;
  riposteStatusTitle?: string | null;
  riposteStatusShort?: string | null;
  /** True when ability carries the authoritative STRIKE tag. */
  isStrikeAbility?: (ability: string) => boolean;
  catalyticConsoleAvailable?: boolean;
  catalyticConsoleEnabled?: boolean;
  catalyticConsoleRotStacks?: number;
  onCatalyticConsole?: () => void;
  /** Envoy intrinsic Rift Ward — status only; outside the seven-card rail. */
  riftWardAvailable?: boolean;
  riftWardReady?: boolean;
  borderColor: string;
  primaryColor: string;
  mutedColor: string;
  frameless?: boolean;
  dashboardLayout?: boolean;
}

export default function CombatCommandDeck({
  loadout,
  selectedAbility,
  onSelectAbility,
  onConfirm,
  onAbort,
  onEndTurn,
  actionPoints,
  displayActionPoints = null,
  maxActionPoints = PLAYER_ACTION_POINTS_PER_TURN,
  isActionEnabled,
  canSelectActions = true,
  getActionDisableReason,
  canEndTurn,
  getAbilityLabel,
  getAbilityCategory: _getAbilityCategory,
  getAbilityEffectTags,
  getAbilityTargetMode,
  weaponActionCount = 0,
  techniqueCount = 0,
  techniqueGroupLabel = 'TECHNIQUES',
  dualTargetsReady = false,
  dualTargetLabel = null,
  initiativeQueued = false,
  initiativeProcSeq = 0,
  onInitiativeProcComplete,
  getStagedCostImpact,
  getStagedAbilityDescription,
  getActionAccent,
  bloodForTimeAvailable = false,
  bloodForTimeEnabled = false,
  onBloodForTime,
  combatReloadAvailable = false,
  combatReloadEnabled = false,
  onCombatReload,
  voidWardAvailable = false,
  voidWardEnabled = false,
  voidWardPrimed = false,
  onVoidWardPrime,
  riposteReady = false,
  riposteStatusTitle = null,
  riposteStatusShort = null,
  isStrikeAbility,
  catalyticConsoleAvailable = false,
  catalyticConsoleEnabled = false,
  catalyticConsoleRotStacks = 0,
  onCatalyticConsole,
  riftWardAvailable = false,
  riftWardReady = false,
  borderColor,
  primaryColor,
  mutedColor,
  frameless = false,
  dashboardLayout = false,
}: CombatCommandDeckProps): React.JSX.Element {
  const { isCombatDesktop, fontScale, scaleCombatFont, scaleCombatSize } = useCombatDesktopLayout();
  const desktopDeck = dashboardLayout && isCombatDesktop;
  const webStagedFocus = Platform.OS === 'web' && selectedAbility != null;
  const shownAp = displayActionPoints ?? actionPoints;
  const lastProcSeqRef = useRef(0);
  const queuePulse = useRef(new Animated.Value(0)).current;
  const surgeScale = useRef(new Animated.Value(0.92)).current;
  const surgeOpacity = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;
  const floatTranslateY = useRef(new Animated.Value(8)).current;
  const floatScale = useRef(new Animated.Value(0.86)).current;
  const [floatVisible, setFloatVisible] = useState(false);
  const [hoveredAbility, setHoveredAbility] = useState<string | null>(null);
  const [endTurnHot, setEndTurnHot] = useState(false);
  const deckHostRef = useRef<CardShellRef | null>(null);
  const cardShellRefs = useRef<Record<string, CardShellRef | null>>({});
  const [hoverPopup, setHoverPopup] = useState<{
    ability: string;
    x: number;
    y: number;
    width: number;
    height: number;
    body: string;
  } | null>(null);

  const clearHoverPopup = useCallback(() => {
    setHoverPopup(null);
  }, []);

  const showHoverPopup = useCallback((ability: string, body: string) => {
    if (!body) {
      setHoverPopup(null);
      return;
    }
    const node = cardShellRefs.current[ability];
    if (!node || typeof node.measureInWindow !== 'function') {
      setHoverPopup(null);
      return;
    }
    node.measureInWindow((cardX, cardY, width, height) => {
      if (Platform.OS === 'web') {
        setHoverPopup({
          ability,
          x: cardX,
          y: cardY,
          width,
          height,
          body,
        });
        return;
      }
      const host = deckHostRef.current;
      if (!host || typeof host.measureInWindow !== 'function') {
        setHoverPopup(null);
        return;
      }
      host.measureInWindow((hostX, hostY) => {
        setHoverPopup({
          ability,
          x: cardX - hostX,
          y: cardY - hostY,
          width,
          height,
          body,
        });
      });
    });
  }, []);

  useEffect(() => {
    if (!initiativeQueued) {
      queuePulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(queuePulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(queuePulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [initiativeQueued, queuePulse]);

  useEffect(() => {
    if (initiativeProcSeq <= 0 || initiativeProcSeq === lastProcSeqRef.current) return;
    lastProcSeqRef.current = initiativeProcSeq;
    setFloatVisible(true);
    floatOpacity.setValue(0);
    floatTranslateY.setValue(8);
    floatScale.setValue(0.86);
    surgeScale.setValue(0.92);
    surgeOpacity.setValue(0);

    const riseMs = Math.floor(INITIATIVE_FLOAT_MS * 0.55);
    const fadeMs = Math.floor(INITIATIVE_FLOAT_MS * 0.45);

    Animated.parallel([
      Animated.timing(surgeOpacity, {
        toValue: 1,
        duration: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(surgeScale, {
        toValue: 1.08,
        duration: INITIATIVE_SURGE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(floatOpacity, {
        toValue: 1,
        duration: Math.min(120, riseMs),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(floatTranslateY, {
        toValue: -28,
        duration: riseMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(floatScale, {
        toValue: 1.08,
        duration: riseMs,
        easing: Easing.out(Easing.back(1.12)),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(surgeOpacity, {
          toValue: 0,
          duration: Math.max(120, INITIATIVE_SURGE_MS - 80),
          easing: Easing.in(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(surgeScale, {
          toValue: 1.16,
          duration: Math.max(120, INITIATIVE_SURGE_MS - 80),
          easing: Easing.in(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    });

    Animated.sequence([
      Animated.delay(riseMs),
      Animated.timing(floatOpacity, {
        toValue: 0,
        duration: fadeMs,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      setFloatVisible(false);
      onInitiativeProcComplete?.();
    });
  }, [
    floatOpacity,
    floatScale,
    floatTranslateY,
    initiativeProcSeq,
    onInitiativeProcComplete,
    surgeOpacity,
    surgeScale,
  ]);

  const queuedBorderColor = queuePulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(167, 139, 250, 0.35)', 'rgba(186, 230, 253, 0.82)'],
  });

  const deckShellStyle = [
    styles.commandDeck,
    frameless ? styles.commandDeckFrameless : null,
    !frameless ? { borderColor } : null,
  ];

  const labelFor = (ability: string) => getAbilityLabel(ability);

  /** E.5V — single horizontal 4+3 command rail (not stacked rows). */
  const groupedDashboard = dashboardLayout && weaponActionCount > 0 && techniqueCount > 0;
  const groupedConceptCardHeight = desktopDeck ? 120 : 110;
  const mechanicModuleHeight = desktopDeck ? 68 : 64;
  const railScrollRef = useRef<ScrollView>(null);

  const tileHeight = dashboardLayout
    ? (desktopDeck
      ? (groupedDashboard ? groupedConceptCardHeight : undefined)
      : (groupedDashboard ? groupedConceptCardHeight : TILE_HEIGHT_DASHBOARD))
    : TILE_HEIGHT;
  const desktopBtnStyle = desktopDeck ? {
    borderWidth: 2,
    minHeight: scaleCombatSize(44),
  } : null;
  const desktopLabelStyle = desktopDeck ? {
    fontSize: scaleCombatFont(9),
    letterSpacing: 0.35,
  } : null;
  const desktopActionLabelStyle = desktopDeck ? desktopLabelStyle : null;
  const apTypography = desktopDeck ? {
    labelFontSize: scaleCombatFont(9),
    hexSize: scaleCombatSize(10),
  } : null;

  const dashboardTwinBtnStyle = dashboardLayout ? styles.dashboardTwinActionBtn : null;

  const renderClassActionButtons = (includeEndTurn: boolean) => {
    if (webStagedFocus) return null;
    return (
      <>
        {renderVoidWardButton()}
        {renderCatalyticConsoleButton()}
        {renderCombatReloadButton()}
        {includeEndTurn ? renderEndTurnButton() : null}
      </>
    );
  };

  const renderWebStagedApRow = () => (
    <View style={[styles.topBand, dashboardLayout && styles.topBandDashboard]}>
      <View style={[styles.apColumn, webStagedFocus && styles.webStagedApColumn]}>
        <CombatApPipRow
          current={shownAp}
          max={maxActionPoints}
          accent={primaryColor}
          mutedColor={mutedColor}
          queued={initiativeQueued}
          fontScale={desktopDeck ? fontScale : 1}
          labelFontSize={apTypography?.labelFontSize}
          hexSize={apTypography?.hexSize}
          compact={dashboardLayout}
          centered={dashboardLayout || webStagedFocus}
        />
      </View>
    </View>
  );

  const renderDashboardTopBand = (includeEndTurn: boolean) => (
    <View style={[styles.topBand, dashboardLayout && styles.topBandDashboard]}>
      <View style={styles.apColumn}>
        <CombatApPipRow
          current={shownAp}
          max={maxActionPoints}
          accent={primaryColor}
          mutedColor={mutedColor}
          queued={initiativeQueued}
          fontScale={desktopDeck ? fontScale : 1}
          labelFontSize={apTypography?.labelFontSize}
          hexSize={apTypography?.hexSize}
          compact={dashboardLayout}
          centered={dashboardLayout}
        />
      </View>
      <View style={[styles.apActions, styles.apActionsDashboard]}>
        {renderClassActionButtons(includeEndTurn)}
      </View>
    </View>
  );

  const renderTile = (
    ability: string,
    opts?: { group?: 'weapon' | 'technique' },
  ) => {
    const enabled = isActionEnabled(ability);
    const accent = getActionAccent?.(ability);
    const costImpact = getStagedCostImpact(ability);
    const isSelected = selectedAbility === ability;
    const strikeEligible = Boolean(riposteReady && isStrikeAbility?.(ability));
    const group = opts?.group;
    const tileBorderColor = isSelected
      ? OTT.terminalGreen
      : strikeEligible
        ? (enabled ? OTT.warningAmber : 'rgba(224, 180, 90, 0.35)')
      : enabled && accent
        ? accent
        : group === 'technique'
          ? 'rgba(176, 124, 255, 0.35)'
          : OTT.borderSubtle;
    if (dashboardLayout) {
      const abilityName = labelFor(ability).toUpperCase().replace(/^\[\s*/, '').replace(/\s*\]$/, '');
      const effectTags = getAbilityEffectTags?.(ability) ?? '';
      const decision = parseDecisionCardLines(costImpact, effectTags);
      const rawDisableReason = !enabled
        ? (getActionDisableReason?.(ability) ?? 'UNAVAILABLE')
        : null;
      const lockCopy = rawDisableReason ? formatCompactLockReason(rawDisableReason) : null;
      const missingResource = Boolean(
        lockCopy
        && (
          /NEED \d+ AP|RUNIC BRAND|AMMO|ROUND|SHELL|FLUX|STAMINA/i.test(lockCopy.detail)
          || lockCopy.headline === 'LOCKED'
        )
        && lockCopy.headline !== 'NO TARGET',
      );
      const invalidTarget = lockCopy?.headline === 'NO TARGET';
      const targetMode = getAbilityTargetMode?.(ability) ?? 'SINGLE';
      const needsConfirm = isSelected
        && enabled
        && (
          targetMode === 'NONE'
          || targetMode === 'ALL'
          || (targetMode === 'DUAL' && dualTargetsReady)
          || (targetMode === 'ONE_OR_TWO' && dualTargetsReady)
          || (targetMode === 'COLUMN' && dualTargetsReady)
          || (targetMode === 'ROW' && dualTargetsReady)
        );
      const confirmLabel = targetMode === 'ALL'
        ? 'CONFIRM AOE'
        : targetMode === 'DUAL'
          ? 'CONFIRM ×2'
          : targetMode === 'ONE_OR_TWO'
            ? (dualTargetsReady ? 'CONFIRM CONTACT' : 'CONFIRM')
            : targetMode === 'COLUMN'
              ? (dualTargetsReady ? 'CONFIRM LANE' : 'SELECT LANE')
              : 'CONFIRM';
      const dualHint = isSelected && (targetMode === 'DUAL' || targetMode === 'ONE_OR_TWO' || targetMode === 'COLUMN')
        ? (dualTargetLabel ?? (
          targetMode === 'ONE_OR_TWO'
            ? '4+0 / 2+2'
            : targetMode === 'COLUMN'
              ? 'COLUMN LANE'
              : 'TARGET ×2'
        ))
        : null;
      const spectrallyLit = hoveredAbility === ability;
      // Interaction = cyan/mint. Purple stays a restrained Technique category accent only.
      const chromeAccent = invalidTarget
        ? OTT.soulRed
        : isSelected || spectrallyLit
          ? OTT.cyanSelect
          : strikeEligible && enabled
            ? OTT.warningAmber
            : OTT.cyanSelect;
      const chromeTone = !enabled || invalidTarget
        ? 'disabled' as const
        : (isSelected || spectrallyLit)
          ? 'awake' as const
          : 'rest' as const;
      const inkCard = chromeTone === 'rest' || chromeTone === 'disabled';
      const costColor = missingResource
        ? OTT.warningAmber
        : isSelected
          ? OTT.cyanSelect
          : enabled
            ? OTT.textSecondary
            : OTT.textMuted;
      const tooltipBody = sanitizeAbilityHoverBody(getStagedAbilityDescription(ability));
      const hideCardScanLines = isSelected || spectrallyLit;
      return (
        <View
          key={ability}
          ref={(node) => {
            cardShellRefs.current[ability] = node;
          }}
          style={[
            styles.conceptCardShell,
            groupedDashboard ? styles.conceptCardShellGrouped : null,
            spectrallyLit ? styles.conceptCardHoverElevated : null,
            tileHeight != null ? { height: tileHeight } : null,
          ]}
        >
          <HapticPressable
            onPress={() => {
              if (!canSelectActions) return;
              if (isSelected) {
                // AoE / self casts wait on CONFIRM — don't cancel via card body taps.
                if (targetMode === 'NONE' || targetMode === 'ALL') return;
                onAbort();
                return;
              }
              onSelectAbility(ability);
            }}
            disabled={!canSelectActions}
            onHoverIn={() => {
              setHoveredAbility(ability);
              showHoverPopup(ability, tooltipBody);
            }}
            onHoverOut={() => {
              setHoveredAbility((current) => (current === ability ? null : current));
              clearHoverPopup();
            }}
            accessibilityHint={tooltipBody}
            style={[
              styles.conceptCard,
              groupedDashboard ? styles.conceptCardGrouped : null,
              group === 'weapon' ? styles.conceptCardWeapon : null,
              group === 'technique' ? styles.conceptCardTechnique : null,
              isSelected ? styles.conceptCardSelected : null,
              spectrallyLit && !isSelected ? styles.conceptCardHover : null,
              combatConsoleChromeStyle({
                accent: chromeAccent,
                tone: chromeTone,
                ink: inkCard,
              }),
              { height: '100%' },
            ]}
          >
            {(isSelected || spectrallyLit) ? (
              <View
                style={[
                  styles.conceptCardSelectEdge,
                  spectrallyLit && !isSelected ? styles.conceptCardHoverEdge : null,
                ]}
                pointerEvents="none"
              />
            ) : null}
            <View style={[
              styles.conceptCardHeader,
              isSelected ? styles.conceptCardHeaderSelected : null,
              spectrallyLit && !isSelected ? styles.conceptCardHeaderHover : null,
              strikeEligible && !isSelected ? styles.conceptCardHeaderRiposte : null,
            ]}>
              <Text
                style={[
                  styles.conceptCardName,
                  styles.conceptCardNameDecision,
                  { color: enabled ? '#E8EFEC' : OTT.textSecondary },
                ]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {abilityName}
              </Text>
              <Text
                style={[styles.conceptCardApCost, { color: costColor }]}
                numberOfLines={1}
              >
                {`${decision.apCost} AP`}
              </Text>
            </View>
            <View style={[
              styles.conceptCardPress,
              styles.conceptCardPressDecision,
              groupedDashboard ? styles.conceptCardPressGrouped : null,
            ]}>
              {strikeEligible ? (
                <Text
                  style={[styles.riposteBadge, { opacity: enabled ? 1 : 0.55 }]}
                  numberOfLines={1}
                >
                  RIPOSTE +16
                </Text>
              ) : null}
              {/* Hover/selected: name + AP only — damage/tags stay off the popup stack. */}
              {!hideCardScanLines && dualHint ? (
                <Text style={[styles.conceptCardEffect, { color: OTT.cyanSelect }]} numberOfLines={1}>
                  {dualHint}
                </Text>
              ) : null}
              {!hideCardScanLines && !dualHint && decision.effectLine ? (
                <Text
                  style={[
                    styles.conceptCardEffect,
                    { color: enabled ? '#F2F6F4' : OTT.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {decision.effectLine}
                </Text>
              ) : null}
              {!hideCardScanLines && decision.keyword ? (
                <Text
                  style={[
                    styles.conceptCardKeyword,
                    { color: OTT.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {decision.keyword}
                </Text>
              ) : null}
              {needsConfirm ? (
                <HapticPressable
                  onPress={onConfirm}
                  style={[
                    styles.conceptConfirmBtn,
                    combatConsoleChromeStyle({ accent: OTT.cyanSelect, tone: 'awake' }),
                  ]}
                >
                  <Text style={styles.conceptConfirmLabel}>{confirmLabel}</Text>
                </HapticPressable>
              ) : null}
            </View>
            {lockCopy ? (
              <View style={[
                styles.conceptCardLockFooter,
                invalidTarget ? styles.conceptCardLockFooterTarget : null,
              ]}>
                <Text style={styles.conceptCardLockHeadline}>{lockCopy.headline}</Text>
                <Text style={styles.conceptCardLockDetail} numberOfLines={1}>
                  {lockCopy.detail}
                </Text>
              </View>
            ) : null}
          </HapticPressable>
        </View>
      );
    }

    return (
      <View
        key={ability}
        style={[
          styles.tileSlot,
          {
            borderColor: tileBorderColor,
            borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
            backgroundColor: isSelected ? 'rgba(69, 247, 160, 0.1)' : OTT.deepPanel,
            shadowColor: isSelected ? OTT.terminalGreen : 'transparent',
            shadowOpacity: isSelected ? 0.35 : 0,
            shadowRadius: isSelected ? 6 : 0,
            ...(tileHeight != null ? { height: tileHeight } : null),
          },
        ]}
      >
        <HapticPressable
          onPress={() => canSelectActions && onSelectAbility(ability)}
          disabled={!canSelectActions}
          style={[styles.deckTile, { opacity: enabled ? 1 : 0.38 }]}
        >
          <Text style={[styles.tileSlotIndex, { color: isSelected ? OTT.terminalGreen : OTT.textMuted }]}>
            {`${String(Math.max(1, loadout.indexOf(ability) + 1)).padStart(2, '0')} //`}
          </Text>
          <Text
            style={[
              styles.tileLabel,
              desktopLabelStyle,
              { color: enabled ? (accent || OTT.textPrimary) : OTT.textMuted },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {labelFor(ability)}
          </Text>
          {costImpact ? (
            <Text style={styles.tileMeta} numberOfLines={1}>
              {costImpact}
            </Text>
          ) : null}
        </HapticPressable>
      </View>
    );
  };

  const canExecute = selectedAbility ? isActionEnabled(selectedAbility) : false;

  const desktopMetaLabelStyle = desktopDeck ? {
    fontSize: scaleCombatFont(9),
    letterSpacing: 0.35,
    lineHeight: scaleCombatFont(12),
  } : null;

  // Dashboard: neutral default; cyan/mint on hover/focus; amber if staged action would be abandoned.
  const abandonWarning = dashboardLayout && Boolean(selectedAbility);
  const endTurnEmphasized = dashboardLayout
    ? (endTurnHot || abandonWarning || initiativeQueued)
    : true;
  const endTurnAccent = !canEndTurn
    ? UTILITY_CARD_ACCENT
    : abandonWarning
      ? OTT.warningAmber
      : (dashboardLayout ? OTT.cyanSelect : END_TURN_BORDER);
  const endTurnText = !canEndTurn
    ? mutedColor
    : abandonWarning
      ? OTT.warningAmber
      : endTurnEmphasized
        ? (dashboardLayout ? OTT.cyanSelect : END_TURN_ENABLED)
        : OTT.textSecondary;
  const endTurnChromeTone = !canEndTurn
    ? 'disabled' as const
    : (endTurnHot || endTurnEmphasized)
      ? 'awake' as const
      : 'rest' as const;

  const renderEndTurnButton = () => (
    initiativeQueued ? (
      <Animated.View
        style={[
          styles.endTurnBtn,
          dashboardLayout ? styles.endTurnBtnConsole : null,
          combatConsoleChromeStyle({ accent: OTT.cyanSelect, tone: 'awake' }),
          {
            borderColor: queuedBorderColor,
            opacity: canEndTurn ? 1 : 0.4,
            ...(dashboardLayout ? null : desktopBtnStyle),
          },
        ]}
      >
        <HapticPressable
          onPress={onEndTurn}
          disabled={!canEndTurn}
          style={styles.endTurnPressable}
        >
          <Text style={[
            styles.endTurnLabel,
            dashboardLayout && styles.endTurnLabelConsole,
            dashboardLayout ? null : desktopActionLabelStyle,
            { color: END_TURN_ENABLED },
          ]}>
            END TURN
          </Text>
        </HapticPressable>
      </Animated.View>
    ) : (
      <HapticPressable
        onPress={onEndTurn}
        disabled={!canEndTurn}
        onHoverIn={() => setEndTurnHot(true)}
        onHoverOut={() => setEndTurnHot(false)}
        style={[
          styles.endTurnBtn,
          dashboardLayout ? styles.endTurnBtnConsole : null,
          combatConsoleChromeStyle({ accent: endTurnAccent, tone: endTurnChromeTone }),
          {
            opacity: canEndTurn ? 1 : 0.55,
            ...(dashboardLayout ? null : desktopBtnStyle),
          },
        ]}
      >
        <Text style={[
          styles.endTurnLabel,
          dashboardLayout && styles.endTurnLabelConsole,
          dashboardLayout ? null : desktopActionLabelStyle,
          { color: endTurnText },
        ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          END TURN
        </Text>
      </HapticPressable>
    )
  );

  const renderCombatReloadButton = () => {
    if (!combatReloadAvailable) return null;
    if (dashboardLayout) {
      return (
        <HapticPressable
          onPress={onCombatReload}
          disabled={!combatReloadEnabled}
          style={[
            styles.catalystTile,
            {
              borderColor: combatReloadEnabled ? OTT.warningAmber : OTT.borderSubtle,
              opacity: combatReloadEnabled ? 1 : 0.42,
            },
          ]}
        >
          <Text style={[styles.catalystTitle, { color: combatReloadEnabled ? OTT.warningAmber : OTT.textSecondary }]}>
            RELOAD
          </Text>
          <Text style={styles.catalystSub}>CLASS ACTION</Text>
          <Text style={[styles.catalystStatus, { color: combatReloadEnabled ? OTT.warningAmber : OTT.textMuted }]}>
            {combatReloadEnabled ? 'READY' : 'LOCKED'}
          </Text>
        </HapticPressable>
      );
    }
    return (
      <HapticPressable
        onPress={onCombatReload}
        disabled={!combatReloadEnabled}
        style={[
          styles.combatReloadBtn,
          {
            borderColor: combatReloadEnabled ? '#fbbf24' : borderColor,
            opacity: combatReloadEnabled ? 1 : 0.4,
            ...desktopBtnStyle,
          },
        ]}
      >
        <Text
          style={[
            styles.combatReloadLabel,
            desktopActionLabelStyle,
            { color: combatReloadEnabled ? '#fbbf24' : mutedColor },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          [ RELOAD ]
        </Text>
      </HapticPressable>
    );
  };

  const renderCatalyticConsoleButton = () => {
    if (!catalyticConsoleAvailable) return null;
    const ready = catalyticConsoleEnabled && catalyticConsoleRotStacks > 0;
    const accent = ready ? OTT.terminalGreen : OTT.borderSubtle;
    const statusLabel = ready ? 'READY' : catalyticConsoleRotStacks > 0 ? 'LOCKED' : 'CHARGING';
    if (dashboardLayout) {
      return (
        <HapticPressable
          onPress={onCatalyticConsole}
          disabled={!catalyticConsoleEnabled}
          style={[
            styles.catalystTile,
            {
              borderColor: accent,
              opacity: catalyticConsoleEnabled ? 1 : 0.42,
            },
          ]}
        >
          <Text style={[styles.catalystTitle, { color: ready ? OTT.terminalGreen : OTT.textSecondary }]}>
            CATALYST
          </Text>
          <Text style={styles.catalystSub}>CLASS ACTION</Text>
          <Text style={[styles.catalystStatus, { color: ready ? OTT.terminalGreenMuted : OTT.textMuted }]}>
            {statusLabel}
          </Text>
        </HapticPressable>
      );
    }
    return (
      <HapticPressable
        onPress={onCatalyticConsole}
        disabled={!catalyticConsoleEnabled}
        style={[
          dashboardTwinBtnStyle,
          styles.combatReloadBtn,
          {
            borderColor: catalyticConsoleEnabled ? accent : borderColor,
            opacity: catalyticConsoleEnabled ? 1 : 0.4,
            ...desktopBtnStyle,
          },
        ]}
      >
        <Text
          style={[
            styles.combatReloadLabel,
            desktopActionLabelStyle,
            { color: catalyticConsoleEnabled ? accent : mutedColor },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          CATALYST
        </Text>
      </HapticPressable>
    );
  };

  const renderVoidWardButton = () => {
    if (!voidWardAvailable) return null;
    const primed = voidWardPrimed;
    const enabled = voidWardEnabled && !primed;
    const accent = primed || enabled
      ? OTT.terminalGreen
      : OTT.borderSubtle;
    const statusLabel = primed ? 'WARD PRIMED' : enabled ? 'READY' : 'LOCKED';
    if (dashboardLayout) {
      return (
        <HapticPressable
          onPress={onVoidWardPrime}
          disabled={!enabled}
          style={[
            styles.catalystTile,
            {
              borderColor: accent,
              backgroundColor: primed || enabled
                ? 'rgba(69, 247, 160, 0.05)'
                : 'rgba(8, 12, 14, 0.42)',
              opacity: primed || enabled ? 1 : 0.42,
            },
          ]}
        >
          <Text style={[styles.catalystTitle, { color: accent === OTT.borderSubtle ? OTT.textSecondary : accent }]}>
            PARRY
          </Text>
          <Text style={styles.catalystSub}>CLASS ACTION</Text>
          <Text style={[styles.catalystStatus, { color: accent === OTT.borderSubtle ? OTT.textMuted : accent }]}>
            {statusLabel}
          </Text>
        </HapticPressable>
      );
    }
    return (
      <HapticPressable
        onPress={onVoidWardPrime}
        disabled={!enabled}
        style={[
          styles.combatReloadBtn,
          {
            borderColor: primed || enabled
              ? OTT.terminalGreen
              : borderColor,
            opacity: primed || enabled ? 1 : 0.4,
            ...desktopBtnStyle,
          },
        ]}
      >
        <Text
          style={[
            styles.combatReloadLabel,
            desktopActionLabelStyle,
            {
              color: primed || enabled
                ? OTT.terminalGreen
                : mutedColor,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {primed ? '[ WARD PRIMED ]' : '[ PARRY ]'}
        </Text>
      </HapticPressable>
    );
  };

  const renderSecondaryActions = () => {
    if (!bloodForTimeAvailable) return null;
    return (
      <View style={styles.secondaryActionsRow}>
        {bloodForTimeAvailable ? (
          <HapticPressable
            onPress={onBloodForTime}
            disabled={!bloodForTimeEnabled}
            style={[
              styles.bloodForTimeBtn,
              {
                borderColor: bloodForTimeEnabled ? '#c41e1e' : borderColor,
                opacity: bloodForTimeEnabled ? 1 : 0.4,
              },
            ]}
          >
            <Text
              style={[styles.bloodForTimeLabel, { color: bloodForTimeEnabled ? '#f87171' : mutedColor }]}
              numberOfLines={1}
            >
              [ BLOOD FOR TIME ]
            </Text>
          </HapticPressable>
        ) : null}
      </View>
    );
  };

  const renderStagedActionRow = () => {
    if (dashboardLayout) {
      return (
        <View style={[styles.stagedActionRow, styles.stagedActionRowDashboard]}>
          <View style={[
            styles.tileSlot,
            {
              borderColor: primaryColor,
              borderWidth: desktopDeck ? 2 : 1,
              ...(tileHeight != null ? { height: tileHeight } : null),
              minHeight: desktopDeck ? scaleCombatSize(44) : DASHBOARD_END_TURN_HEIGHT,
            },
          ]}>
            <HapticPressable
              onPress={onConfirm}
              disabled={!canExecute}
              style={[styles.deckTile, { opacity: canExecute ? 1 : 0.45 }]}
            >
              <Text style={[
                styles.tileLabel,
                styles.tileLabelDashboard,
                desktopLabelStyle,
                { color: primaryColor },
              ]}>
                [ EXECUTE ]
              </Text>
            </HapticPressable>
          </View>
          <View style={[
            styles.tileSlot,
            {
              borderColor,
              borderWidth: desktopDeck ? 2 : 1,
              ...(tileHeight != null ? { height: tileHeight } : null),
              minHeight: desktopDeck ? scaleCombatSize(44) : DASHBOARD_END_TURN_HEIGHT,
            },
          ]}>
            <HapticPressable onPress={onAbort} style={styles.deckTile}>
              <Text style={[
                styles.tileLabel,
                styles.tileLabelDashboard,
                desktopLabelStyle,
                { color: mutedColor },
              ]}>
                [ ABORT ]
              </Text>
            </HapticPressable>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.stagedActionRow, dashboardLayout && styles.stagedActionRowDashboard]}>
        <View style={[styles.tileSlot, { borderColor: primaryColor, height: tileHeight }]}>
          <HapticPressable
            onPress={onConfirm}
            disabled={!canExecute}
            style={[styles.deckTile, { opacity: canExecute ? 1 : 0.45 }]}
          >
            <Text style={[styles.tileLabel, { color: primaryColor }]}>
              [ EXECUTE ]
            </Text>
          </HapticPressable>
        </View>
        <View style={[styles.tileSlot, { borderColor, height: tileHeight }]}>
          <HapticPressable onPress={onAbort} style={styles.deckTile}>
            <Text style={[styles.tileLabel, { color: mutedColor }]}>
              [ ABORT ]
            </Text>
          </HapticPressable>
        </View>
      </View>
    );
  };

  const renderStagedMeta = () => {
    if (!selectedAbility) return null;
    const disableReason = !canExecute ? getActionDisableReason?.(selectedAbility) : null;
    const metaTextStyle = [
      styles.execCost,
      dashboardLayout && styles.execCostDashboard,
      desktopMetaLabelStyle ?? (dashboardLayout ? styles.execCostDashboard : null),
      { color: mutedColor },
    ];
    return (
      <View style={[styles.stagedMeta, dashboardLayout && styles.stagedMetaDashboard]}>
        {!webStagedFocus ? (
          <Text
            style={metaTextStyle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {getStagedCostImpact(selectedAbility)}
          </Text>
        ) : null}
        {disableReason ? (
          <Text
            style={[
              styles.execBlocked,
              dashboardLayout && styles.execBlockedDashboard,
              desktopMetaLabelStyle,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {`BLOCKED: ${disableReason}`}
          </Text>
        ) : null}
        <Text
          style={[
            styles.execDetail,
            dashboardLayout && styles.execDetailDashboard,
            desktopMetaLabelStyle ?? (dashboardLayout ? styles.execDetailDashboard : null),
            { color: mutedColor },
          ]}
          numberOfLines={dashboardLayout ? 4 : 3}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {getStagedAbilityDescription(selectedAbility)}
        </Text>
      </View>
    );
  };

  const renderStagedPanel = () => (
    <View style={[styles.stagedPanel, dashboardLayout && styles.stagedPanelDashboard]}>
      {webStagedFocus
        ? renderWebStagedApRow()
        : (dashboardLayout ? renderDashboardTopBand(false) : null)}
      {renderStagedActionRow()}
      {renderStagedMeta()}
    </View>
  );

  /**
   * Dedicated class-core mechanic module — outside the seven-card rail.
   * Shared silhouette for Parry / Reload / Rift Ward.
   */
  const renderClassMechanicControl = () => {
    if (!dashboardLayout) return null;

    type MechanicSpec = {
      key: string;
      coreLabel: string;
      title: string;
      glyph: string;
      status: string;
      binding: string;
      accent: string;
      fill: string;
      ready: boolean;
      pressable: boolean;
      onPress?: () => void;
      hoverKey: string;
      detail: string;
    };

    let spec: MechanicSpec | null = null;

    if (combatReloadAvailable) {
      const ready = combatReloadEnabled;
      spec = {
        key: 'class-mechanic-reload',
        coreLabel: 'HEX CORE',
        title: 'RELOAD',
        glyph: '◈',
        status: ready ? 'READY' : 'LOCKED',
        binding: 'R',
        accent: ready ? OTT.cyanSelect : OTT.borderSubtle,
        fill: 'rgba(8, 14, 16, 0.92)',
        ready,
        pressable: true,
        onPress: onCombatReload,
        hoverKey: '__CLASS_RELOAD__',
        detail: ready ? 'Phase-Shift Reload — spend 1 AP to refill the magazine.' : 'Reload locked.',
      };
    } else if (voidWardAvailable) {
      const primed = voidWardPrimed;
      const enabled = voidWardEnabled && !primed;
      const ready = primed || enabled;
      spec = {
        key: 'class-mechanic-parry',
        coreLabel: 'AEGIS CORE',
        title: 'PARRY',
        glyph: '⬡',
        status: primed ? 'PRIMED' : enabled ? 'READY' : 'LOCKED',
        binding: 'P',
        accent: ready ? OTT.cyanSelect : OTT.borderSubtle,
        fill: 'rgba(8, 14, 16, 0.92)',
        ready,
        pressable: true,
        onPress: onVoidWardPrime,
        hoverKey: '__CLASS_PARRY__',
        detail: primed
          ? 'Void Ward primed — intercept the next qualifying strike.'
          : enabled
            ? 'Prime Void Ward for a kinetic intercept window.'
            : 'Parry locked.',
      };
    } else if (riftWardAvailable) {
      const ready = riftWardReady;
      spec = {
        key: 'class-mechanic-rift-ward',
        coreLabel: 'ENVOY CORE',
        title: 'RIFT WARD',
        glyph: '◈',
        status: ready ? 'ARMED' : 'SPENT',
        binding: '',
        accent: ready ? OTT.cyanSelect : OTT.borderSubtle,
        fill: 'rgba(8, 14, 16, 0.92)',
        ready,
        pressable: false,
        hoverKey: '__CLASS_RIFT_WARD__',
        detail: ready
          ? 'Intrinsic reactive ward — armed this cycle.'
          : 'Ward spent this cycle.',
      };
    }

    if (!spec) return null;

    const hovered = hoveredAbility === spec.hoverKey;
    const ring = hovered && spec.ready ? OTT.cyanSelect : spec.accent;
    const readyColor = spec.ready ? OTT.terminalGreenMuted : OTT.textMuted;
    const body = (
      <View style={styles.mechanicModuleInner}>
        <View style={styles.mechanicTitleRow}>
          <Text style={[styles.mechanicGlyph, { color: spec.ready ? OTT.cyanSelect : OTT.textMuted }]}>
            {spec.glyph}
          </Text>
          <Text
            style={[styles.mechanicTitle, { color: spec.ready ? '#E8EFEC' : OTT.textMuted }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {spec.title}
          </Text>
        </View>
        <View style={styles.mechanicStatusRow}>
          <Text style={[styles.mechanicStatus, { color: readyColor }]}>
            {spec.status}
          </Text>
          {spec.binding ? (
            <View style={[styles.mechanicKeycap, { borderColor: spec.ready ? OTT.cyanSelect : OTT.borderSubtle }]}>
              <Text style={[styles.mechanicKeycapLabel, { color: spec.ready ? OTT.cyanSelect : OTT.textMuted }]}>
                {spec.binding}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );

    const shellStyle = [
      styles.mechanicModuleShell,
      combatConsoleChromeStyle({
        accent: ring,
        tone: !spec.ready ? 'disabled' : hovered ? 'awake' : 'rest',
      }),
      {
        height: mechanicModuleHeight,
        opacity: spec.ready ? 1 : 0.7,
      },
    ];

    const module = (
      <View key={spec.key} style={styles.mechanicModule}>
        <Text style={[styles.mechanicCoreLabel, { color: spec.ready ? ring : OTT.textMuted }]}>
          {spec.coreLabel}
        </Text>
        {spec.pressable ? (
          <HapticPressable
            onPress={spec.onPress}
            disabled={!spec.ready || (voidWardAvailable && voidWardPrimed)}
            onHoverIn={() => setHoveredAbility(spec!.hoverKey)}
            onHoverOut={() => setHoveredAbility((current) => (current === spec!.hoverKey ? null : current))}
            accessibilityHint={spec.detail}
            style={shellStyle}
          >
            {body}
          </HapticPressable>
        ) : (
          <HapticPressable
            onPress={() => undefined}
            haptic={false}
            sfx={false}
            onHoverIn={() => setHoveredAbility(spec!.hoverKey)}
            onHoverOut={() => setHoveredAbility((current) => (current === spec!.hoverKey ? null : current))}
            accessibilityHint={spec.detail}
            style={shellStyle}
          >
            {body}
          </HapticPressable>
        )}
        {hovered ? (
          <View style={styles.mechanicTooltip} pointerEvents="none">
            <Text style={styles.cardTooltipText} numberOfLines={3}>{spec.detail}</Text>
          </View>
        ) : null}
      </View>
    );

    return module;
  };

  const renderAbilityGrid = () => {
    const groupedSurface = weaponActionCount > 0 && techniqueCount > 0;
    const weaponCards = groupedSurface
      ? loadout.slice(0, weaponActionCount)
      : loadout.slice(0, 4);
    const techniqueCards = groupedSurface
      ? loadout.slice(weaponActionCount, weaponActionCount + techniqueCount)
      : [];

    if (dashboardLayout) {
      if (groupedSurface) {
        const railBody = (
          <View style={styles.conceptGroupedHost}>
            <View style={styles.conceptGroupBlock}>
              <View style={styles.conceptCardRow}>
                {weaponCards.map((ability) => renderTile(ability, { group: 'weapon' }))}
              </View>
            </View>
            <View style={styles.railDivider} accessibilityLabel="weapon-technique divider" />
            <View style={styles.conceptGroupBlock}>
              <View style={styles.conceptCardRow}>
                {techniqueCards.map((ability) => renderTile(ability, { group: 'technique' }))}
              </View>
            </View>
          </View>
        );
        return (
          <View style={styles.commandRailShell}>
            {desktopDeck ? (
              <View style={styles.commandRailScrollContent}>{railBody}</View>
            ) : (
              <ScrollView
                ref={railScrollRef}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator
                style={styles.commandRailScroll}
                contentContainerStyle={styles.commandRailScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {railBody}
              </ScrollView>
            )}
            {!desktopDeck ? (
              <Text style={styles.railScrollHint} numberOfLines={1}>
                SWIPE FOR MORE
              </Text>
            ) : null}
          </View>
        );
      }
      return (
        <View style={styles.conceptCardRow}>
          {weaponCards.map((ability) => renderTile(ability, { group: 'weapon' }))}
        </View>
      );
    }
    if (groupedSurface) {
      return (
        <View style={styles.deckBody}>
          <View style={styles.abilityGrid}>
            <View style={styles.abilityRow}>
              {renderTile(weaponCards[0], { group: 'weapon' })}
              {renderTile(weaponCards[1], { group: 'weapon' })}
            </View>
            <View style={styles.abilityRow}>
              {renderTile(weaponCards[2], { group: 'weapon' })}
              {renderTile(weaponCards[3], { group: 'weapon' })}
            </View>
          </View>
          <View style={[styles.abilityGrid, { marginTop: 8 }]}>
            <View style={styles.abilityRow}>
              {renderTile(techniqueCards[0], { group: 'technique' })}
              {renderTile(techniqueCards[1], { group: 'technique' })}
              {renderTile(techniqueCards[2], { group: 'technique' })}
            </View>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.deckBody}>
        <View style={styles.abilityGrid}>
          <View style={styles.abilityRow}>
            {renderTile(loadout[0])}
            {renderTile(loadout[1])}
          </View>
          <View style={styles.abilityRow}>
            {renderTile(loadout[2])}
            {renderTile(loadout[3])}
          </View>
        </View>
      </View>
    );
  };

  const renderConceptDashboard = () => (
    <View style={styles.conceptDeck}>
      <View style={styles.conceptDockStage}>
        <View style={styles.commandDockPlate}>
          <View style={styles.conceptApBand}>
            <CombatApPipRow
              current={shownAp}
              max={maxActionPoints}
              accent={OTT.cyanSelect}
              mutedColor={OTT.cyanSelect}
              queued={initiativeQueued}
              conceptBand
              centered
              hexSize={12}
              labelFontSize={11}
            />
          </View>
          <View style={styles.commandRailWithMechanic}>
            {renderAbilityGrid()}
            <View style={styles.mechanicEndCapDivider} />
            <View style={styles.mechanicColumn}>
              {renderClassMechanicControl()}
            </View>
          </View>
        </View>
      </View>
      <View style={styles.systemModule}>
        {catalyticConsoleAvailable ? (
          <View style={styles.conceptActionSlotTall}>
            {renderCatalyticConsoleButton()}
          </View>
        ) : null}
        <View style={styles.systemModuleChrome}>
          <RunFeedChromeButtons
            accent={OTT.cyanSelect}
            mutedColor={OTT.textMuted}
            terminal
            systemModule
          />
        </View>
        <View style={styles.systemModuleEndTurn}>
          {renderEndTurnButton()}
        </View>
      </View>
    </View>
  );

  const activeHoverPopup =
    hoverPopup
    && hoveredAbility === hoverPopup.ability
    && hoverPopup.body
      ? hoverPopup
      : null;
  const hoverPanelTop = activeHoverPopup
    ? (Platform.OS === 'web'
      ? Math.max(8, activeHoverPopup.y - activeHoverPopup.height - 6)
      : activeHoverPopup.y - activeHoverPopup.height - 6)
    : 0;
  const hoverPanel = activeHoverPopup
    ? (
      <View
        pointerEvents="none"
        style={[
          styles.cardHoverDetailFloating,
          {
            left: activeHoverPopup.x,
            top: hoverPanelTop,
            width: activeHoverPopup.width,
            height: activeHoverPopup.height,
          },
        ]}
      >
        <Text style={styles.cardHoverDetailText}>
          {activeHoverPopup.body}
        </Text>
      </View>
    )
    : null;

  return (
    <View
      ref={deckHostRef}
      style={[styles.deckHost, dashboardLayout && styles.deckHostDashboard]}
      collapsable={false}
    >
      {Platform.OS === 'web' ? renderAbilityHoverPortal(hoverPanel) : hoverPanel}
      {floatVisible ? (
        <Animated.Text
          style={[
            styles.initiativeFloat,
            {
              color: INITIATIVE_GLOW_PALE,
              opacity: floatOpacity,
              transform: [{ translateY: floatTranslateY }, { scale: floatScale }],
              ...textGlow({ color: INITIATIVE_GLOW, radius: 8, offset: { width: 0, height: 0 } }),
              pointerEvents: 'none',
            },
          ]}
        >
          INITIATIVE SEIZED
        </Animated.Text>
      ) : null}

      <View style={[styles.deckShellWrap, dashboardLayout && styles.deckShellWrapDashboard]}>
        <Animated.View
          style={[
            styles.surgeRing,
            {
              opacity: surgeOpacity,
              transform: [{ scale: surgeScale }],
              borderColor: INITIATIVE_GLOW_PALE,
              ...viewShadow({
                color: INITIATIVE_GLOW,
                opacity: 0.85,
                radius: 14,
                offset: { width: 0, height: 0 },
              }),
              pointerEvents: 'none',
            },
          ]}
        />

        <View style={[deckShellStyle, dashboardLayout && styles.commandDeckDashboard]}>
          {dashboardLayout ? (
            renderConceptDashboard()
          ) : selectedAbility ? (
            renderStagedPanel()
          ) : (
            <>
              <View style={styles.apRow}>
                <CombatApPipRow
                  current={shownAp}
                  max={maxActionPoints}
                  accent={primaryColor}
                  mutedColor={mutedColor}
                  queued={initiativeQueued}
                />
                <View style={styles.apActions}>
                  {renderVoidWardButton()}
                  {renderCatalyticConsoleButton()}
                  {renderCombatReloadButton()}
                  {bloodForTimeAvailable ? (
                    <HapticPressable
                      onPress={onBloodForTime}
                      disabled={!bloodForTimeEnabled}
                      style={[
                        styles.bloodForTimeBtn,
                        {
                          borderColor: bloodForTimeEnabled ? '#c41e1e' : borderColor,
                          opacity: bloodForTimeEnabled ? 1 : 0.4,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.bloodForTimeLabel, { color: bloodForTimeEnabled ? '#f87171' : mutedColor }]}
                        numberOfLines={1}
                      >
                        [ BLOOD FOR TIME ]
                      </Text>
                    </HapticPressable>
                  ) : null}
                  {renderEndTurnButton()}
                </View>
              </View>
              {renderAbilityGrid()}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deckHost: {
    width: '100%',
    position: 'relative',
  },
  deckHostDashboard: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  deckShellWrap: {
    width: '100%',
    position: 'relative',
  },
  deckShellWrapDashboard: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
  },
  surgeRing: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
  },
  initiativeFloat: {
    position: 'absolute',
    top: -18,
    alignSelf: 'center',
    zIndex: 4,
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  commandDeck: {
    flexShrink: 0,
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 4,
    paddingBottom: 2,
    gap: GRID_GAP,
  },
  commandDeckFrameless: {
    borderTopWidth: 0,
    paddingTop: 3,
    paddingBottom: 2,
  },
  commandDeckDashboard: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
    flexDirection: 'column',
    borderTopWidth: 0,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 0,
    justifyContent: 'flex-end',
  },
  topBand: {
    flexShrink: 0,
    minHeight: AP_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    width: '100%',
  },
  topBandDashboard: {
    justifyContent: 'space-between',
    gap: 0,
  },
  apColumn: {
    width: '48%',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webStagedApColumn: {
    width: '100%',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    width: '100%',
  },
  abilitiesSection: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
  },
  apRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: GRID_GAP,
    width: '100%',
  },
  apActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID_GAP,
    flexShrink: 0,
  },
  apActionsDashboard: {
    width: '48%',
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: GRID_GAP,
  },
  dashboardTwinActionBtn: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: DASHBOARD_MINIGAME_BTN_HEIGHT,
    borderWidth: 1,
    paddingHorizontal: 2,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bloodForTimeBtn: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: 108,
    alignItems: 'center',
    backgroundColor: DOSSIER_ROW_BG,
  },
  combatReloadBtn: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: 88,
    alignItems: 'center',
    backgroundColor: DOSSIER_ROW_BG,
  },
  combatReloadBtnDashboard: {
    maxWidth: 68,
    paddingHorizontal: 3,
    flexShrink: 0,
  },
  combatMinigameBtnDashboard: {
    flex: 1,
    maxWidth: undefined,
    minWidth: 0,
    minHeight: DASHBOARD_MINIGAME_BTN_HEIGHT,
    paddingVertical: 5,
    justifyContent: 'center',
  },
  combatMinigameLabelDashboard: {
    fontSize: 6,
    letterSpacing: 0.25,
  },
  combatReloadLabel: {
    fontFamily: MONO,
    fontSize: 6,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  combatReloadLabelDashboard: {
    fontSize: 5.5,
    letterSpacing: 0.2,
  },
  bloodForTimeLabel: {
    fontFamily: MONO,
    fontSize: 6,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  endTurnBtn: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 88,
    alignItems: 'center',
    backgroundColor: DOSSIER_ROW_BG,
  },
  endTurnBtnConsole: {
    width: '100%',
    minHeight: 42,
    height: 42,
    paddingHorizontal: 10,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
    overflow: 'visible',
  },
  endTurnLabelConsole: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '800',
    textAlign: 'center',
  },
  conceptDeck: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 20,
    overflow: 'visible',
  },
  conceptDockStage: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  commandDockPlate: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'center',
    gap: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  conceptMain: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  conceptApBand: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
    maxHeight: 28,
    width: '100%',
    marginBottom: 0,
    zIndex: 1,
  },
  conceptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexShrink: 0,
  },
  conceptClassActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  commandRailWithMechanic: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    overflow: 'visible',
    zIndex: 2,
  },
  mechanicEndCapDivider: {
    width: 2,
    alignSelf: 'stretch',
    marginVertical: 10,
    backgroundColor: 'rgba(98, 220, 229, 0.35)',
  },
  commandRailShell: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 0,
    minHeight: 0,
    overflow: 'visible',
    zIndex: 2,
  },
  commandRailScroll: {
    flexGrow: 0,
    overflow: 'visible',
  },
  commandRailScrollContent: {
    flexGrow: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 0,
    overflow: 'visible',
  },
  railScrollHint: {
    marginTop: 2,
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.8,
    color: OTT.textMuted,
    textAlign: 'center',
  },
  conceptGroupedHost: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 0,
    overflow: 'visible',
  },
  conceptGroupBlock: {
    flexGrow: 0,
    flexShrink: 0,
    gap: 1,
    minWidth: 0,
    overflow: 'visible',
  },
  conceptGroupLabel: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '800',
    color: '#B8C4C0',
    textAlign: 'center',
    marginBottom: 1,
  },
  railDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginBottom: 2,
    marginTop: 2,
    backgroundColor: 'rgba(120, 140, 150, 0.28)',
  },
  conceptCardRow: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 7,
    overflow: 'visible',
  },
  /** Outer shell — hover detail lives here so Pressable overflow cannot clip it. */
  conceptCardShell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    maxWidth: 146,
    minWidth: 72,
    height: 198,
    position: 'relative',
    overflow: 'visible',
  },
  conceptCardShellGrouped: {
    maxWidth: 146,
    minWidth: 138,
    width: 142,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 142,
  },
  conceptCard: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
    overflow: 'visible',
    position: 'relative',
  },
  conceptCardGrouped: {
    width: '100%',
  },
  conceptCardSelected: {
    transform: [{ translateY: -2 }],
  },
  conceptCardHover: {
    transform: [{ translateY: -1 }],
  },
  /** Lift hovered shell so the above-card detail panel stacks over AP / siblings. */
  conceptCardHoverElevated: {
    zIndex: 80,
    elevation: 80,
  },
  conceptCardSelectEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: OTT.cyanSelect,
    zIndex: 2,
  },
  conceptCardHoverEdge: {
    backgroundColor: 'rgba(98, 220, 229, 0.7)',
    height: 2,
    opacity: 0.85,
  },
  conceptCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(120, 140, 150, 0.22)',
    backgroundColor: 'rgba(10, 14, 16, 0.55)',
  },
  conceptCardHeaderSelected: {
    backgroundColor: 'rgba(98, 220, 229, 0.14)',
    borderBottomColor: 'rgba(98, 220, 229, 0.4)',
  },
  conceptCardHeaderHover: {
    backgroundColor: 'rgba(98, 220, 229, 0.08)',
  },
  conceptCardHeaderRiposte: {
    backgroundColor: 'rgba(224, 180, 90, 0.1)',
  },
  conceptCardNameDecision: {
    flex: 1,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 0,
  },
  conceptCardApCost: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    flexShrink: 0,
    marginTop: 1,
  },
  conceptCardPressDecision: {
    paddingTop: 8,
    gap: 4,
  },
  conceptCardEffect: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.55,
    lineHeight: 15,
  },
  conceptCardKeyword: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    lineHeight: 12,
  },
  conceptCardLocked: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    lineHeight: 10,
    color: OTT.warningAmber,
    marginTop: 2,
  },
  conceptCardLockFooter: {
    marginTop: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(224, 180, 90, 0.45)',
    backgroundColor: 'rgba(224, 180, 90, 0.12)',
    gap: 1,
  },
  conceptCardLockFooterTarget: {
    borderTopColor: 'rgba(255, 90, 98, 0.5)',
    backgroundColor: 'rgba(255, 90, 98, 0.1)',
  },
  conceptCardLockHeadline: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: OTT.warningAmber,
  },
  conceptCardLockDetail: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#E8D4A0',
  },
  /** Window-fixed hover detail — portaled on web so dock/arena clips cannot crop it. */
  cardHoverDetailFloating: {
    ...(Platform.OS === 'web'
      ? ({ position: 'fixed' } as object)
      : { position: 'absolute' as const }),
    zIndex: 100000,
    elevation: 100000,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(98, 220, 229, 0.45)',
    backgroundColor: 'rgba(4, 7, 10, 0.96)',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  cardHoverDetailText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    lineHeight: 13,
    color: OTT.textSecondary,
  },
  cardTooltipText: {
    fontFamily: MONO,
    fontSize: 8,
    lineHeight: 11,
    letterSpacing: 0.2,
    color: OTT.textSecondary,
  },
  conceptCardWeapon: {
    borderStyle: 'solid',
  },
  conceptCardTechnique: {
    borderStyle: 'solid',
  },
  mechanicColumn: {
    flexGrow: 0,
    flexShrink: 0,
    width: 132,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingBottom: 0,
  },
  mechanicModule: {
    width: '100%',
    position: 'relative',
    gap: 3,
  },
  mechanicCoreLabel: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  mechanicModuleShell: {
    width: '100%',
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: 'visible',
    justifyContent: 'center',
  },
  mechanicModuleInner: {
    gap: 6,
    justifyContent: 'center',
  },
  mechanicTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mechanicStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mechanicGlyph: {
    fontFamily: MONO,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  mechanicControl: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 2,
    borderColor: OTT.terminalGreen,
    backgroundColor: 'rgba(69, 247, 160, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  mechanicInner: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  mechanicEyebrow: {
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.8,
    color: OTT.terminalGreen,
    fontWeight: '800',
  },
  mechanicTitle: {
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 17,
    flexShrink: 1,
  },
  mechanicStatus: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  mechanicKeycap: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 7, 10, 0.75)',
  },
  mechanicKeycapLabel: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  mechanicBinding: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.8,
    color: OTT.textMuted,
    marginTop: 1,
    textAlign: 'center',
  },
  mechanicDetail: {
    fontFamily: MONO,
    fontSize: 8,
    lineHeight: 10,
    color: OTT.textMuted,
  },
  mechanicTooltip: {
    position: 'absolute',
    left: -8,
    right: -8,
    bottom: '108%',
    zIndex: 20,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(130, 150, 160, 0.4)',
    backgroundColor: 'rgba(4, 7, 10, 0.96)',
  },
  conceptActionSlotTall: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 64,
    width: '100%',
    overflow: 'hidden',
  },
  conceptCardPress: {
    flex: 1,
    paddingHorizontal: 9,
    paddingVertical: 10,
    gap: 7,
  },
  conceptCardPressGrouped: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  conceptCardNameGrouped: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
  },
  conceptCardCategoryGrouped: {
    fontSize: 8,
  },
  conceptCardTagsGrouped: {
    fontSize: 8,
    lineHeight: 10,
  },
  conceptCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    minHeight: 18,
  },
  conceptCardTopSpacer: {
    flex: 1,
  },
  riposteBadge: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.6,
    color: OTT.warningAmber,
    marginRight: 4,
    alignSelf: 'center',
  },
  riposteStatusChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(224, 180, 90, 0.55)',
    backgroundColor: 'rgba(224, 180, 90, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
    borderRadius: 2,
  },
  riposteStatusTitle: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.8,
    color: OTT.warningAmber,
  },
  riposteStatusShort: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.3,
    color: 'rgba(224, 180, 90, 0.75)',
    marginTop: 2,
  },
  conceptSlot: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  apDiamondHost: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  apDiamond: {
    width: 14,
    height: 14,
    borderWidth: 1.25,
    backgroundColor: 'transparent',
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  apDiamondText: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '800',
    transform: [{ rotate: '-45deg' }],
  },
  conceptCardName: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.emphasis,
    fontWeight: '800',
    letterSpacing: 0.35,
    width: '100%',
    marginTop: 2,
  },
  conceptCardCategory: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: OTT.textSecondary,
    marginTop: 2,
  },
  conceptCardDesc: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.body,
    lineHeight: COMBAT_HUD_TYPE.lineBody,
    color: OTT.textPrimary,
    marginTop: 4,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  conceptCardSpacer: {
    flexGrow: 1,
    minHeight: 10,
  },
  conceptCardTags: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.caption,
    letterSpacing: 0.45,
    color: OTT.textMuted,
    marginTop: 4,
    lineHeight: COMBAT_HUD_TYPE.lineCaption,
    flexGrow: 1,
  },
  conceptArmed: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.micro,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: OTT.terminalGreen,
    marginTop: 2,
  },
  conceptConfirmBtn: {
    marginTop: 4,
    borderRadius: 2,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  conceptConfirmLabel: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: OTT.cyanSelect,
  },
  systemModule: {
    width: 148,
    flexShrink: 0,
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 2,
    overflow: 'visible',
  },
  systemModuleChrome: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  systemModuleEndTurn: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 42,
  },
  conceptClassBadge: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sideCommitBtn: {
    width: '100%',
    height: 40,
    maxHeight: 40,
    borderWidth: 1.5,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 0,
    overflow: 'hidden',
  },
  sideExecuteBtn: {
    borderColor: OTT.terminalGreen,
    backgroundColor: 'rgba(69, 247, 160, 0.08)',
  },
  sideExecuteLabel: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.label,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: OTT.terminalGreen,
  },
  sideAbortBtn: {
    borderColor: OTT.borderSubtle,
    backgroundColor: 'rgba(8, 12, 14, 0.55)',
  },
  sideAbortLabel: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.label,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: OTT.textSecondary,
  },
  sideCommitLabelMuted: {
    color: OTT.textMuted,
  },
  conceptTurnCol: {
    width: 132,
    flexShrink: 0,
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
    gap: 0,
    paddingBottom: 0,
    overflow: 'visible',
  },
  conceptTurnActions: {
    flexGrow: 0,
    flexShrink: 0,
    gap: 8,
    justifyContent: 'flex-end',
  },
  conceptActionSlot: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 42,
    width: '100%',
    overflow: 'visible',
  },
  conceptChromeSpacer: {
    height: 6,
    flexGrow: 0,
    flexShrink: 0,
  },
  conceptChrome: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
    minHeight: 96,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  catalystTile: {
    width: '100%',
    flex: 1,
    minHeight: 72,
    borderWidth: 1.5,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(98, 220, 229, 0.05)',
  },
  catalystTitle: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  catalystSub: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.8,
    color: OTT.textMuted,
    textAlign: 'center',
  },
  catalystStatus: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  endTurnPressable: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endTurnLabel: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: 'bold',
    letterSpacing: 0.4,
  },
  endTurnLabelDashboard: {
    fontSize: COMBAT_HUD_TYPE.label,
    letterSpacing: 1.1,
    fontWeight: '800',
    textAlign: 'center',
  },
  deckBody: {
    position: 'relative',
    width: '100%',
  },
  abilityGrid: {
    width: '100%',
    gap: GRID_GAP,
  },
  abilityGridDashboard: {
    flex: 1,
    minHeight: 0,
  },
  abilityRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GRID_GAP,
    width: '100%',
  },
  abilityRowDashboard: {
    flex: 1,
    minHeight: 0,
  },
  tileSlotDashboardFill: {
    minHeight: 0,
  },
  tileSlot: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: OTT.deepPanel,
    borderRadius: 2,
  },
  deckTile: {
    flex: 1,
    height: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 1,
  },
  tileSlotIndex: {
    fontFamily: MONO,
    fontSize: 5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  tileLabel: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'left',
  },
  tileLabelDashboard: {
    fontSize: 6,
    letterSpacing: 0.3,
  },
  tileMeta: {
    fontFamily: MONO,
    fontSize: 5,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: OTT.textSecondary,
  },
  tileArmed: {
    fontFamily: MONO,
    fontSize: 5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: OTT.terminalGreen,
  },
  stagedPanel: {
    width: '100%',
    gap: GRID_GAP,
  },
  stagedPanelDashboard: {
    flex: 1,
    minHeight: 0,
  },
  stagedActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GRID_GAP,
    width: '100%',
  },
  stagedActionRowDashboard: {
    flexShrink: 0,
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
  },
  stagedMeta: {
    width: '100%',
    gap: 2,
    paddingHorizontal: 2,
  },
  stagedMetaDashboard: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
  },
  execCost: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.2,
    lineHeight: 9,
    flexShrink: 0,
  },
  execCostDashboard: {
    lineHeight: 9,
  },
  execBlocked: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.2,
    lineHeight: 9,
    color: '#f87171',
    flexShrink: 0,
  },
  execBlockedDashboard: {
    lineHeight: 9,
  },
  execDetail: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.2,
    lineHeight: 9,
    flexShrink: 1,
  },
  execDetailDashboard: {
    lineHeight: 9,
  },
});
