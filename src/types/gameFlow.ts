export type AppScreen =
  | 'HUB'
  | 'INVENTORY'
  | 'WELCOME'
  | 'SCANNING'
  | 'NARRATIVE'
  | 'POST_COMBAT_BOON'
  | 'SKILL_CHECK'
  | 'REST'
  | 'COMBAT'
  | 'RUN_PROGRESS'
  | 'RUN_COMPLETE'
  | 'GAME_OVER';

export type ScanMode = 'INITIAL' | 'COMBAT_ENTRY';
