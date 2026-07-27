import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import type { CargoRoutingAction, CargoRoutingDecision, RoutableCargoItem } from '../../types/postRunCargoRouting';
import {
  formatCargoRoutingActionLabel,
  supportsPartialCargoRouting,
} from '../../data/postRunCargoRoutingEngine';
import { getAppraisalBandLabel } from '../../data/sealedCasketAppraisalEngine';
import { formatSealedCargoWarning, isAppraisableSealedResource } from '../../data/sealedCargoEngine';
import {
  getResourceCategory,
  getResourceDisplayName,
  getResourcePrimaryRole,
  getResourceSellValue,
  hasResourceUsageTag,
  RESOURCE_REGISTRY,
} from '../../data/resourceRegistry';
import { sponsorDisplayName } from '../../utils/contractUi';
import { RUN_FIELD } from '../../theme/runFieldTokens';

const TERMINAL_GREEN = RUN_FIELD.mint;
const WARNING_COLOR = '#f59e0b';

interface CargoRoutingPanelProps {
  items: RoutableCargoItem[];
  decisions: CargoRoutingDecision[];
  autoStashedSummary: string;
  validationIssues?: string[];
  previewContractStatus?: string | null;
  previewContractProgress?: string | null;
  previewOperationProgress?: number;
  previewFenceCredits?: number;
  previewRivalCredits?: number;
  previewCasketCredits?: number;
  previewBetrayalSummary?: string | null;
  cabalCredits?: number;
  onAppraise?: (resourceId: CargoRoutingDecision['resourceId']) => void;
  onDecisionChange: (resourceId: CargoRoutingDecision['resourceId'], action: CargoRoutingAction) => void;
  onQuantityChange?: (resourceId: CargoRoutingDecision['resourceId'], quantity: number) => void;
  textColor: string;
  mutedColor: string;
  borderColor: string;
}

function actionChipLabel(
  action: CargoRoutingAction,
  item: RoutableCargoItem,
  routedQuantity: number,
): string {
  const preview = item.betrayalPreviewByAction[action];
  if (action === 'DELIVER_RIVAL_SPONSOR' && item.bribeOffer) {
    const sponsor = sponsorDisplayName(item.bribeOffer.rivalSponsorId);
    return `Accept ${sponsor} Offer (+${item.bribeOffer.credits} CR, +${item.bribeOffer.reputationGain} REP)`;
  }
  const base = formatCargoRoutingActionLabel(action);
  if (action === 'SELL_FENCE') {
    const unitValue = item.sealedSellValue ?? getResourceSellValue(item.resourceId);
    const payout = unitValue * routedQuantity;
    if (payout > 0) {
      return isAppraisableSealedResource(item.resourceId)
        ? `Sell Sealed (+${payout} CR)`
        : `${base} (+${payout} CR)`;
    }
  }
  if (action === 'OPEN_SEALED' || action === 'OPEN_AT_HUB') {
    const fee = item.openingFee ?? 0;
    const feeLabel = fee > 0 ? ` (−${fee} CR)` : ' (fee waived)';
    return `${base}${feeLabel}`;
  }
  if (action === 'CONTRIBUTE_OPERATION') {
    return `${base} (+progress)`;
  }
  if (preview?.originalSponsorRepDelta && preview.originalSponsorRepDelta < 0) {
    return `${base} (${preview.originalSponsorRepDelta} REP)`;
  }
  return base;
}

function sourceLabel(source: RoutableCargoItem['source']): string {
  return source === 'BANKED' ? 'Banked at safehouse' : 'Extracted on person';
}

function sectionTitleForItem(item: RoutableCargoItem): string {
  if (isAppraisableSealedResource(item.resourceId)) return 'Sealed Cargo / Contraband';
  if (item.isContractTarget) return 'Contract Cargo';
  if (item.isOperationTarget) return 'Operation Target';
  const category = getResourceCategory(item.resourceId);
  switch (category) {
    case 'UNSTABLE':
      return 'Unstable Cargo';
    case 'INTEL':
      return item.resourceId === 'smugglers-ledger' || item.resourceId === 'tarnished-dog-tags'
        ? 'Fence-Value Items'
        : 'Intel';
    case 'CONTRABAND':
      return 'Contraband';
    default:
      return 'Special Cargo';
  }
}

