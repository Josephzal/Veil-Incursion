import React from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import FieldPlate from '../runField/FieldPlate';
import HubPrimaryCta from '../hub/HubPrimaryCta';
import type { SettledCargoLine, SettledRunResult } from '../../types/settledRunResult';
import { RUN_FIELD } from '../../theme/runFieldTokens';

interface RunDebriefPopupProps {
  result: SettledRunResult;
  onReturnToVeilFront: () => void;
}

function CargoColumns({
  lines,
  overflowCount,
  danger,
}: {
  lines: SettledCargoLine[];
  overflowCount: number;
  danger?: boolean;
}): React.JSX.Element {
  const { width } = useWindowDimensions();
  const singleColumn = width < 720;

  return (
    <View style={[styles.cargoGrid, singleColumn ? styles.cargoGridSingle : null]}>
      {lines.map((line) => (
        <Text
          key={line.resourceId}
          style={[
            styles.cargoItem,
            danger ? styles.cargoItemDanger : null,
            line.supernatural && !danger ? styles.cargoItemOccult : null,
          ]}
          numberOfLines={1}
        >
          {`${line.name} ×${line.quantity}`}
        </Text>
      ))}
      {overflowCount > 0 ? (
        <Text style={[styles.cargoOverflow, singleColumn ? null : styles.cargoOverflowSpan]}>
          {`+${overflowCount} additional material types`}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Single-page extraction receipt — replaces the multi-step operation debrief.
 * One required action: RETURN TO VEIL FRONT (navigation only).
 */
export default function RunDebriefPopup({
  result,
  onReturnToVeilFront,
}: RunDebriefPopupProps): React.JSX.Element {
  const { width: viewportW, height: viewportH } = useWindowDimensions();
  const modalMaxWidth = Math.min(820, Math.max(280, viewportW - 48));
  const modalMaxHeight = Math.max(320, viewportH - 48);
  const narrow = viewportW < 720;

  const contractStatusLabel =
    result.contract?.status === 'COMPLETE'
      ? 'CONTRACT COMPLETE'
      : result.contract?.status === 'INCOMPLETE'
        ? 'CONTRACT INCOMPLETE'
        : result.contract
          ? 'CONTRACT FAILED'
          : null;

  return (
    <View
      style={styles.backdrop}
      {...({ [RUN_FIELD.scopeAttr]: RUN_FIELD.scopeValue } as object)}
    >
      <FieldPlate
        density="strong"
        tone={result.survived ? 'mint' : 'danger'}
        state="idle"
        brackets
        style={[
          styles.modal,
          {
            width: modalMaxWidth,
            maxHeight: modalMaxHeight,
          },
        ]}
        contentStyle={styles.modalContent}
      >
        <View style={styles.body}>
          <Text style={styles.eyebrow}>
            {`RUN DEBRIEF // ${result.sectorName.toUpperCase()}`}
          </Text>

          <Text
            style={[
              styles.outcome,
              result.survived ? styles.outcomeSuccess : styles.outcomeFailure,
            ]}
          >
            {result.outcomeTitle}
          </Text>

          {result.causeOfDeathLine ? (
            <Text style={styles.causeLine}>{result.causeOfDeathLine}</Text>
          ) : null}

          {result.contractTitle ? (
            <Text style={styles.contractContext} numberOfLines={2}>
              {result.contractTitle}
            </Text>
          ) : null}

          <View style={styles.divider} />

          <View style={[styles.metrics, narrow ? styles.metricsWrap : null]}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>DEEPEST REACH</Text>
              <Text style={styles.metricValue}>{result.deepestReachLabel}</Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>RUN TIME</Text>
              <Text style={styles.metricValue}>{result.runDurationLabel}</Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>CARGO RESULT</Text>
              <Text
                style={[
                  styles.metricValue,
                  !result.survived && result.cargoMode !== 'NONE'
                    ? styles.metricValueDanger
                    : null,
                ]}
              >
                {result.cargoResultLabel}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {result.cargoMode === 'NONE' ? (
            <Text style={styles.cargoEmpty}>NO CARGO RECOVERED</Text>
          ) : null}

          {result.cargoMode === 'RECOVERED' ? (
            <View style={styles.cargoSection}>
              <Text style={styles.sectionLabel}>RECOVERED CARGO</Text>
              <CargoColumns
                lines={result.recoveredCargo}
                overflowCount={result.cargoOverflowCount}
              />
              <Text style={styles.cargoSlots}>
                {`${result.cargoSlotsSecured} / ${result.cargoSlotsCapacity} SLOTS SECURED`}
              </Text>
            </View>
          ) : null}

          {result.cargoMode === 'SECURED_ONLY' || result.cargoMode === 'SECURED_AND_LOST' ? (
            <>
              {result.securedCargo.length > 0 ? (
                <View style={styles.cargoSection}>
                  <Text style={styles.sectionLabel}>CARGO SECURED</Text>
                  <CargoColumns
                    lines={result.securedCargo}
                    overflowCount={0}
                  />
                </View>
              ) : null}
              {result.lostCargo.length > 0 ? (
                <View style={styles.cargoSection}>
                  <Text style={[styles.sectionLabel, styles.sectionLabelDanger]}>
                    CARGO LOST
                  </Text>
                  <CargoColumns
                    lines={result.lostCargo}
                    overflowCount={
                      result.cargoMode === 'SECURED_AND_LOST'
                      && result.securedCargo.length === 0
                        ? result.cargoOverflowCount
                        : 0
                    }
                    danger
                  />
                </View>
              ) : null}
            </>
          ) : null}

          {result.contract && contractStatusLabel ? (
            <View style={styles.contractBlock}>
              <Text
                style={[
                  styles.sectionLabel,
                  result.contract.status === 'COMPLETE'
                    ? styles.sectionLabelMint
                    : styles.sectionLabelDanger,
                ]}
              >
                {contractStatusLabel}
              </Text>
              <Text style={styles.contractDetail} numberOfLines={2}>
                {result.contract.detail}
              </Text>
            </View>
          ) : null}

          {result.creditsEarned != null ? (
            <Text style={styles.credits}>
              {`+${result.creditsEarned} CREDITS`}
            </Text>
          ) : null}

          {result.extractionTypeLabel ? (
            <Text style={styles.extractionType}>{result.extractionTypeLabel}</Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerState}>RUN RESULTS RECORDED</Text>
          <HubPrimaryCta
            label="[ RETURN TO VEIL FRONT ]"
            onPress={onReturnToVeilFront}
            variant="classic"
            accessibilityLabel="Return to Veil Front"
            minHeight={46}
            style={styles.cta}
          />
        </View>
      </FieldPlate>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    width: '100%',
    backgroundColor: `rgba(5, 9, 10, ${RUN_FIELD.environmentScrim})`,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    alignSelf: 'center',
  },
  modalContent: {
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 18,
    minWidth: 0,
  },
  body: {
    gap: 10,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: RUN_FIELD.textSecondary,
  },
  outcome: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1.2,
    lineHeight: 36,
    marginTop: 4,
  },
  outcomeSuccess: {
    color: RUN_FIELD.mint,
  },
  outcomeFailure: {
    color: RUN_FIELD.danger,
  },
  causeLine: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 15,
    fontWeight: '600',
    color: RUN_FIELD.danger,
    letterSpacing: 0.2,
  },
  contractContext: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 15,
    fontWeight: '500',
    color: RUN_FIELD.textSecondary,
    letterSpacing: 0.2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: RUN_FIELD.line,
    width: '100%',
    marginVertical: 6,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 4,
  },
  metricsWrap: {
    flexWrap: 'wrap',
    rowGap: 14,
  },
  metricCell: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 120,
    gap: 6,
  },
  metricLabel: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: RUN_FIELD.textSecondary,
  },
  metricValue: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: RUN_FIELD.text,
  },
  metricValueDanger: {
    color: RUN_FIELD.danger,
  },
  cargoSection: {
    gap: 8,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: RUN_FIELD.textSecondary,
  },
  sectionLabelMint: {
    color: RUN_FIELD.mint,
  },
  sectionLabelDanger: {
    color: RUN_FIELD.danger,
  },
  cargoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 24,
    rowGap: 6,
  },
  cargoGridSingle: {
    flexDirection: 'column',
  },
  cargoItem: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 15,
    fontWeight: '600',
    color: RUN_FIELD.text,
    width: '46%',
    minWidth: 140,
    flexGrow: 1,
  },
  cargoItemDanger: {
    color: RUN_FIELD.danger,
  },
  cargoItemOccult: {
    color: RUN_FIELD.occult,
  },
  cargoOverflow: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 13,
    fontWeight: '500',
    color: RUN_FIELD.textDim,
    marginTop: 2,
  },
  cargoOverflowSpan: {
    width: '100%',
  },
  cargoSlots: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    color: RUN_FIELD.textSecondary,
    marginTop: 4,
  },
  cargoEmpty: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: RUN_FIELD.textSecondary,
    paddingVertical: 4,
  },
  contractBlock: {
    gap: 4,
    marginTop: 6,
  },
  contractDetail: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 14,
    fontWeight: '500',
    color: RUN_FIELD.text,
    letterSpacing: 0.2,
  },
  credits: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    color: RUN_FIELD.mint,
    marginTop: 8,
  },
  extractionType: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    color: RUN_FIELD.textSecondary,
  },
  footer: {
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RUN_FIELD.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  footerState: {
    fontFamily: RUN_FIELD.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: RUN_FIELD.textDim,
    flexShrink: 1,
  },
  cta: {
    minWidth: 220,
    flexGrow: 0,
  },
});
