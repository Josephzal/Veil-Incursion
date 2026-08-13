/**
 * Progression Spine Phase 1G — Recipe visibility (Known / Rumored / Unknown).
 * Staged forge schematics: goals without dumping every cost on day one.
 */
import type { PlayerAccount } from '../types/game';
import type { ProgressionProfile } from '../types/progression';
import type { CraftingRecipe } from './craftingRegistry';
import {
  CRAFTING_REGISTRY,
  getCraftingRecipe,
} from './craftingRegistry';
import { buildRunItemCraftingRecipes } from './runItemCraftingBridge';
import {
  hasProgressionFlag,
  hasProgressionUnlock,
} from './progressionProfileEngine';
import { appendProgressionEvent } from './progressionEventLog';
import { getStashCount } from './resourceStashEngine';
import { getResourceDisplayName } from './resourceRegistry';
import { veilBiomeDisplayName, sectorIdToVeilBiome } from './sectorBiomeBridge';
import type { SectorId } from '../types/worldState';
import type { ResourceItemId } from '../types/resourceItem';

export type RecipeVisibility = 'KNOWN' | 'RUMORED' | 'UNKNOWN';

export type RecipeVisibilityBand = 'STARTER' | 'STANDARD' | 'ADVANCED';

export interface RecipeVisibilityMeta {
  recipeId: string;
  /** Stable key used for unlock flags (`recipe.<key>`). */
  unlockKey: string;
  band: RecipeVisibilityBand;
  /** Vague purpose shown while Rumored. */
  rumoredPurpose: string;
  /** Where / how the player might learn it. */
  sourceHint: string;
  /** Optional sector that helps rumored/known reveal. */
  relatedSectorId?: SectorId;
  /** Optional clearance gate for rumored reveal (STANDARD/ADVANCED). */
  rumoredMinClearance?: number;
}

export interface RecipeVisibilityStatus {
  recipe: CraftingRecipe;
  meta: RecipeVisibilityMeta;
  visibility: RecipeVisibility;
  /** Player-facing lines for forge / debrief. */
  lines: string[];
  canFabricate: boolean;
}

function listAllRecipes(): CraftingRecipe[] {
  const runItems = buildRunItemCraftingRecipes();
  const runOutputs = new Set(runItems.map((r) => r.outputId));
  const forge = CRAFTING_REGISTRY.filter(
    (r) => r.kind === 'AUGMENT' || !runOutputs.has(r.outputId),
  );
  return [...forge, ...runItems];
}

function unlockKeyForRecipe(recipe: CraftingRecipe): string {
  return recipe.outputId;
}

function recipeUnlockId(unlockKey: string): string {
  return `recipe.${unlockKey}`;
}

/** Authoring overrides — everything else gets sensible defaults from band heuristics. */
const RECIPE_VISIBILITY_OVERRIDES: Partial<Record<string, Partial<RecipeVisibilityMeta>>> = {
  craft_standard_coagulant: {
    band: 'STARTER',
    rumoredPurpose: 'Field clotting agent.',
    sourceHint: 'Starter schematic',
  },
  craft_adrenaline_primer: {
    band: 'STARTER',
    rumoredPurpose: 'Opening combat surge.',
    sourceHint: 'Legion field primer',
  },
  craft_chalk_line_ward: {
    band: 'STARTER',
    rumoredPurpose: 'Occult scan suppressor.',
    sourceHint: 'Solaris ward craft',
  },
  craft_trauma_patch: {
    band: 'STANDARD',
    rumoredPurpose: 'Field medicine // clears blight.',
    sourceHint: 'Abyssal Sink organics // Mycelial branch',
    relatedSectorId: 'THE_ABYSSAL_SINK',
    rumoredMinClearance: 1,
  },
  craft_kinetic_hollow_points: {
    band: 'STANDARD',
    rumoredPurpose: 'Kinetic tip amp.',
    sourceHint: 'Null Zone slag milling',
    relatedSectorId: 'THE_NULL_ZONE',
  },
  craft_veil_ash_grenade: {
    band: 'ADVANCED',
    rumoredPurpose: 'Frontline blind charge.',
    sourceHint: 'Ashen Wastes // Clearance 4 forge',
    relatedSectorId: 'THE_ASHEN_WASTES',
    rumoredMinClearance: 4,
  },
  craft_sonar_ping: {
    band: 'ADVANCED',
    rumoredPurpose: 'Node-type reveal pulse.',
    sourceHint: 'Echo salvage // Clearance 4 forge',
    relatedSectorId: 'THE_NULL_ZONE',
    rumoredMinClearance: 4,
  },
  craft_blood_price: {
    band: 'ADVANCED',
    rumoredPurpose: 'Ley-Scar bargain — power at a cost.',
    sourceHint: 'Occult forge // Clearance 4',
    rumoredMinClearance: 4,
  },
  craft_smugglers_pockets: {
    band: 'ADVANCED',
    rumoredPurpose: 'Permanent cargo expansion.',
    sourceHint: 'Black market forge // Clearance 4',
    rumoredMinClearance: 4,
  },
  craft_kinetic_battery: {
    band: 'ADVANCED',
    rumoredPurpose: 'Defend-to-strike capacitor.',
    sourceHint: 'Slag Works grid craft // Clearance 4',
    relatedSectorId: 'THE_SLAG_WORKS',
    rumoredMinClearance: 4,
  },
  craft_dead_drop_tracker: {
    band: 'ADVANCED',
    rumoredPurpose: 'Forces an early high-tier cache.',
    sourceHint: 'Echo / Grid forge // Clearance 4',
    rumoredMinClearance: 4,
  },
};

