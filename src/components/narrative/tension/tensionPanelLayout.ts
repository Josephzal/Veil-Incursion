import { StyleSheet } from 'react-native';
import {
  NARRATIVE_TENSION_FEEDBACK_MIN_HEIGHT,
  NARRATIVE_TENSION_HINT_MIN_HEIGHT,
  NARRATIVE_TENSION_INSTRUCTION_MIN_HEIGHT,
} from '../../../constants/narrativeLayout';

const PANEL_BG = '#141418';

/** Shared tension mini-game shell — fixed panel footprint across all mechanics. */
export const tensionPanelStyles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
    gap: 8,
  },
  header: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
    color: '#9ca3af',
    flexShrink: 0,
  },
  panel: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: PANEL_BG,
    padding: 14,
    gap: 12,
  },
  instructions: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
    color: '#9ca3af',
    letterSpacing: 0.4,
    minHeight: NARRATIVE_TENSION_INSTRUCTION_MIN_HEIGHT,
  },
  feedbackSlot: {
    minHeight: NARRATIVE_TENSION_FEEDBACK_MIN_HEIGHT,
    justifyContent: 'center',
  },
  feedbackText: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.4,
    color: '#6b7280',
  },
  hint: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 12,
    color: '#6b7280',
    textAlign: 'center',
    minHeight: NARRATIVE_TENSION_HINT_MIN_HEIGHT,
  },
  penalty: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.5,
    color: '#7f1d1d',
    textAlign: 'center',
    minHeight: 14,
  },
});
