export type AppScreen =
  | 'HUB'
  | 'WELCOME'
  | 'SCANNING'
  | 'NARRATIVE'
  | 'POST_COMBAT_BOON'
  | 'SKILL_CHECK'
  | 'REST'
  | 'BLACK_MARKET'
  | 'RESOURCE_HARVEST'
  | 'EXTRACTION_REVIEW'
  | 'COMBAT'
  | 'RUN_PROGRESS'
  | 'RUN_COMPLETE'
  | 'SAFEHOUSE'
  | 'GAME_OVER';

export type ScanMode = 'INITIAL' | 'COMBAT_ENTRY';