function inferBand(recipe: CraftingRecipe): RecipeVisibilityBand {
  if (recipe.id.includes('standard_coagulant') || recipe.outputId === 'standard-coagulant') {
    return 'STARTER';
  }
  if (recipe.kind === 'AUGMENT') {
    if (recipe.id.includes('adrenaline') || recipe.id.includes('chalk')) return 'STARTER';
    return 'ADVANCED';
  }
  // Run items / consumables: early field tools standard; exotic advanced.
  const advancedOutputs = new Set([
    'veil-ash-grenade',
    'sonar-ping',
    'null-space-injector',
    'anchor-needle',
    'echo-tuning-fork',
    'ash-seal-canister',
    'dead-drop-token',
    'black-iron-wedge',
  ]);
  if (advancedOutputs.has(recipe.outputId)) return 'ADVANCED';
  return 'STANDARD';
}

function defaultSourceHint(recipe: CraftingRecipe, band: RecipeVisibilityBand): string {
  if (band === 'STARTER') return 'Starter schematic';
  if (band === 'ADVANCED') return 'Advanced forge // Clearance 4';
  return 'Field schematic // extract matching materials';
}

function defaultRumoredPurpose(recipe: CraftingRecipe): string {
  if (recipe.effectSummary) {
    // Truncate to a vague teaser — first clause only.
    const first = recipe.effectSummary.split(/[.;]/)[0]?.trim();
    if (first && first.length <= 64) return first;
    return `${first?.slice(0, 56) ?? 'Specialized craft'}…`;
  }
  return recipe.kind === 'AUGMENT' ? 'Permanent hub augment.' : 'Tactical run craft.';
}

export function getRecipeVisibilityMeta(recipe: CraftingRecipe): RecipeVisibilityMeta {
  const unlockKey = unlockKeyForRecipe(recipe);
  const override = RECIPE_VISIBILITY_OVERRIDES[recipe.id]
    ?? RECIPE_VISIBILITY_OVERRIDES[recipe.outputId]
    ?? {};
  const band = override.band ?? inferBand(recipe);
  return {
    recipeId: recipe.id,
    unlockKey,
    band,
    rumoredPurpose: override.rumoredPurpose ?? defaultRumoredPurpose(recipe),
    sourceHint: override.sourceHint ?? defaultSourceHint(recipe, band),
    relatedSectorId: override.relatedSectorId,
    rumoredMinClearance: override.rumoredMinClearance
      ?? (band === 'ADVANCED' ? 4 : band === 'STANDARD' ? 1 : 1),
  };
}

function hasRecipeKnownUnlock(
  profile: ProgressionProfile,
  unlockKey: string,
): boolean {
  const id = recipeUnlockId(unlockKey);
  return hasProgressionUnlock(profile, id) || hasProgressionFlag(profile, id);
}

function hasAnyRequiredIngredient(
  account: PlayerAccount,
  recipe: CraftingRecipe,
): boolean {
  return recipe.requirements.some(
    (req) => getStashCount(account.resourceStash, req.resourceId) > 0,
  );
}

