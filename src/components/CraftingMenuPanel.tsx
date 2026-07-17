import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import HapticPressable from './HapticPressable';
import HubCargoIconBox from './safehouse/HubCargoIconBox';
import TerminalText from './TerminalText';
import TacticalButton from './TacticalButton';
import {
  getRecipesByKind,
  isRecipeOutputOwned,
  PERMANENT_AUGMENTS,
  type CraftingRecipe,
} from '../data/craftingRegistry';
import {
  buildRunItemCraftingRecipes,
  filterRunItemCraftingRecipes,
  isRunItemCraftOutput,
  type RunItemCraftFilter,
} from '../data/runItemCraftingBridge';
import { getRunItemDefinition } from '../data/runItemRegistry';
import type { RunItemId } from '../types/runItem';
import { canAffordRecipe, getStashCount } from '../data/resourceStashEngine';
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY } from '../data/resourceRegistry';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useHubTypography } from '../hooks/useHubTypography';
import { useHubLayout } from '../context/HubLayoutContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { DOSSIER_ROW_BG, dossierOpaqueCtaStyle, SELECT_ACCENT, DANGER_RED } from '../constants/dossierSurface';
import DossierCardShell from './hub/DossierCardShell';
import { LoadoutSectionHeader } from './hub/loadoutTabUi';
import {
  HIDDEN_SCROLLBAR_VIEW_STYLE,
  HIDDEN_SCROLLVIEW_PROPS,
} from '../utils/hiddenScrollbarStyle';
import type { ResourceItemId } from '../types/resourceItem';
import type { ResourceQuantity } from '../types/resourceItem';

const STARK_WHITE = '#F8FAFC';
const MUTED_SLATE = '#94A3B8';
const ACCENT_CYAN = '#06B6D4';
const PHOSPHOR_GREEN = SELECT_ACCENT;
const RUST_RED = DANGER_RED;

interface CraftingMenuPanelProps {
  onClose?: () => void;
  embedded?: boolean;
}

interface ResourceLedgerRowProps {
  resourceId: ResourceItemId;
  quantity: number;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  iconSize: number;
  isDesktop: boolean;
}

function ResourceLedgerRow({
  resourceId,
  quantity,
  borderColor,
  textColor,
  mutedColor,
  iconSize,
  isDesktop,
}: ResourceLedgerRowProps): React.JSX.Element {
  const def = RESOURCE_REGISTRY[resourceId];
  const itemTypeLabel = def.itemType.replace(/_/g, ' ');

  return (
    <View
      style={[
        styles.fabricationRow,
        isDesktop && styles.fabricationRowDesktop,
        { borderColor, backgroundColor: DOSSIER_ROW_BG },
      ]}
    >
      <View style={styles.fabricationInfo}>
        <TerminalText variant="body" style={{ color: textColor, fontWeight: '700' }} numberOfLines={1}>
          {def.name.toUpperCase()}
        </TerminalText>
        <TerminalText variant="caption" style={{ color: mutedColor }} numberOfLines={1}>
          {`${quantity}× // ${itemTypeLabel}`}
        </TerminalText>
        <View style={styles.requirementLine}>
          <Text style={[styles.requirementText, { color: PHOSPHOR_GREEN }]}>
            {`${quantity} IN STASH`}
          </Text>
        </View>
      </View>
      <View style={styles.fabricationActions}>
        <HubCargoIconBox
          itemId={resourceId}
          borderColor={mutedColor}
          iconSize={iconSize}
        />
      </View>
    </View>
  );
}

interface ResourceLedgerProps {
  stash: ResourceQuantity;
  borderColor: string;
  iconSize: number;
  titleColor: string;
  textColor: string;
  mutedColor: string;
  isDesktop: boolean;
}

