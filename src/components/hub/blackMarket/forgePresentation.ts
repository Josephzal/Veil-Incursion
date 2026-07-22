import type { PlayerAccount } from '../../../types/game';
import type { ProgressionProfile } from '../../../types/progression';
import type { ResourceQuantity } from '../../../types/resourceItem';
import {
  buildRecipeVisibilityStatus,
  type RecipeVisibility,
  type RecipeVisibilityMeta,
  type RecipeVisibilityStatus,
} from '../../../data/recipeVisibilityEngine';
import { canAffordRecipe, getStashCount } from '../../../data/resourceStashEngine';
import { isRecipeOutputOwned, type CraftingRecipe } from '../../../data/craftingRegistry';
import { buildResourceDiscoveryCard } from '../../../data/resourceDiscoveryEngine';
import type { ResourceDiscoveryState } from '../../../types/resourceDiscovery';

export type ForgeRowStatus = 'fabricable' | 'missing' | 'owned' | 'rumored' | 'sealed';

export interface ForgeRequirementRow {
  resourceId: string;
  displayName: string;
  held: number;
  required: number;
  ready: boolean;
  concealed: boolean;
}

export interface ForgeSchematicPresentation {
  recipe: CraftingRecipe;
  visibility: RecipeVisibility;
  meta: RecipeVisibilityMeta;
  status: ForgeRowStatus;
  stateLabel: string;
  effectLine: string;
  requirementsLine: string;
  canFabricate: boolean;
  alreadyOwned: boolean;
  missingCount: number;
  requirements: ForgeRequirementRow[];
}

function buildRequirementRows(
  recipe: CraftingRecipe,
  stash: ResourceQuantity,
  discovery: ResourceDiscoveryState,
  rumored: boolean,
): ForgeRequirementRow[] {
  if (rumored) {
    // Do not leak material count or identities while costs are sealed.
    return [];
  }

  return recipe.requirements.map((req) => {
    const held = getStashCount(stash, req.resourceId);
    const card = buildResourceDiscoveryCard(req.resourceId, discovery);
    const discovered = card.discovered;
    return {
      resourceId: req.resourceId,
      displayName: discovered ? card.title.toUpperCase() : 'UNKNOWN MATERIAL',
      held: discovered ? held : 0,
      required: req.quantity,
      ready: discovered && held >= req.quantity,
      concealed: !discovered,
    };
  });
}

/** Shared forge eligibility for feed rows, dossier, and fabricate CTA. */
export function buildForgeSchematicPresentation(
  profile: ProgressionProfile,
  account: PlayerAccount,
  recipe: CraftingRecipe,
): ForgeSchematicPresentation {
  const status: RecipeVisibilityStatus = buildRecipeVisibilityStatus(profile, account, recipe);
  const alreadyOwned = isRecipeOutputOwned(recipe.outputId, [], account.craftedAugments);
  const rumored = status.visibility === 'RUMORED';
  const affordable = !rumored && canAffordRecipe(account.resourceStash, recipe);
  const requirements = buildRequirementRows(
    recipe,
    account.resourceStash,
    account.resourceDiscovery,
    rumored,
  );
  const missingCount = requirements.filter((row) => !row.ready && !row.concealed).length
    + requirements.filter((row) => row.concealed).length;
  const canFabricate = !rumored && affordable && !alreadyOwned;

  let rowStatus: ForgeRowStatus;
  let stateLabel: string;

  if (alreadyOwned) {
    rowStatus = 'owned';
    stateLabel = 'OWNED';
  } else if (rumored) {
    if (status.meta.rumoredMinClearance != null && status.meta.rumoredMinClearance > 0) {
      rowStatus = 'sealed';
      stateLabel = `CLEARANCE ${status.meta.rumoredMinClearance}`;
    } else {
      rowStatus = 'rumored';
      stateLabel = 'RUMORED';
    }
  } else if (canFabricate) {
    rowStatus = 'fabricable';
    stateLabel = 'FABRICABLE';
  } else {
    rowStatus = 'missing';
    stateLabel = 'MATERIALS INCOMPLETE';
  }

  const effectLine = rumored
    ? (status.meta.rumoredPurpose || 'Rumored schematic — costs sealed.')
    : (recipe.effectSummary ?? recipe.description ?? '');

  const requirementsLine = rumored
    ? (status.meta.sourceHint ? `SOURCE · ${status.meta.sourceHint}` : 'SOURCE · ???')
    : requirements
      .slice(0, 3)
      .map((row) => (
        row.concealed
          ? '???'
          : `${row.displayName} ${row.held}/${row.required}`
      ))
      .join(' · ');

  return {
    recipe,
    visibility: status.visibility,
    meta: status.meta,
    status: rowStatus,
    stateLabel,
    effectLine,
    requirementsLine,
    canFabricate,
    alreadyOwned,
    missingCount,
    requirements,
  };
}

export function listVisibleForgePresentations(
  profile: ProgressionProfile,
  account: PlayerAccount,
  recipes: readonly CraftingRecipe[],
): ForgeSchematicPresentation[] {
  return recipes
    .map((recipe) => buildForgeSchematicPresentation(profile, account, recipe))
    .filter((entry) => entry.visibility === 'KNOWN' || entry.visibility === 'RUMORED');
}