function hasAllIngredientTypes(
  account: PlayerAccount,
  recipe: CraftingRecipe,
): boolean {
  return recipe.requirements.every(
    (req) => getStashCount(account.resourceStash, req.resourceId) > 0,
  );
}

function relatedSectorUnlocked(
  profile: ProgressionProfile,
  sectorId: SectorId | undefined,
): boolean {
  if (!sectorId) return true;
  return profile.sectors[sectorId]?.unlocked === true;
}

function hasAdvancedForge(profile: ProgressionProfile): boolean {
  return hasProgressionFlag(profile, 'flag.advanced_forge_visible')
    || hasProgressionUnlock(profile, 'flag.advanced_forge_visible');
}

/** Pure visibility resolution for one recipe. */
export function resolveRecipeVisibility(
  profile: ProgressionProfile,
  account: PlayerAccount,
  recipe: CraftingRecipe,
): RecipeVisibility {
  const meta = getRecipeVisibilityMeta(recipe);

  if (meta.band === 'STARTER') return 'KNOWN';
  if (hasRecipeKnownUnlock(profile, meta.unlockKey)) return 'KNOWN';

  // Staged Supply outputs imply a known schematic.
  if (
    recipe.kind === 'CONSUMABLE' &&
    (account.hubCraftedConsumables[
      recipe.outputId as import('../types/cargoGrid').CargoItemId
    ] ?? 0) > 0
  ) {
    return 'KNOWN';
  }

  // Holding every ingredient type reveals the full schematic.
  if (hasAllIngredientTypes(account, recipe)) return 'KNOWN';

  const clearance = profile.runner.clearanceRank;
  const advancedOk = hasAdvancedForge(profile);
  const sectorOk = relatedSectorUnlocked(profile, meta.relatedSectorId);
  const clearanceOk = clearance >= (meta.rumoredMinClearance ?? 1);
  const touched = hasAnyRequiredIngredient(account, recipe);

  if (meta.band === 'ADVANCED') {
    if (!advancedOk && !touched) return 'UNKNOWN';
    if (advancedOk || (touched && sectorOk)) return 'RUMORED';
    return 'UNKNOWN';
  }

  // STANDARD
  if (clearanceOk || touched || sectorOk) return 'RUMORED';
  return 'UNKNOWN';
}

export function buildRecipeVisibilityStatus(
  profile: ProgressionProfile,
  account: PlayerAccount,
  recipe: CraftingRecipe,
): RecipeVisibilityStatus {
  const meta = getRecipeVisibilityMeta(recipe);
  const visibility = resolveRecipeVisibility(profile, account, recipe);
  const lines: string[] = [];

  if (visibility === 'KNOWN') {
    lines.push(recipe.label);
    lines.push(recipe.effectSummary ?? recipe.description ?? meta.rumoredPurpose);
    recipe.requirements.forEach((req) => {
      const owned = getStashCount(account.resourceStash, req.resourceId);
      lines.push(
        `${getResourceDisplayName(req.resourceId)} ${owned}/${req.quantity}`,
      );
    });
  } else if (visibility === 'RUMORED') {
    lines.push(recipe.label);
    lines.push(`Rumored — ${meta.rumoredPurpose}`);
    lines.push(`Source: ${meta.sourceHint}`);
    if (meta.relatedSectorId) {
      lines.push(
        `Branch: ${veilBiomeDisplayName(sectorIdToVeilBiome(meta.relatedSectorId))}`,
      );
    }
    lines.push('Costs: ???');
  } else {
    lines.push('Unknown schematic');
  }

  return {
    recipe,
    meta,
    visibility,
    lines,
    canFabricate: visibility === 'KNOWN',
  };
}

export function listRecipeVisibilityStatuses(
  profile: ProgressionProfile,
  account: PlayerAccount,
): RecipeVisibilityStatus[] {
  return listAllRecipes().map((recipe) => buildRecipeVisibilityStatus(profile, account, recipe));
}

export function listForgeVisibleRecipes(
  profile: ProgressionProfile,
  account: PlayerAccount,
): RecipeVisibilityStatus[] {
  return listRecipeVisibilityStatuses(profile, account)
    .filter((s) => s.visibility !== 'UNKNOWN');
}

export function isRecipeFabricable(
  profile: ProgressionProfile,
  account: PlayerAccount,
  recipeId: string,
): boolean {
  const recipe = getCraftingRecipe(recipeId);
  if (!recipe) return false;
  return resolveRecipeVisibility(profile, account, recipe) === 'KNOWN';
}

