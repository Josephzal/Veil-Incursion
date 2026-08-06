# Envoy Weapon-Kit E.5V Visual Review

**Status:** Open (Gate D) — partial evidence only.  
**Authority date:** 2026-08-06  
**Viewport of supplied captures:** desktop Combat Hub (~1440×900 macOS window).  
**Launch:** `npm run web` / `npm start` → descend as Envoy with equipped family.

Evidence files (user-supplied, Cursor assets):

| ID | File |
|----|------|
| HUB-HD | `Screenshot_2026-08-06_at_3.36.53_PM-be17e64e-2a8d-41f3-8954-85dafe38910d.png` |
| HUB-SC | `Screenshot_2026-08-06_at_3.37.08_PM-61ec9d20-0db4-4ccc-9927-16042bb47056.png` |
| HUB-VB | `Screenshot_2026-08-06_at_3.37.26_PM-93d47322-99ea-4705-bd91-835887c5c62c.png` |

## Matrix

| Surface | Family | State | Viewport | Evidence | Pass/Fail | Observed defect | Repair | Post-repair |
|---------|--------|-------|----------|----------|-----------|-----------------|--------|-------------|
| Combat Hub | Heart’s Due | Idle / ult ready | Desktop ~1440×900 | HUB-HD | **FAIL** | Only 4 WA cards; **FLEX ABILITIES row clipped**; no flex label visible | Compact grouped card height + `commandDeckAnchor` overflow visible | **Needs reinspection screenshot** |
| Combat Hub | Scythe | Idle / CLEAN CYCLE cold | Desktop ~1440×900 | HUB-SC | **FAIL** | Same clipped flex strip | Same | Needs reinspection |
| Combat Hub | Vambrace | Idle / Rot board | Desktop ~1440×900 | HUB-VB | **FAIL** | Same clipped flex strip; `GRAVE TRANSFER` shows dual-req copy (expected when dual incomplete) | Same | Needs reinspection |
| Combat Hub | All three | Naming | Desktop | HUB-* | **PASS** | Canonical names only; no `VEIL_SPLINTER` / underscores / Echo Lantern | — | — |
| Combat Hub | All three | Ward / Ultimate outside strip | Desktop | HUB-* | **PASS** | Ultimate readiness left rail (`FUNERAL KNOT` / `NULL CIRCUIT` / `CRIMSON REFRACTION`); Rot detonation / catalytic outside strip | — | — |
| Combat Hub | Heart’s Due | Brink / sacrifice chips | Desktop | HUB-HD | **PASS** | `BRINK COLD`, `SACRIFICE READY (−5 HP)` readable | — | — |
| Combat Hub | Scythe | CLEAN CYCLE | Desktop | HUB-SC | **PASS** | `CLEAN CYCLE COLD` readable | — | — |
| Combat Hub | Vambrace | Rot board | Desktop | HUB-VB | **PASS** | `ROT 6` + DETONATION READY outside strip | — | — |
| Combat Hub | — | Target label clip | Desktop | HUB-HD | **FAIL (minor)** | Ultimate name on target truncated (`CRIMSON REFRAC…`) | Deferred — not blocking strip layout | Open |
| Sanctuary / loadout ×3 | Vambrace / Scythe / Heart’s Due | Idle flex select | Desktop | LO-VB / LO-SC / LO-HD (2026-08-06 3:50) | **PASS** (structure) | Live 4 WA FIXED + 3 FLEX visible; names canonical | Manifest `3 / 4 ACTIVE` → `3 / 3` (`LoadoutHubPanel`) | Needs quick reinspect of header count |
| Combat Hub hang (bugfix) | Vambrace | Hostile turn after End Turn | Desktop recording 3.52 | REC-1 | **FAIL→FIX** | Thrall windup completed, queue advanced to Scuttler, resolve stalled; player undamaged | Actor capture + null-resolve advance + pause watchdog; evade/zero-dmg attack pose | Needs combat reinspect |
| Dossier Envoy | — | — | — | *none* | **UNRENDERED** | — | — | Blocked |
| DeckWorkspace / Safehouse | — | — | — | *none* | **UNRENDERED** | — | — | Blocked |
| Narrow Hub 390×844 | — | — | — | *none* | **UNRENDERED** | — | — | Blocked |
| Narrow loadout | — | — | — | *none* | **UNRENDERED** | — | — | Blocked |
| SINGLE / DUAL / NONE flows | — | — | — | *none* | **UNRENDERED** | Dual-req copy on Grave Transfer visible at idle only | — | Blocked |
| Insufficient resource / hover / selected | — | — | — | *none* | **UNRENDERED** | — | — | Blocked |
| Brink armed / exposure / Heart Claim payoff | — | — | — | *none* | **UNRENDERED** | Brink cold only | — | Blocked |

## Presentation repair (E.5V)

| Defect | Owner | Change |
|--------|-------|--------|
| FLEX ABILITIES row clipped under 198px cards + `overflow: 'hidden'` | `CombatCommandDeck.tsx`, `TacticalCombatHub.tsx` | Grouped dashboard cards use ~112px height; grouped host no longer shrinks away; `commandDeckAnchor.overflow = 'visible'` |

## Human reinspection checklist (to close Gate A)

1. Reload Combat Hub for Vambrace / Scythe / Heart’s Due — confirm **WEAPON ACTIONS** (4) + **FLEX ABILITIES** (3) + class catalyst card if shown.
2. Capture Sanctuary/loadout for each family (fixed WA strip + editable flex).
3. Capture Dossier + DeckWorkspace Envoy.
4. Capture narrow Hub + loadout (390×844).
5. Exercise `GRAVE_TRANSFER` dual pick, `CRIMSON_VENT` none-target, cancel, insufficient Flux/Stamina/AP, Brink, exposure → Heart Claim.
6. Attach new screenshots to this matrix and mark rows Pass.

## Non-blocking follow-ups

- Truncated ultimate name on arena target reticle.
- Exported GDD PDF regeneration (no in-repo export workflow).
