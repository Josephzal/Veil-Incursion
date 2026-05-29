export type AppScreen =
  | 'WELCOME'
  | 'SCANNING'
  | 'PATH_CHOICE'
  | 'POST_COMBAT_BOON'
  | 'SKILL_CHECK'
  | 'REST'
  | 'COMBAT'
  | 'RUN_COMPLETE';

export type ScanMode = 'INITIAL' | 'COMBAT_ENTRY';
