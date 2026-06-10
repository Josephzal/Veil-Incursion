import type { NarrativeContextSeed } from '../../../types/narrativeProcedural';

export const CITY_STREETS_CONTEXTS: readonly NarrativeContextSeed[] = [
  {
    id: 'ctx-terran-blacksite',
    macroFamily: 'CITY_STREETS',
    tags: ['terran', 'tech', 'indoor', 'urban'],
    title: 'TERRAN GRID BLACK-SITE',
    proseLead: 'You breach a decommissioned Terran Grid black-site annex buried under cracked transit asphalt.',
  },
  {
    id: 'ctx-solaris-refinery',
    macroFamily: 'CITY_STREETS',
    tags: ['solaris', 'industrial', 'indoor', 'urban'],
    title: 'SOLARIS REFINERY CORE',
    proseLead: 'You breach a decommissioned Solaris refinery core bleeding heat through ruptured atmospheric valves.',
  },
  {
    id: 'ctx-legion-transit',
    macroFamily: 'CITY_STREETS',
    tags: ['legion', 'transit', 'outdoor', 'urban'],
    title: 'LEGION TRANSIT COLLAPSE',
    proseLead: 'You enter a collapsed Legion transit spur where mag-rails hang torn over rain-slick alley stone.',
  },
  {
    id: 'ctx-flooded-culvert',
    macroFamily: 'CITY_STREETS',
    tags: ['urban', 'hydro', 'outdoor', 'sewer'],
    title: 'FLOODED CULVERT',
    proseLead: 'You descend into a flooded culvert where street runoff mixes with occult backwash from the upper grid.',
  },
  {
    id: 'ctx-neon-theatre',
    macroFamily: 'CITY_STREETS',
    tags: ['urban', 'occult', 'indoor', 'cultural'],
    title: 'NEON THEATRE BACKSTAGE',
    proseLead: 'You slip behind a sealed neon theatre curtain into a backstage corridor humming with void-frequency residue.',
  },
  {
    id: 'ctx-faction-vault',
    macroFamily: 'CITY_STREETS',
    tags: ['vault', 'tech', 'industrial', 'urban'],
    title: 'FACTION VAULT INFRASTRUCTURE',
    proseLead: 'You breach a sealed faction vault — crashed transport plating and ritual lockbands frame a high-yield extraction conduit.',
  },
];
