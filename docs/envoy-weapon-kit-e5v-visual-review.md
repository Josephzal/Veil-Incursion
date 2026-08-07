# Envoy Weapon-Kit E.5V Visual Review

**Status:** Open (Gate D) — layout repair landed; rendered reinspection required.
**Authority date:** 2026-08-07
**Target viewports:** Desktop 1440×900; Narrow 390×844.
**Launch:** `npm run web` / `npm start` → descend as each class with equipped family.

## Presentation repair (E.5V / all-class)

| Defect | Owner | Change |
|--------|-------|--------|
| Stacked WA + flex rows clipped / consumed vertical space | `CombatCommandDeck.tsx` | Single horizontal grouped rail (`WEAPON ACTIONS` \| `TECHNIQUES` / `FLEX ABILITIES`) |
| Class mechanic inside flex row (looked editable) | `CombatCommandDeck.tsx` | Pinned `CLASS MECHANIC` column right of rail: Parry / Rift Ward / Reload |
| Oversized cards (~198px / 112px stacked) | `CombatCommandDeck.tsx` | Compact grouped height ~92px desktop / ~86px narrow; card width ~96px |
| Envoy Catalyst occupying mechanic slot | `CombatCommandDeck.tsx` + hub | Rift Ward status in mechanic slot; Catalytic Console moved to End Turn column |
| Turn column too wide for 7-up rail | `CombatCommandDeck.tsx` | `conceptTurnCol` width 108 |

Automated coverage: `src/data/combatCommandRailLayout.test.ts` (rail order + mechanic outside cards for Aegis/Envoy/Hex).

## Human reinspection checklist (required to close Gate A)

1. Combat Hub desktop 1440×900 — Aegis (each weapon family), Envoy (Vambrace / Scythe / Heart’s Due), Hex (each family).
2. Confirm one horizontal primary-action row; mechanic pinned right; Ultimate left; End Turn right.
3. Narrow 390×844 — rail scrolls; mechanic / End Turn / Ultimate remain accessible.
4. Exercise hover/focus/selected/disabled/insufficient-resource/targeting/cancel for each class.
5. Envoy: exactly 7 cards; no `VEIL_SPLINTER` / `BLACK_WICK`; Rift Ward outside rail; Techniques label.
6. Attach screenshots and mark matrix rows Pass.

## Matrix (post-repair)

| Surface | Family | Viewport | Evidence | Pass/Fail | Notes |
|---------|--------|----------|----------|-----------|-------|
| Combat Hub | Envoy ×3 | 1440×900 | *pending* | **UNRENDERED** | Layout code ready |
| Combat Hub | Aegis ×3 | 1440×900 | *pending* | **UNRENDERED** | Layout code ready |
| Combat Hub | Hex ×3 | 1440×900 | *pending* | **UNRENDERED** | Layout code ready |
| Combat Hub | All | 390×844 | *pending* | **UNRENDERED** | Scroll hint when non-desktop |
| Interaction states | All | Desktop | *pending* | **UNRENDERED** | — |