export default function CargoRoutingPanel({
  items,
  decisions,
  autoStashedSummary,
  validationIssues = [],
  previewContractStatus,
  previewContractProgress,
  previewOperationProgress = 0,
  previewFenceCredits = 0,
  previewRivalCredits = 0,
  previewCasketCredits = 0,
  previewBetrayalSummary = null,
  cabalCredits = 0,
  onAppraise,
  onDecisionChange,
  onQuantityChange,
  textColor,
  mutedColor,
  borderColor,
}: CargoRoutingPanelProps): React.JSX.Element {
  const grouped = useMemo(() => {
    const buckets = new Map<string, RoutableCargoItem[]>();
    items.forEach((item) => {
      const title = sectionTitleForItem(item);
      const list = buckets.get(title) ?? [];
      list.push(item);
      buckets.set(title, list);
    });
    return [...buckets.entries()];
  }, [items]);

  const decisionFor = (resourceId: CargoRoutingDecision['resourceId']) => (
    decisions.find((entry) => entry.resourceId === resourceId)
  );

  const actionFor = (resourceId: CargoRoutingDecision['resourceId']) => (
    decisionFor(resourceId)?.action
    ?? items.find((entry) => entry.resourceId === resourceId)?.recommendedAction
    ?? 'KEEP_STASH'
  );

  const quantityFor = (item: RoutableCargoItem) => (
    decisionFor(item.resourceId)?.quantity ?? item.quantity
  );

  return (
    <View style={styles.root}>
      <Text style={[styles.intro, { color: mutedColor }]}>
        Special cargo requires a routing decision. Stable materials were auto-stashed.
      </Text>
      <View style={[styles.autoStashBox, { borderColor }]}>
        <Text style={[styles.sectionLabel, { color: mutedColor }]}>AUTO-STASHED MATERIALS</Text>
        <Text style={[styles.autoStashText, { color: textColor }]}>{autoStashedSummary.toUpperCase()}</Text>
      </View>

      {previewContractStatus || previewOperationProgress > 0 || previewFenceCredits > 0 || previewRivalCredits > 0 || previewCasketCredits > 0 || previewBetrayalSummary ? (
        <View style={[styles.previewBox, { borderColor }]}>
          <Text style={[styles.sectionLabel, { color: mutedColor }]}>PROJECTED OUTCOME</Text>
          {previewContractStatus ? (
            <Text style={[styles.itemMeta, { color: textColor }]}>
              {`Contract: ${previewContractStatus}${previewContractProgress ? ` — ${previewContractProgress}` : ''}`}
            </Text>
          ) : null}
          {previewBetrayalSummary ? (
            <Text style={[styles.itemMeta, { color: WARNING_COLOR }]}>
              {previewBetrayalSummary.toUpperCase()}
            </Text>
          ) : null}
          {previewOperationProgress > 0 ? (
            <Text style={[styles.itemMeta, { color: TERMINAL_GREEN }]}>
              {`Operation progress: +${previewOperationProgress}`}
            </Text>
          ) : null}
          {previewFenceCredits > 0 ? (
            <Text style={[styles.itemMeta, { color: TERMINAL_GREEN }]}>
              {`Fence payout: +${previewFenceCredits} CR`}
            </Text>
          ) : null}
          {previewRivalCredits > 0 ? (
            <Text style={[styles.itemMeta, { color: TERMINAL_GREEN }]}>
              {`Rival payout: +${previewRivalCredits} CR`}
            </Text>
          ) : null}
          {previewCasketCredits > 0 ? (
            <Text style={[styles.itemMeta, { color: TERMINAL_GREEN }]}>
              {`Casket open credits: +${previewCasketCredits} CR`}
            </Text>
          ) : null}
        </View>
      ) : null}

      {validationIssues.length > 0 ? (
        <View style={[styles.previewBox, { borderColor: WARNING_COLOR }]}>
          <Text style={[styles.sectionLabel, { color: WARNING_COLOR }]}>ROUTING ISSUES</Text>
          {validationIssues.map((issue) => (
            <Text key={issue} style={[styles.warning, { color: WARNING_COLOR }]}>{issue}</Text>
          ))}
        </View>
      ) : null}

      {grouped.map(([sectionTitle, sectionItems]) => (
        <View key={sectionTitle} style={styles.section}>
          <Text style={[styles.sectionLabel, { color: mutedColor }]}>{sectionTitle.toUpperCase()}</Text>
          {sectionItems.map((item) => {
            const def = RESOURCE_REGISTRY[item.resourceId];
            const selectedAction = actionFor(item.resourceId);
            const routedQuantity = quantityFor(item);
            const partialRouting = supportsPartialCargoRouting(item);
            const sellValue = item.sealedSellValue ?? getResourceSellValue(item.resourceId);
            const sealedWarning = isAppraisableSealedResource(item.resourceId)
              ? formatSealedCargoWarning(item.isContractTarget, 'OPEN')
              : null;
            const appraiseWarning = isAppraisableSealedResource(item.resourceId) && item.canAppraise
              ? formatSealedCargoWarning(item.isContractTarget, 'APPRAISE')
              : null;
            const sellSealedWarning = isAppraisableSealedResource(item.resourceId)
              ? formatSealedCargoWarning(item.isContractTarget, 'SELL')
              : null;
            return (
              <View key={item.resourceId} style={[styles.itemCard, { borderColor }]}>
                <Text style={[styles.itemTitle, { color: textColor }]}>
                  {getResourceDisplayName(item.resourceId, true).toUpperCase()} x{item.quantity}
                </Text>
                <Text style={[styles.itemMeta, { color: mutedColor }]}>
                  {`${def.category} // ${getResourcePrimaryRole(item.resourceId)} // ${def.gridWidth}x${def.gridHeight}`}
                </Text>
                <Text style={[styles.itemMeta, { color: mutedColor }]}>
                  {`Source: ${sourceLabel(item.source).toUpperCase()}`}
                </Text>
                <Text style={[styles.itemMeta, { color: mutedColor }]}>
                  {def.usageTags.slice(0, 4).join(' / ').toUpperCase()}
                </Text>
                {item.isContractTarget ? (
                  <Text style={[styles.flag, { color: TERMINAL_GREEN }]}>CONTRACT TARGET</Text>
                ) : null}
                {item.trackedContractCargo ? (
                  <Text style={[styles.flag, { color: WARNING_COLOR }]}>TRACKED CONTRACT CARGO</Text>
                ) : null}
                {item.bribeOffer ? (
                  <View style={[styles.offerBox, { borderColor: WARNING_COLOR }]}>
                    <Text style={[styles.flag, { color: WARNING_COLOR }]}>RIVAL SPONSOR OFFER</Text>
                    <Text style={[styles.itemMeta, { color: textColor }]}>
                      {`${sponsorDisplayName(item.bribeOffer.rivalSponsorId).toUpperCase()} — +${item.bribeOffer.credits} CR // +${item.bribeOffer.reputationGain} REP`}
                    </Text>
                    <Text style={[styles.itemMeta, { color: mutedColor }]}>
                      {item.bribeOffer.flavorLine.toUpperCase()}
                    </Text>
                    <Text style={[styles.warning, { color: WARNING_COLOR }]}>
                      BETRAYAL — ORIGINAL CONTRACT WILL FAIL
                    </Text>
                  </View>
                ) : null}
                {item.isOperationTarget ? (
                  <Text style={[styles.flag, { color: TERMINAL_GREEN }]}>OPERATION TARGET</Text>
                ) : null}
                {sellValue > 0 && (hasResourceUsageTag(item.resourceId, 'FENCE_VALUE') || item.sealedSellValue) ? (
                  <Text style={[styles.itemMeta, { color: mutedColor }]}>
                    {item.sealedState === 'APPRAISED' && item.valueBand
                      ? `Appraised: ${getAppraisalBandLabel(item.valueBand, item.resourceId).toUpperCase()} // Sell sealed: ${sellValue} CR`
                      : `Fence value: ${sellValue} CR each`}
                  </Text>
                ) : null}
                {item.sealedState === 'SEALED' && item.appraisalFee ? (
                  <Text style={[styles.itemMeta, { color: mutedColor }]}>
                    {`Appraisal fee: ${item.appraisalFee} CR // Opening fee: ${item.openingFee ?? 100} CR`}
                  </Text>
                ) : null}
                {item.sealedState === 'APPRAISED' && item.openingFee === 0 ? (
                  <Text style={[styles.flag, { color: TERMINAL_GREEN }]}>OPENING FEE WAIVED</Text>
                ) : null}
                {appraiseWarning ? (
                  <Text style={[styles.warning, { color: WARNING_COLOR }]}>{appraiseWarning}</Text>
                ) : null}
                {sellSealedWarning ? (
                  <Text style={[styles.warning, { color: WARNING_COLOR }]}>{sellSealedWarning}</Text>
                ) : null}
                {sealedWarning ? (
                  <Text style={[styles.warning, { color: WARNING_COLOR }]}>{sealedWarning}</Text>
                ) : null}
                {item.contractWarning ? (
                  <Text style={[styles.warning, { color: WARNING_COLOR }]}>{item.contractWarning}</Text>
                ) : null}
                {hasResourceUsageTag(item.resourceId, 'ROUTE_INTEL') || hasResourceUsageTag(item.resourceId, 'SECTOR_ACCESS_INTEL') ? (
                  <Text style={[styles.warning, { color: WARNING_COLOR }]}>
                    SECTOR ACCESS INTEL — KEEP IN STASH // CANNOT FENCE // DISCARD REQUIRES CONFIRMATION
                  </Text>
                ) : null}
                <Text style={[styles.recommended, { color: TERMINAL_GREEN }]}>
                  {`Recommended: ${formatCargoRoutingActionLabel(item.recommendedAction)}`}
                </Text>
                {partialRouting ? (
                  <View style={styles.quantityRow}>
                    <Text style={[styles.itemMeta, { color: mutedColor }]}>
                      ROUTE QUANTITY
                    </Text>
                    <View style={styles.quantityControls}>
                      <HapticPressable
                        disabled={routedQuantity <= 1}
                        onPress={() => onQuantityChange?.(item.resourceId, routedQuantity - 1)}
                        style={({ pressed }) => [
                          styles.quantityButton,
                          { borderColor, opacity: routedQuantity <= 1 ? 0.45 : 1, backgroundColor: pressed ? '#0d1a12' : 'transparent' },
                        ]}
                      >
                        <Text style={[styles.quantityButtonText, { color: mutedColor }]}>-</Text>
                      </HapticPressable>
                      <Text style={[styles.quantityValue, { color: textColor }]}>
                        {`${routedQuantity}/${item.quantity}`}
                      </Text>
                      <HapticPressable
                        disabled={routedQuantity >= item.quantity}
                        onPress={() => onQuantityChange?.(item.resourceId, routedQuantity + 1)}
                        style={({ pressed }) => [
                          styles.quantityButton,
                          { borderColor, opacity: routedQuantity >= item.quantity ? 0.45 : 1, backgroundColor: pressed ? '#0d1a12' : 'transparent' },
                        ]}
                      >
                        <Text style={[styles.quantityButtonText, { color: mutedColor }]}>+</Text>
                      </HapticPressable>
                    </View>
                    {routedQuantity < item.quantity ? (
                      <Text style={[styles.itemMeta, { color: mutedColor }]}>
                        {`Remainder (${item.quantity - routedQuantity}) auto-kept in stash.`}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {item.canAppraise ? (
                  <HapticPressable
                    disabled={(item.appraisalFee ?? 0) > cabalCredits}
                    onPress={() => onAppraise?.(item.resourceId)}
                    style={({ pressed }) => [
                      styles.appraiseButton,
                      {
                        borderColor: TERMINAL_GREEN,
                        opacity: (item.appraisalFee ?? 0) > cabalCredits ? 0.45 : 1,
                        backgroundColor: pressed ? '#0d1a12' : '#102016',
                      },
                    ]}
                  >
                    <Text style={[styles.actionChipText, { color: TERMINAL_GREEN }]}>
                      {`APPRAISE (−${item.appraisalFee ?? 50} CR)`.toUpperCase()}
                    </Text>
                  </HapticPressable>
                ) : null}
                <View style={styles.actionRow}>
                  {item.validActions.filter((action) => action !== 'OPEN_AT_HUB').map((action) => {
                    const selected = selectedAction === action || (selectedAction === 'OPEN_AT_HUB' && action === 'OPEN_SEALED');
                    const disabled = !item.openAtHubEnabled
                      || ((item.openingFee ?? 0) > cabalCredits);
                    return (
                      <HapticPressable
                        key={`${item.resourceId}-${action}`}
                        disabled={disabled}
                        onPress={() => onDecisionChange(item.resourceId, action)}
                        style={({ pressed }) => [
                          styles.actionChip,
                          {
                            borderColor: selected ? TERMINAL_GREEN : borderColor,
                            backgroundColor: pressed ? '#0d1a12' : selected ? '#102016' : 'transparent',
                            opacity: disabled ? 0.45 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.actionChipText, { color: selected ? TERMINAL_GREEN : mutedColor }]}>
                          {actionChipLabel(action, item, routedQuantity).toUpperCase()}
                        </Text>
                      </HapticPressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  intro: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.body,
    lineHeight: RUN_FIELD.type.body * 1.4,
  },
  autoStashBox: {
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  previewBox: {
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  autoStashText: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.secondary,
    lineHeight: RUN_FIELD.type.secondary * 1.35,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.eyebrow,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  itemCard: {
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  offerBox: {
    borderWidth: 1,
    padding: 10,
    gap: 6,
    marginTop: 4,
  },
  itemTitle: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.section,
    fontWeight: '700',
    lineHeight: RUN_FIELD.type.section * 1.3,
  },
  itemMeta: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.secondary,
    lineHeight: RUN_FIELD.type.secondary * 1.35,
  },
  flag: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.eyebrow,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  warning: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.secondary,
    lineHeight: RUN_FIELD.type.secondary * 1.35,
  },
  recommended: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.secondary,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionChipText: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.eyebrow,
    letterSpacing: 0.5,
    lineHeight: RUN_FIELD.type.eyebrow * 1.35,
  },
  appraiseButton: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  quantityRow: {
    gap: 6,
    marginTop: 6,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityButton: {
    borderWidth: 1,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.section,
    fontWeight: '700',
  },
  quantityValue: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.secondary,
    minWidth: 56,
    textAlign: 'center',
  },
});
