import type { LegacyMatrixEventTemplate } from '../narrativeEncounterMatrix';
import { LEGACY_MATRIX_EVENT_TEMPLATES } from '../narrativeEncounterMatrix';
import type {
  Biome,
  Cabal,
  ComplicationSeed,
  ContextSeed,
  ResolverSet,
  Tag,
  TensionMechanic,
} from '../../types/narrativeAssembly';

export interface MigratedLegacyCatalog {
  contexts: ContextSeed[];
  complications: ComplicationSeed[];
  resolverSets: ResolverSet[];
  /** Legacy matrix id → assembly seed ids. */
  matrixIndex: Record<
    string,
    {
      contextId: string;
      complicationId: string;
      resolverSetId: string;
    }
  >;
}

function stripChoiceLabel(label: string): string {
  return label.replace(/^\[\s*[A-D]\s*\]\s*/i, '').trim();
}

function legacySeedPrefix(matrixId: string): string {
  return matrixId.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
}

function inferBiomes(matrixId: string): Biome[] {
  if (matrixId.startsWith('city-') || matrixId.startsWith('sector-')) {
    return ['city_streets', 'backroads'];
  }
  if (matrixId.startsWith('hospital-')) {
    return ['city_buildings', 'underground'];
  }
  if (matrixId.startsWith('lab-')) {
    return ['underground', 'city_buildings'];
  }
  return ['city_streets'];
}

function inferTags(matrixId: string, scenarioText: string): Tag[] {
  const text = scenarioText.toLowerCase();
  const tags = new Set<Tag>(['physical']);

  if (matrixId.startsWith('city-') || matrixId.startsWith('sector-')) tags.add('urban');
  if (matrixId.startsWith('hospital-') || matrixId.startsWith('lab-')) tags.add('indoor');
  else tags.add('outdoor');

  if (
    /occult|spectral|void|ghost|ley|phantom|ectoplasm|ritual|sigil|memory bleed/.test(text)
  ) {
    tags.add('occult');
  }
  if (/hazard|caustic|volatile|burn|corrosive|fracture|overload/.test(text)) {
    tags.add('hazardous');
  }
  if (/terminal|server|grid|encryption|telemetry|matrix|uplink|firmware/.test(text)) {
    tags.add('tech');
  }
  if (/forest|tree|park|timber|canopy/.test(text)) {
    tags.add('nature');
  }
  if (/subway|sewer|sublevel|underground|conduit|shaft|maintenance/.test(text)) {
    tags.add('subterranean');
  }

  return [...tags];
}

function inferCabal(requirement: string): Cabal {
  const req = requirement.toUpperCase();
  if (req.includes('CHAIN ANCHOR B') || req.includes('VOID') || req.includes('COMMUNE')) {
    return 'Solaris';
  }
  if (req.includes('CHAIN ANCHOR A') || req.includes('LEGION')) {
    return 'Legion';
  }
  return 'Terran_Grid';
}

function inferDefaultPenalty(tags: readonly Tag[]): ComplicationSeed['defaultPenalty'] {
  if (tags.includes('occult')) {
    return { type: 'Resonance', amount: 20 };
  }
  return { type: 'HP', amount: 20 };
}

function pickLegacyTensionMechanic(matrixId: string): TensionMechanic {
  const lastChar = matrixId.charCodeAt(matrixId.length - 1) ?? 0;
  return lastChar % 2 === 0 ? 'Mechanic_SigilTrace' : 'Mechanic_ScavengeBar';
}

function buildResolverSet(
  matrixId: string,
  event: LegacyMatrixEventTemplate,
  complicationId: string,
  tensionMechanic: TensionMechanic,
): ResolverSet {
  const resolverSetId = `LEGACY_RES_${legacySeedPrefix(matrixId)}`;
  const isConditional = event.interactionMode === 'conditional';

  return {
    id: resolverSetId,
    complicationId,
    optionA: {
      text: stripChoiceLabel(event.choiceA.label),
      tensionMechanic,
      onSuccess: 'Legacy calibration cleared',
      onFailure: 'Apply default penalty',
    },
    optionB: {
      text: stripChoiceLabel(event.choiceB.label),
      requirementType: 'Cabal',
      requirementValue: inferCabal(event.choiceB.requirement),
      onSuccess: 'Legacy bypass — alternate path cleared',
    },
    optionC: {
      text: '[Use: Grave-Dust Ampoule] Invoke legacy contingency.',
      requirementType: 'Item',
      requirementValue: 'Grave_Dust_Ampoule',
      onSuccess: 'Legacy item bypass cleared',
    },
    optionD: isConditional
      ? {
          text: 'Abort and return to the ley-line grid.',
          type: 'Retreat',
          onSuccess: 'Return to Map',
        }
      : {
          text: stripChoiceLabel(event.choiceB.label),
          type: 'BruteForce',
          onSuccess: 'Legacy brute outcome (-20 HP)',
        },
  };
}

function migrateLegacyEvent(
  matrixId: string,
  event: LegacyMatrixEventTemplate,
): {
  context: ContextSeed;
  complication: ComplicationSeed;
  resolverSet: ResolverSet;
} {
  const prefix = legacySeedPrefix(matrixId);
  const contextId = `LEGACY_CTX_${prefix}`;
  const complicationId = `LEGACY_COMP_${prefix}`;
  const tags = inferTags(matrixId, event.scenarioText);
  const requiredTags = tags.slice(0, Math.min(2, tags.length));
  const tensionMechanic = pickLegacyTensionMechanic(matrixId);

  const context: ContextSeed = {
    id: contextId,
    biomes: inferBiomes(matrixId),
    tags,
    flavorText: event.scenarioText,
  };

  const complication: ComplicationSeed = {
    id: complicationId,
    requiredTags: requiredTags.length > 0 ? requiredTags : ['urban'],
    flavorText: `${event.title} — ${stripChoiceLabel(event.choiceA.label)} or ${stripChoiceLabel(event.choiceB.label)}.`,
    defaultPenalty: inferDefaultPenalty(tags),
  };

  const resolverSet = buildResolverSet(matrixId, event, complicationId, tensionMechanic);

  return { context, complication, resolverSet };
}

export function migrateLegacyNodes(
  templates: Readonly<Record<string, LegacyMatrixEventTemplate>> = LEGACY_MATRIX_EVENT_TEMPLATES,
): MigratedLegacyCatalog {
  const contexts: ContextSeed[] = [];
  const complications: ComplicationSeed[] = [];
  const resolverSets: ResolverSet[] = [];
  const matrixIndex: MigratedLegacyCatalog['matrixIndex'] = {};

  const sortedIds = Object.keys(templates).sort();
  for (const matrixId of sortedIds) {
    const event = templates[matrixId];
    if (!event) continue;

    const migrated = migrateLegacyEvent(matrixId, event);
    contexts.push(migrated.context);
    complications.push(migrated.complication);
    resolverSets.push(migrated.resolverSet);
    matrixIndex[matrixId] = {
      contextId: migrated.context.id,
      complicationId: migrated.complication.id,
      resolverSetId: migrated.resolverSet.id,
    };
  }

  return { contexts, complications, resolverSets, matrixIndex };
}

export function getLegacyMigrationForMatrixId(
  matrixId: string,
  catalog: MigratedLegacyCatalog = migrateLegacyNodes(),
): MigratedLegacyCatalog['matrixIndex'][string] | undefined {
  return catalog.matrixIndex[matrixId];
}
