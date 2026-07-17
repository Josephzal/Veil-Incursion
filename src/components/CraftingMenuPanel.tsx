import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import HapticPressable from './HapticPressable';
import TerminalText from './TerminalText';
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
import { useHubLayout } from '../context/HubLayoutContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { DOSSIER_ROW_BG, SELECT_ACCENT, DANGER_RED } from '../constants/dossierSurface';
import {
  MarketActionButton,
  MarketContentGrid,
  MarketPanel,
  MarketRow,
  MARKET_CONTENT_BOTTOM_PAD,
  MARKET_ROW_MIN_HEIGHT,
} from './hub/marketUi';
import { LOADOUT_SECTION_HEADER_COLOR, LOADOUT_SUBTITLE_COLOR } from './hub/loadoutTabUi';
import {
  HIDDEN_SCROLLBAR_VIEW_STYLE,
  HIDDEN_SCROLLVIEW_PROPS,
} from '../utils/hiddenScrollbarStyle';
import type { ResourceQuantity } from '../types/resourceItem';

const STARK_WHITE = '#F8FAFC';
const MUTED_SLATE = LOADOUT_SUBTITLE_COLOR;
const PHOSPHOR_GREEN = SELECT_ACCENT;
const RUST_RED = DANGER_RED;

interface CraftingMenuPanelProps {
  onClose?: () => void;
  embedded?: boolean;
}

interface ResourceLedgerProps {
  stash: ResourceQuantity;
  borderColor: string;
  textColor: string;
  mutedColor: string;
}

function ResourceLedger({
  stash,
  borderColor,
  textColor,
  mutedColor,
}: ResourceLedgerProps): React.JSX.Element {
  const ownedResources = useMemo(
    () => ALL_RESOURCE_ITEM_IDS.filter((resourceId) => getStashCount(stash, resourceId) > 0),
    [stash],
  );

  return (
    <ScrollView
      style={[
        styles.ledgerScroll,
        Platform.OS === 'web' && styles.ledgerScrollWeb,
        HIDDEN_SCROLLBAR_VIEW_STYLE,
      ]}
      contentContainerStyle={styles.listContent}
      {...HIDDEN_SCROLLVIEW_PROPS}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      {ownedResources.length === 0 ? (
        <TerminalText variant="caption" style={{ color: mutedColor, paddingVertical: 12, textAlign: 'center' }}>
          // NO RESOURCES IN STASH
        </TerminalText>
      ) : (
        ownedResources.map((resourceId) => {
          const def = RESOURCE_REGISTRY[resourceId];
          const quantity = getStashCount(stash, resourceId);
          const itemTypeLabel = def.itemType.replace(/_/g, ' ');
          return (
            <MarketRow
              key={resourceId}
              title={def.name.toUpperCase()}
              subtitle={`${quantity}× // ${itemTypeLabel}`}
              valueLine={`${quantity} IN STASH`}
              borderColor={borderColor}
              textColor={textColor}
              mutedColor={mutedColor}
              imageItemId={resourceId}
            />
          );
        })
      )}
    </ScrollView>
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
  footerMeta,
}: FabricationRowProps): React.JSX.Element {
  const affordable = canAffordRecipe(stash, recipe);
  const canFabricate = affordable && !alreadyOwned;
  const description = recipe.effectSummary ?? recipe.description ?? '';

  return (
    <View
      style={[
        styles.fabricationRow,
        {
          borderColor,
          backgroundColor: DOSSIER_ROW_BG,
        },
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
        <MarketActionButton
          label={alreadyOwned ? '[ FORGED ]' : '[ FABRICATE ]'}
          accentColor={accentColor}
          mutedColor={mutedColor}
          disabled={!canFabricate}
          variant={canFabricate ? 'primary' : 'disabled'}
          onPress={() => onFabricate(recipe.id)}
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
}: FabricationMatrixProps): React.JSX.Element {
  return (
    <View style={styles.fabricationSection}>
      {sectionLabel ? (
        <TerminalText
          variant="caption"
          letterSpacing={1}
          style={styles.subsectionLabel}
        >
          {sectionLabel.toUpperCase()}
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
              style={[styles.closeBtn, { borderColor: SELECT_ACCENT }]}
            >
              <Text style={[styles.closeBtnText, { color: SELECT_ACCENT, fontSize: 8 * fontScale }]}>
                [ CLOSE ]
              </Text>
            </HapticPressable>
          ) : null}
        </View>
      ) : null}

      <MarketContentGrid
        stacked={!isDesktop}
        left={(
          <MarketPanel label="Resource Ledger" padding={panelPadding}>
            <ResourceLedger
              stash={account.resourceStash}
              borderColor={theme.borderColor}
              textColor={theme.textColor}
              mutedColor={theme.mutedColor}
            />
          </MarketPanel>
        )}
        right={(
          <MarketPanel label="Fabrication Matrix" padding={panelPadding}>
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
              />

              {runItemRecipes.length > 0 ? (
                <View style={styles.runItemBlock}>
                  <View style={styles.filterRow}>
                    {(['ALL', 'COMBAT', 'FIELD'] as const).map((filter) => (
                      <HapticPressable
                        key={filter}
                        onPress={() => setRunItemFilter(filter)}
                        style={[
                          styles.filterChip,
                          {
                            borderColor: runItemFilter === filter ? SELECT_ACCENT : theme.borderColor,
                            backgroundColor: runItemFilter === filter
                              ? `${SELECT_ACCENT}18`
                              : 'transparent',
                          },
                        ]}
                      >
                        <TerminalText
                          variant="caption"
                          style={{
                            color: runItemFilter === filter ? SELECT_ACCENT : theme.mutedColor,
                            fontWeight: '700',
                          }}
                        >
                          {filter === 'ALL' ? 'ALL RUN ITEMS' : filter}
                        </TerminalText>
                      </HapticPressable>
                    ))}
                  </View>
                  <View style={styles.schematicDivider} />
                  <View style={styles.fabricationSection}>
                    <TerminalText variant="caption" letterSpacing={1} style={styles.subsectionLabel}>
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
                          footerMeta={`MARKET ${def.marketPrice} CR // ${staged} STAGED AT HUB`}
                        />
                      );
                    })}
                  </View>
                </View>
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
                />
              ) : null}
            </ScrollView>
          </MarketPanel>
        )}
      />
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
    backgroundColor: 'transparent',
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
  ledgerScroll: {
    flex: 1,
    minHeight: 0,
  },
  ledgerScrollWeb: Platform.select({
    web: { height: 0 },
    default: {},
  }),
  listContent: {
    gap: 8,
    paddingBottom: MARKET_CONTENT_BOTTOM_PAD,
  },
  matrixScroll: {
    flex: 1,
    minHeight: 0,
  },
  fabricationList: {
    gap: 18,
    paddingBottom: MARKET_CONTENT_BOTTOM_PAD,
  },
  fabricationSection: {
    gap: 8,
  },
  runItemBlock: {
    gap: 10,
  },
  schematicDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.28)',
  },
  subsectionLabel: {
    color: LOADOUT_SECTION_HEADER_COLOR,
    fontWeight: '700',
    marginBottom: 2,
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
    minHeight: MARKET_ROW_MIN_HEIGHT + 8,
  },
  fabricationInfo: {
    flex: 1,
    gap: 5,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
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
