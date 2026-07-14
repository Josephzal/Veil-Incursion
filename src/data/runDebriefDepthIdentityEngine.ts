import type { ActiveIncursionState } from '../types/game';
import type { DepthIdentityState } from '../types/depthIdentity';
import type { VeilBiome as EncounterVeilBiome } from '../types/encounterSpawn';
import { getDeepVeilLawDefinition, getVeilDistortionDefinition } from './depthIdentityCatalog';
import { getEncounterModifierDefinition } from './encounterModifierCatalog';
import { getTwistedTemplateDefinition } from './twistedTemplateCatalog';
import { formatSectorDepthFlavorLine } from './sectorDepthVisualCatalog';

export interface DepthIdentityDebriefSummary {
  distortionName: string | null;
  distortionSummary: string | null;
  lawName: string | null;
  lawSummary: string | null;
  intensified: boolean;
  modifiersSeen: string[];
  modifiersCleared: string[];
  twistedSeen: string[];
  twistedCleared: string[];
  twistedOutcomes: string[];
  depth2VariantsDefeated: string[];
  depth3ExclusivesDefeated: string[];
  depthIdentityOpProgressGained: number;
  sectorDepthFlavor: string | null;
  lines: string[];
}

export function buildDepthIdentityDebriefSummary(
  incursion: Pick<ActiveIncursionState, 'depthIdentity' | 'runVeilBiome' | 'currentDistrict'>,
): DepthIdentityDebriefSummary | null {
  const state = incursion.depthIdentity;
  const hasIdentity = Boolean(state?.activeVeilDistortion || state?.activeDeepVeilLaw);
  const hasModifiers = Boolean(
    state?.encounterModifiersSeen?.length || state?.encounterModifiersCleared?.length,
  );
  const hasTwisted = Boolean(
    state?.twistedTemplatesSeen?.length
    || state?.twistedTemplatesCleared?.length
    || state?.twistedOutcomes?.length,
  );
  const hasKills = Boolean(
    state?.depth2VariantsDefeated?.length || state?.depth3ExclusivesDefeated?.length,
  );
  const hasOp = Boolean(state?.depthIdentityOpProgressGained && state.depthIdentityOpProgressGained > 0);
  const biome = incursion.runVeilBiome as EncounterVeilBiome | null | undefined;
  const district = (incursion.currentDistrict as 1 | 2 | 3) ?? 1;
  const sectorDepthFlavor = biome
    ? formatSectorDepthFlavorLine(biome, district)
    : null;

  if (!hasIdentity && !hasModifiers && !hasTwisted && !hasKills && !hasOp && !sectorDepthFlavor) {
    return null;
  }

  const distortionName = state?.activeVeilDistortion
    ? getVeilDistortionDefinition(state.activeVeilDistortion).displayName
    : null;
  const distortionSummary = state?.activeVeilDistortion
    ? getVeilDistortionDefinition(state.activeVeilDistortion).effectSummary
    : null;
  const lawName = state?.activeDeepVeilLaw
    ? getDeepVeilLawDefinition(state.activeDeepVeilLaw).displayName
    : null;
  const lawSummary = state?.activeDeepVeilLaw
    ? getDeepVeilLawDefinition(state.activeDeepVeilLaw).effectSummary
    : null;

  const modifiersSeen = (state?.encounterModifiersSeen ?? []).map(
    (id) => getEncounterModifierDefinition(id).displayName,
  );
  const modifiersCleared = (state?.encounterModifiersCleared ?? []).map(
    (id) => getEncounterModifierDefinition(id).displayName,
  );
  const twistedSeen = (state?.twistedTemplatesSeen ?? []).map(
    (id) => getTwistedTemplateDefinition(id).displayName,
  );
  const twistedCleared = (state?.twistedTemplatesCleared ?? []).map(
    (id) => getTwistedTemplateDefinition(id).displayName,
  );
  const twistedOutcomes = (state?.twistedOutcomes ?? []).map((entry) => entry.summary);
  const depth2VariantsDefeated = state?.depth2VariantsDefeated ?? [];
  const depth3ExclusivesDefeated = state?.depth3ExclusivesDefeated ?? [];
  const depthIdentityOpProgressGained = state?.depthIdentityOpProgressGained ?? 0;

  const lines: string[] = [];
  if (sectorDepthFlavor) {
    lines.push(sectorDepthFlavor);
  }
  if (distortionName && distortionSummary) {
    lines.push(`Breach Distortion: ${distortionName}`);
    lines.push(distortionSummary);
  }
  if (lawName && lawSummary) {
    lines.push(
      state?.intensifiedFromDistortion
        ? `Deep Veil Law (intensified): ${lawName}`
        : `Deep Veil Law: ${lawName}`,
    );
    lines.push(lawSummary);
  }
  if (modifiersSeen.length > 0) {
    lines.push(`Encounter modifiers seen: ${modifiersSeen.join(', ')}`);
  }
  if (modifiersCleared.length > 0) {
    lines.push(`Encounter modifiers cleared: ${modifiersCleared.join(', ')}`);
  }
  if (twistedSeen.length > 0) {
    lines.push(`Twisted templates seen: ${twistedSeen.join(', ')}`);
  }
  if (twistedCleared.length > 0) {
    lines.push(`Twisted templates cleared: ${twistedCleared.join(', ')}`);
  }
  for (const outcome of twistedOutcomes) {
    lines.push(`Twisted outcome: ${outcome}`);
  }
  if (depth2VariantsDefeated.length > 0) {
    lines.push(`Depth 2 variants defeated: ${depth2VariantsDefeated.join(', ')}`);
  }
  if (depth3ExclusivesDefeated.length > 0) {
    lines.push(`Depth 3 exclusives defeated: ${depth3ExclusivesDefeated.join(', ')}`);
  }
  if (depthIdentityOpProgressGained > 0) {
    lines.push(`Depth-identity operation progress: +${depthIdentityOpProgressGained}`);
  }

  if (lines.length === 0) return null;

  return {
    distortionName,
    distortionSummary,
    lawName,
    lawSummary,
    intensified: Boolean(state?.intensifiedFromDistortion),
    modifiersSeen,
    modifiersCleared,
    twistedSeen,
    twistedCleared,
    twistedOutcomes,
    depth2VariantsDefeated,
    depth3ExclusivesDefeated,
    depthIdentityOpProgressGained,
    sectorDepthFlavor,
    lines,
  };
}

export function formatDepthIdentityDebriefLines(
  state: DepthIdentityState | null | undefined,
): string[] {
  return buildDepthIdentityDebriefSummary({
    depthIdentity: state ?? null,
    runVeilBiome: null,
    currentDistrict: 1,
  })?.lines ?? [];
}