function ResourceLedger({
  stash,
  borderColor,
  iconSize,
  textColor,
  mutedColor,
  isDesktop,
}: ResourceLedgerProps): React.JSX.Element {
  const ownedResources = useMemo(
    () => ALL_RESOURCE_ITEM_IDS.filter((resourceId) => getStashCount(stash, resourceId) > 0),
    [stash],
  );

  return (
    <>
      <ScrollView
        style={[
          styles.ledgerScroll,
          Platform.OS === 'web' && styles.ledgerScrollWeb,
          HIDDEN_SCROLLBAR_VIEW_STYLE,
        ]}
        contentContainerStyle={styles.fabricationSection}
        {...HIDDEN_SCROLLVIEW_PROPS}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {ownedResources.length === 0 ? (
          <TerminalText variant="caption" style={{ color: mutedColor, paddingVertical: 12, textAlign: 'center' }}>
            // NO RESOURCES IN STASH
          </TerminalText>
        ) : (
          ownedResources.map((resourceId) => (
            <ResourceLedgerRow
              key={resourceId}
              resourceId={resourceId}
              quantity={getStashCount(stash, resourceId)}
              borderColor={borderColor}
              textColor={textColor}
              mutedColor={mutedColor}
              iconSize={iconSize}
              isDesktop={isDesktop}
            />
          ))
        )}
      </ScrollView>
    </>
  );
}

interface FabricationRowProps {
  recipe: CraftingRecipe;
  stash: ResourceQuantity;
  alreadyOwned: boolean;
  onFabricate: (recipeId: string) => void;
  accentColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  isDesktop: boolean;
  footerMeta?: string;
}

function FabricationRow({
  recipe,
  stash,
  alreadyOwned,
  onFabricate,
  accentColor,
  borderColor,
  textColor,
  mutedColor,
  isDesktop,
  footerMeta,
}: FabricationRowProps): React.JSX.Element {
  const affordable = canAffordRecipe(stash, recipe);
  const canFabricate = affordable && !alreadyOwned;
  const description = recipe.effectSummary ?? recipe.description ?? '';

  return (
    <View
      style={[
        styles.fabricationRow,
        isDesktop && styles.fabricationRowDesktop,
        { borderColor, backgroundColor: DOSSIER_ROW_BG },
      ]}
    >
      <View style={styles.fabricationInfo}>
        <TerminalText variant="body" style={{ color: textColor, fontWeight: '700' }} numberOfLines={1}>
          {recipe.label.toUpperCase()}
        </TerminalText>
        {description ? (
          <TerminalText variant="caption" style={{ color: mutedColor }} numberOfLines={2}>
            {description}
          </TerminalText>
        ) : null}
        <View style={styles.requirementLine}>
          {recipe.requirements.map((req, index) => {
            const ownedCount = getStashCount(stash, req.resourceId);
            const satisfied = ownedCount >= req.quantity;
            const name = RESOURCE_REGISTRY[req.resourceId].name.toUpperCase();
            return (
              <Text
                key={`${recipe.id}-${req.resourceId}`}
                style={[
                  styles.requirementText,
                  { color: satisfied ? PHOSPHOR_GREEN : RUST_RED },
                ]}
              >
                {`${index > 0 ? ' • ' : ''}${name} ${ownedCount}/${req.quantity}`}
              </Text>
            );
          })}
        </View>
        {footerMeta ? (
          <Text style={[styles.requirementText, { color: MUTED_SLATE }]}>
            {footerMeta}
          </Text>
        ) : null}
      </View>
      <View style={styles.fabricationActions}>
        <TacticalButton
          label={alreadyOwned ? '[ FORGED ]' : '[ FABRICATE ]'}
          active={canFabricate}
          onPress={() => onFabricate(recipe.id)}
          accentColor={accentColor}
          mutedColor={mutedColor}
          variant="inline"
          disabled={!canFabricate}
          style={[
            dossierOpaqueCtaStyle(accentColor),
            !canFabricate ? { opacity: alreadyOwned ? 0.45 : 0.25 } : null,
          ]}
        />
      </View>
    </View>
  );
}

interface FabricationMatrixProps {
  recipes: readonly CraftingRecipe[];
  stash: ResourceQuantity;
  onFabricate: (recipeId: string) => void;
  sectionLabel?: string;
  isOwned: (recipe: CraftingRecipe) => boolean;
  accentColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  isDesktop: boolean;
}

