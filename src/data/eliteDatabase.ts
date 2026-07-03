import { buildEliteDeck, verifyEliteDecks } from './encounterDeckBuilder';

export const ELITE_DATABASE: readonly import('./synergyEncounterTypes').SynergySquadSpec[] =
  buildEliteDeck();

export { verifyEliteDecks };