/** Grant Known unlock for a recipe schematic. */
export function discoverRecipeSchematic(
  profile: ProgressionProfile,
  recipeIdOrOutput: string,
): { profile: ProgressionProfile; discovered: boolean; unlockId: string; label: string } {
  const recipe = getCraftingRecipe(recipeIdOrOutput)
    ?? listAllRecipes().find((r) => r.outputId === recipeIdOrOutput);
  if (!recipe) {
    return {
      profile,
      discovered: false,
      unlockId: recipeUnlockId(recipeIdOrOutput),
      label: recipeIdOrOutput,
    };
  }
  const meta = getRecipeVisibilityMeta(recipe);
  const unlockId = recipeUnlockId(meta.unlockKey);
  if (hasRecipeKnownUnlock(profile, meta.unlockKey)) {
    return { profile, discovered: false, unlockId, label: recipe.label };
  }

  let next: ProgressionProfile = {
    ...profile,
    grantedUnlocks: profile.grantedUnlocks.includes(unlockId)
      ? [...profile.grantedUnlocks]
      : [...profile.grantedUnlocks, unlockId],
    flags: profile.flags.includes(unlockId)
      ? [...profile.flags]
      : [...profile.flags, unlockId],
  };
  next = appendProgressionEvent(next, {
    kind: 'UNLOCK_GRANTED',
    message: `Recipe schematic known: ${recipe.label}`,
    unlockId,
    meta: { recipeId: recipe.id },
  });
  return { profile: next, discovered: true, unlockId, label: recipe.label };
}

/**
 * After stash changes / debrief — promote Rumored→Known when all ingredient types present,
 * and return newly discovered labels.
 */
export function syncRecipeDiscoveriesFromStash(
  profile: ProgressionProfile,
  account: PlayerAccount,
): { profile: ProgressionProfile; newlyKnown: string[] } {
  let next = profile;
  const newlyKnown: string[] = [];
  listAllRecipes().forEach((recipe) => {
    const before = resolveRecipeVisibility(next, account, recipe);
    if (before === 'KNOWN') return;
    if (!hasAllIngredientTypes(account, recipe)) return;
    const result = discoverRecipeSchematic(next, recipe.id);
    next = result.profile;
    if (result.discovered) newlyKnown.push(result.label);
  });
  return { profile: next, newlyKnown };
}

export function formatRecipeVisibilityReport(
  profile: ProgressionProfile,
  account: PlayerAccount,
): string {
  const statuses = listRecipeVisibilityStatuses(profile, account);
  const known = statuses.filter((s) => s.visibility === 'KNOWN');
  const rumored = statuses.filter((s) => s.visibility === 'RUMORED');
  const unknown = statuses.filter((s) => s.visibility === 'UNKNOWN');
  const lines = [
    '=== RECIPE VISIBILITY (PHASE 1G) ===',
    `Known ${known.length} // Rumored ${rumored.length} // Unknown ${unknown.length}`,
    '',
    '--- KNOWN ---',
    ...known.map((s) => `  ${s.recipe.label}`),
    '',
    '--- RUMORED ---',
    ...rumored.map((s) => `  ${s.recipe.label} // ${s.meta.sourceHint}`),
    '',
    '--- UNKNOWN ---',
    ...unknown.map((s) => `  ${s.recipe.label} [${s.meta.band}]`),
  ];
  return lines.join('\n');
}

export function buildRecipeVisibilityDebriefLines(
  profile: ProgressionProfile,
  account: PlayerAccount,
  newlyKnown: readonly string[],
): string[] {
  const lines: string[] = [];
  newlyKnown.forEach((label) => {
    lines.push(`SCHEMATIC KNOWN: ${label}`);
  });
  const rumored = listForgeVisibleRecipes(profile, account)
    .filter((s) => s.visibility === 'RUMORED')
    .slice(0, 3);
  rumored.forEach((s) => {
    lines.push(`RUMORED: ${s.recipe.label} — ${s.meta.rumoredPurpose}`);
  });
  return lines;
}

/** Ingredient ids referenced by a recipe — for extract discovery hints. */
export function recipeIngredientIds(recipe: CraftingRecipe): ResourceItemId[] {
  return recipe.requirements.map((r) => r.resourceId);
}