function FabricationMatrix({
  recipes,
  stash,
  onFabricate,
  sectionLabel,
  isOwned,
  accentColor,
  borderColor,
  textColor,
  mutedColor,
  isDesktop,
}: FabricationMatrixProps): React.JSX.Element {
  return (
    <View style={styles.fabricationSection}>
      {sectionLabel ? (
        <TerminalText variant="caption" letterSpacing={0.8} style={{ color: mutedColor, fontWeight: '700' }}>
          {sectionLabel}
        </TerminalText>
      ) : null}
      {recipes.map((recipe) => (
        <FabricationRow
          key={recipe.id}
          recipe={recipe}
          stash={stash}
          alreadyOwned={isOwned(recipe)}
          onFabricate={onFabricate}
          accentColor={accentColor}
          borderColor={borderColor}
          textColor={textColor}
          mutedColor={mutedColor}
          isDesktop={isDesktop}
        />
      ))}
    </View>
  );
}

export default function CraftingMenuPanel({
  onClose,
  embedded = false,
}: CraftingMenuPanelProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { account, craftRecipe, appendHubLog } = usePlayerAccount();
  const { isDesktop, fontScale } = useResponsiveLayout();
  const { scaleSpacing } = useHubLayout();
  const { iconSize } = useHubTypography();
  const panelPadding = scaleSpacing(10);
  const [runItemFilter, setRunItemFilter] = useState<RunItemCraftFilter>('ALL');

  const runItemRecipes = useMemo(
    () => filterRunItemCraftingRecipes(buildRunItemCraftingRecipes(), runItemFilter),
    [runItemFilter],
  );

  const secondaryRecipes = useMemo(
    () => ({
      CONSUMABLE: getRecipesByKind('CONSUMABLE').filter(
        (recipe) => !isRunItemCraftOutput(recipe.outputId),
      ),
    }),
    [],
  );

  const handleFabricate = (recipeId: string) => {
    const result = craftRecipe(recipeId);
    appendHubLog(result.logLine);
  };

  const isOutputOwned = (recipe: CraftingRecipe) => isRecipeOutputOwned(
    recipe.outputId,
    [],
    account.craftedAugments,
  );

  const matrixContent = (
    <DossierCardShell
      fillHeight
      padding={panelPadding}
      contentStyle={styles.matrixPanel}
    >
      <ScrollView
        style={[styles.matrixScroll, HIDDEN_SCROLLBAR_VIEW_STYLE]}
        contentContainerStyle={styles.fabricationList}
        {...HIDDEN_SCROLLVIEW_PROPS}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <FabricationMatrix
          recipes={PERMANENT_AUGMENTS}
          stash={account.resourceStash}
          onFabricate={handleFabricate}
          isOwned={isOutputOwned}
          accentColor={SELECT_ACCENT}
          borderColor={theme.borderColor}
          textColor={theme.textColor}
          mutedColor={theme.mutedColor}
          isDesktop={isDesktop}
        />

        {runItemRecipes.length > 0 ? (
          <>
            <View style={styles.filterRow}>
              {(['ALL', 'COMBAT', 'FIELD'] as const).map((filter) => (
                <HapticPressable
                  key={filter}
                  onPress={() => setRunItemFilter(filter)}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: theme.borderColor,
                      backgroundColor: runItemFilter === filter ? DOSSIER_ROW_BG : 'transparent',
                    },
                  ]}
                >
                  <TerminalText
                    variant="caption"
                    style={{
                      color: runItemFilter === filter ? theme.statusColor : theme.mutedColor,
                      fontWeight: '700',
                    }}
                  >
                    {filter === 'ALL' ? 'ALL RUN ITEMS' : filter}
                  </TerminalText>
                </HapticPressable>
              ))}
            </View>
            <View style={styles.fabricationSection}>
              <TerminalText variant="caption" letterSpacing={0.8} style={{ color: theme.mutedColor, fontWeight: '700' }}>
                RUN ITEM SCHEMATICS
              </TerminalText>
              {runItemRecipes.map((recipe) => {
                const itemId = recipe.outputId as RunItemId;
                const def = getRunItemDefinition(itemId);
                const staged = account.hubCraftedConsumables[itemId] ?? 0;
                return (
                  <FabricationRow
                    key={recipe.id}
                    recipe={recipe}
                    stash={account.resourceStash}
                    alreadyOwned={false}
                    onFabricate={handleFabricate}
                    accentColor={SELECT_ACCENT}
                    borderColor={theme.borderColor}
                    textColor={theme.textColor}
                    mutedColor={theme.mutedColor}
                    isDesktop={isDesktop}
                    footerMeta={`MARKET ${def.marketPrice} CR // ${staged} STAGED AT HUB`}
                  />
                );
              })}
            </View>
          </>
        ) : null}

        {secondaryRecipes.CONSUMABLE.length > 0 ? (
          <FabricationMatrix
            recipes={secondaryRecipes.CONSUMABLE}
            stash={account.resourceStash}
            onFabricate={handleFabricate}
            sectionLabel="TACTICAL CONSUMABLES"
            isOwned={() => false}
            accentColor={SELECT_ACCENT}
            borderColor={theme.borderColor}
            textColor={theme.textColor}
            mutedColor={theme.mutedColor}
            isDesktop={isDesktop}
          />
        ) : null}
      </ScrollView>
    </DossierCardShell>
  );

  return (
    <View style={[styles.root, embedded ? styles.rootEmbedded : null]}>
      {!embedded ? (
        <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
          <Text style={[styles.headerTitle, { color: STARK_WHITE, fontSize: 10 * fontScale }]}>
            FABRICATION MATRIX // METRO HUB
          </Text>
          {onClose ? (
            <HapticPressable
              onPress={onClose}
              style={[styles.closeBtn, { borderColor: ACCENT_CYAN }]}
            >
              <Text style={[styles.closeBtnText, { color: ACCENT_CYAN, fontSize: 8 * fontScale }]}>
                [ CLOSE ]
              </Text>
            </HapticPressable>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.dashboard,
          { flexDirection: isDesktop ? 'row' : 'column', gap: scaleSpacing(10) },
        ]}
      >
        <View
          style={[
            styles.ledgerColumn,
            isDesktop ? styles.ledgerColumnDesktop : styles.ledgerColumnMobile,
            { gap: scaleSpacing(6) },
          ]}
        >
          <LoadoutSectionHeader label="Resource Ledger" />
          <DossierCardShell fillHeight padding={panelPadding} contentStyle={styles.ledgerContent}>
            <ResourceLedger
              stash={account.resourceStash}
              borderColor={theme.borderColor}
              iconSize={iconSize}
              titleColor={theme.statusColor}
              textColor={theme.textColor}
              mutedColor={theme.mutedColor}
              isDesktop={isDesktop}
            />
          </DossierCardShell>
        </View>

        <View style={[styles.matrixColumn, isDesktop ? styles.matrixColumnDesktop : null, { gap: scaleSpacing(6) }]}>
          <LoadoutSectionHeader label="Fabrication Matrix" />
          {matrixContent}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#050608',
  },
  rootEmbedded: {
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.8,
    flex: 1,
  },
  closeBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeBtnText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  dashboard: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  ledgerColumn: {
    minHeight: 0,
    minWidth: 0,
  },
  ledgerColumnMobile: {
    maxHeight: 300,
    flexShrink: 0,
  },
  ledgerColumnDesktop: {
    flex: 0.35,
  },
  ledgerContent: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  panelTitle: {
    fontWeight: '700',
    flexShrink: 0,
  },
  matrixColumn: {
    flex: 1,
    minHeight: 0,
  },
  matrixColumnDesktop: {
    flex: 0.65,
  },
  ledgerScroll: {
    flex: 1,
    minHeight: 0,
  },
  ledgerScrollWeb: Platform.select({
    web: { height: 0, overflow: 'auto' as const },
    default: {},
  }),
  matrixPanel: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  matrixScroll: {
    flex: 1,
    minHeight: 0,
  },
  fabricationList: {
    gap: 16,
    paddingBottom: 8,
  },
  fabricationSection: {
    gap: 6,
    paddingBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fabricationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    width: '100%',
    overflow: 'hidden',
  },
  fabricationRowDesktop: {
    minHeight: 56,
  },
  fabricationInfo: {
    flex: 1,
    gap: 4,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  requirementLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  requirementText: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.35,
    fontWeight: '700',
  },
  fabricationActions: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
