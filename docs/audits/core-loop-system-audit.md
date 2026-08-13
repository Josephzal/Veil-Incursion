# Stage I-A: Core-Loop System Audit

Read-only inventory of implementation surfaces affected by The Veil Core Loop Integration Master Specification. Classifications record required future action — **no gameplay changes** were made.

## 1. Executive summary

Audited **27** system components across eight required areas, plus **39** Bound Requisition / Expedition Relic donor dispositions.

**Classification totals:**
- **KEEP**: 7
- **MERGE**: 1
- **MIGRATE**: 7
- **DISABLE**: 4
- **REMOVE**: 7
- **DEFER**: 1

**By system family:** boonRewards=4, boundRequisitions=2, classRank=3, crossCuttingPersistence=2, expeditionRelics=1, legacyCombatTrinkets=4, operationsAftermath=4, sanctuary=4, weaponTier=3

**Critical runtime finding:** Elite post-combat is currently the **only live random class-boon source** (`isPostCombatBoonBlocked` / `preparePostCombatMutations`).

**Recommended next slice:** legacy combat-trinket removal (sufficiently isolated).

## 2. Source authority and supersession rules

- 1. The Veil - Core Loop Integration Master Specification (PDF 2026-08-10, 29 pages)
- 2. The Veil - Universal Boon System Master Specification (PDF 2026-08-10, 32 pages) except where amended by Core Loop
- 3. Veil GDD (PDF Veil GDD (1).pdf 2026-08-07, 90 pages) + docs/current-game-systems-design.md as in-repo GDD mirror
- 4. Repository code and tests = current runtime behavior, not design authority

**Core Loop amendments applied (do not preserve superseded boon-master assumptions):**
- Four routine Imprints: Armament, Discipline, Instinct, Current
- Verdict is separate deep-run boss reward (not routine Core Imprint)
- Three standard Authorities per run; fourth requires exceptional override
- Boon acquisition scales with depth
- Elites remain optional boon sources, not the only reliable source
- Grafts use Sanctuary Attunement without persistent Residue or Class Rank power gates

**Explicitly rejected:**
- Five-Imprint routine catalog
- Four-Authority soft cap as normal
- Six-to-eight boon selections for every successful run regardless of depth
- Elite post-combat as sole reliable boon source
- Residue/Class Rank as graft power gates

**Source discrepancies:**
- Master specs live as PDFs in Downloads; repo GDD mirror is docs/current-game-systems-design.md — Used Core Loop PDF (newer 2026-08-10) as top authority; GDD PDF (1) newer than Veil GDD.pdf; Phase_4_Boon_Refactor.md treated as superseded where Core Loop amends cadence/Authorities
- Phase 4 Boon Refactor still states elite as primary random surface and 6-8 selections — Superseded by Core Loop §11; recorded as historical, not target

## 3. Repository baseline

- Commit: `ed75f8f62a49e73d0998824b91d424c1d8fe25c5`
- Branch: `veil-cabal-refactor`
- Status at start: clean (no short-status entries)
- Audited at (UTC): 2026-08-10T21:16:34Z
Pre-existing dirty combat polish files from earlier session were not present at audit start; only audit deliverables may be written.

## 4. Classification totals

| Classification | Count |
|---|---:|
| KEEP | 7 |
| MERGE | 1 |
| MIGRATE | 7 |
| DISABLE | 4 |
| REMOVE | 7 |
| DEFER | 1 |
| **Total system records** | **27** |

## 5. System-by-system findings

### operationsAftermath

#### aftermath.deadArtifacts — `REMOVE`

**Component:** SECTOR_FATIGUE type without rule; dead scanner unlock

**Current behavior:** SECTOR_FATIGUE appears in normalizeLegacyModifier fallback without catalog rule. scanner-resource-visibility unlock never applied.

**Target responsibility:** Delete or implement; no silent no-ops.

**Rationale:** Obfuscates Aftermath simplification.

**Evidence:**
- `src/data/proceduralAftermathEngine.ts` — `normalizeLegacyModifier / SECTOR_FATIGUE` — Orphan type
- `src/data/operationRulesEngine.ts` — `scanner-resource-visibility` — Never applied

**Shutdown/merge plan:** Remove orphan type and dead unlock strings.

**Migration:** Strip unknown aftermath types fail-closed with warning (future).

**Risk:** low · **Stage:** VI

#### aftermath.eliteSuppression — `MIGRATE`

**Component:** ELITE_SUPPRESSION / eliteWeight reductions after successful clears

**Current behavior:** ELITE_SUPPRESSION and ANCHOR_PRESSURE_REDUCED lower eliteWeight. worldStateEngine only boosts eliteWeightDelta when eliteWeight>1 — reductions <1 do not lower spawn weights. Combined with elite-only boons, success can reduce build growth.

**Target responsibility:** Must not silently reduce principal source of run-build power (Core Loop §9); after boon sources diversify, suppression may remain pressure-only.

**Rationale:** Cross-system conflict: elite-only boons + elite suppression.

**Evidence:**
- `src/data/proceduralAftermathCatalog.ts` — `ELITE_SUPPRESSION` — Rule definition
- `src/data/worldStateEngine.ts` — `eliteWeight → eliteWeightDelta` — Asymmetric apply
- `src/data/nodeGenerationContextEngine.ts` — `elite weight consumers` — Node weights

**Shutdown/merge plan:** Either wire reductions correctly as pressure-only, or remove suppression until Contacts exist; flag ELITE_SUPPRESSION_AFFECTS_SPAWNS.

**Migration:** Review active ELITE_SUPPRESSION saves.

**Risk:** high · **Stage:** V-VI

**Unresolved:**
- Is current non-application of eliteWeight<1 intentional soft-fail?

#### aftermath.operationLifecycle — `MIGRATE`

**Component:** Operation lifecycle AFTERMATH lock + completion effects

**Current behavior:** Dual 'aftermath' naming: sector modifiers vs lifecycle AFTERMATH locking community progress. Completion may grant rewardLevelBoost; unlockTemporarySectorModifier scanner-resource-visibility never applied; contractBiasDelta copied but not applied.

**Target responsibility:** One global featured Operation; one readable Aftermath; dead unlocks removed.

**Rationale:** Core Loop §4.2–4.3 simplify Operations and remove community progress complexity.

**Evidence:**
- `src/data/operationLifecycleEngine.ts` — `tickSectorOperationLifecycleAfterRun` — Lifecycle AFTERMATH
- `src/data/operationRulesEngine.ts` — `unlockTemporarySectorModifier` — Dead unlock string
- `src/data/proceduralAftermathEngine.ts` — `contractBiasDelta` — Copied, not applied

**Shutdown/merge plan:** Simplify to one featured op; remove dead unlocks; clarify naming.

**Migration:** temporarySectorModifiers / sectorOperationLifecycle reshape.

**Risk:** medium · **Stage:** VI

#### aftermath.stackingSectorModifiers — `MIGRATE`

**Component:** Stacking sector aftermath modifiers with intensity

**Current behavior:** 10 AFTERMATH_RULES; max 3 modifiers/sector; stackKey refresh/intensify; persists on WorldStatePersistedState.sectorAftermathModifiersBySector; applied via applyPostRunAftermath → next brief.

**Target responsibility:** One named Aftermath condition per sector, no stacking/intensity (Core Loop §4.2 / §9.2).

**Rationale:** Launch scope simplifies Aftermath.

**Evidence:**
- `src/data/proceduralAftermathCatalog.ts` — `AFTERMATH_RULES` — 10-rule catalog
- `src/data/proceduralAftermathEngine.ts` — `applyAftermathFromRun` — Persistence apply
- `src/data/proceduralAftermathDebriefAdapter.ts` — `debrief preview` — UI

**Shutdown/merge plan:** Replace multi-modifier merge with single named condition; migrate save map.

**Migration:** Collapse sectorAftermathModifiersBySector to one active condition.

**Risk:** high · **Stage:** VI

### boonRewards

#### boon.boundCuratedScars — `MIGRATE`

**Component:** Bound Requisition curated Ley-Scar grants (non-random)

**Current behavior:** BLOOD_PRICE / SUNKEN_RITE push curated leyLineMutations at run start. isLeyScarAcquisitionBlocked (IRONCLAD) can skip elite offers.

**Target responsibility:** Corrupted Bargain / Contract clause / Authority — not ordinary Requisition combat power.

**Rationale:** Core Loop moves sponsor mandates and combat engines off standard Requisitions.

**Evidence:**
- `src/data/boundRequisitionEngine.ts` — `BLOOD_PRICE / SUNKEN_RITE apply` — Curated scar grant
- `src/data/boundRequisitionEngine.ts` — `isLeyScarAcquisitionBlocked` — Blocks post-combat offers

**Shutdown/merge plan:** Rehome curated grants during Requisition merge.

**Migration:** Map BR scar grants to new sources.

**Risk:** medium · **Stage:** IV-V

#### boon.eliteOnlyGrantPath — `MIGRATE`

**Component:** Live random class-boon grant path (elite post-combat only)

**Current behavior:** isPostCombatBoonBlocked returns true unless node type ELITE_COMBAT (or ley-scar blocked). preparePostCombatMutations clears offers for non-elites. Boss victory skips boon; standard combat goes harvest. Elite post-combat is the ONLY live random class-boon source.

**Target responsibility:** Depth-scaled sources: First Omen, one Contact/depth, optional elites, bosses/Verdicts, Corrupted/Sponsor events — elites optional not sole reliable source.

**Rationale:** Core Loop §11.4–11.5 amends boon master; elite cannot remain only reliable source.

**Evidence:**
- `src/context/RunContext.tsx` — `isPostCombatBoonBlocked` — Gates non-ELITE_COMBAT
- `src/context/RunContext.tsx` — `preparePostCombatMutations` — Returns [] unless elite
- `src/screens/CombatScreen.tsx` — `startPostCombatBoon / isPostCombatBoonBlocked` — Victory routing
- `docs/current-game-systems-design.md` — `Boon offers (elite post-combat)` — Documents elite-only surface

**Shutdown/merge plan:** Add Contact/Omen/boss sources behind flags; keep elite as optional premium.

**Migration:** postCombatMutationChoices remains session; new pending-offer fields likely.

**Risk:** high · **Stage:** V

**Unresolved:**
- Authority Contact node type exists in procedural gen yet?

#### boon.offerSelectionStack — `KEEP`

**Component:** Hard eligibility → composition → soft weighting → seeded selection

**Current behavior:** boonOffer/ pipeline prepares weighted offers from class catalogs; affinity soft-only; grafts update tags after apply.

**Target responsibility:** Remain authority for offer selection under new Authority-specific sources.

**Rationale:** Core Loop keeps universal compatibility/selection philosophy from boon master; amends cadence only.

**Evidence:**
- `src/data/boonOffer/boonOfferEngine.ts` — `prepareWeightedBoonOffers` — Selection entry
- `src/data/boonOffer/boonHardEligibility.ts` — `hard gates` — Eligibility
- `src/data/boonOffer/boonSoftWeighting.ts` — `soft weights` — Weighting
- `src/data/boonOfferPhase3I.test.ts` — `phase 3I tests` — Coverage

**Shutdown/merge plan:** N/A — extend sources later.

**Migration:** None for stack itself.

**Risk:** low · **Stage:** V

#### boon.veilBleedDeadNode — `DISABLE`

**Component:** VEIL_BLEED_BOON node kind unused in level pools

**Current behavior:** VEIL_BLEED_BOON type exists in descent matrix language and engage routing, but LEVEL_MATRIX pools never spawn it. Engage would open PostCombatBoonScreen which then auto-empties via elite gate.

**Target responsibility:** Revive as scheduled Contact/Bleed source or remove dead kind.

**Rationale:** Dead path; Core Loop wants scheduled Contacts — do not treat as live.

**Evidence:**
- `src/data/descentLevelMatrix.ts` — `VEIL_BLEED_BOON` — Type present
- `src/screens/ScanningScreen.tsx` — `VEIL_BLEED_BOON route` — Engage handler exists

**Shutdown/merge plan:** Disable engage until spawned, or wire as Contact.

**Migration:** None.

**Risk:** low · **Stage:** V

### classRank

#### classRank.graftCapacityGates — `REMOVE`

**Component:** Graft capacity and socket-quality gates by Class Rank

**Current behavior:** getGraftSocketAccessForClassRank returns capacity and allowFixedBasic/Ultimate/ApexMasterwork. Used by Sanctuary apply, offer filter, sanitization, ClassGraftUI, RestScreen, compatibility, recommendation requiredClassRank.

**Target responsibility:** Capacity independent of Class Rank (Core Loop: 1 socket intro, 2 by Depth 2 extraction).

**Rationale:** Core Loop §4.3 and §10.3 forbid Class Rank graft-capacity and socket-quality gates.

**Evidence:**
- `src/data/graftSynergy/graftCapacityEngine.ts` — `getGraftSocketAccessForClassRank` — Rank→capacity ladder
- `src/context/RunContext.tsx` — `getGraftSocketAccessForClassRank(classRank)` — Sanctuary apply gate
- `src/data/graftSynergy/permanentGraftLoadoutEngine.ts` — `filterGraftOffersForClassRank` — Offer filter
- `src/data/graftSynergyPhase3J.test.ts` — `capacity ladder asserts` — Tests pin rank gates

**Shutdown/merge plan:** Replace access fn with constant/full or depth-based capacity; update 3J tests; stop rank filtering offers.

**Migration:** Existing mid-run grafts: sanitize under more permissive rules.

**Risk:** medium · **Stage:** II-B

**Unresolved:**
- Exact capacity curve vs Core Loop depth targets?

#### classRank.hooksFlags — `DEFER`

**Component:** Stored reward hooks (abilities/grafts/boon pools) largely inert

**Current behavior:** Reward table writes unlockedAbilities/unlockedGraftLicenses/unlockedBoonPools/flags. Live graft access uses rank table, not license membership. unlockedBoonPools unused by classBoonEngine. CLASS_RANK_MIN unlock kind unused.

**Target responsibility:** Flavor/history flags only; never re-gate power.

**Rationale:** Dead wiring; clean later without blocking proof-of-fun.

**Evidence:**
- `src/data/classRankEngine.ts` — `CLASS_RANK_REWARD_TABLE` — Writes hooks
- `src/data/classBoonEngine.ts` — `preparePostCombatBoonOffers` — Does not read unlockedBoonPools

**Shutdown/merge plan:** Stop applying hooks or leave as flavor-only.

**Migration:** Optional prune of hook arrays.

**Risk:** low · **Stage:** DEFER

**Unresolved:**
- External tooling reading these flags?

#### classRank.xpHistory — `KEEP`

**Component:** Class Rank XP, history, debrief presentation

**Current behavior:** Ranks 1–20; XP from debrief applyClassRankFromDebrief; event log; pinned goals; theater cards. Reward table comment says hooks-only for many rows, but capacity still uses live rank.

**Target responsibility:** Informational mastery record / non-power history (or deferred content). No run-entry combat power.

**Rationale:** Core Loop §4.2 converts Class Rank from power/socket track to non-power mastery or deferred.

**Evidence:**
- `src/data/classRankEngine.ts` — `CLASS_RANK_MAX / applyClassRankXp` — XP ladder
- `src/context/PlayerAccountContext.tsx` — `applyClassRankFromRun` — Debrief settlement
- `src/data/debriefProgressionTheaterEngine.ts` — `class rank cards` — Presentation

**Shutdown/merge plan:** Keep XP/rank display; stop capacity from rank; optionally stop writing unused hooks.

**Migration:** Preserve rank/xp fields.

**Risk:** low · **Stage:** II-B

**Unresolved:**
- Keep showing next-graft-license copy after gates removed?

### sanctuary

#### graft.residueEconomy — `DISABLE`

**Component:** Persistent Veil Residue as graft power gate

**Current behavior:** sessionVeilResidueCollected / veilResidueBalance pays Sanctuary graft costs; vaulted across runs. Orthogonal to Class Rank XP but currently throttles graft application.

**Target responsibility:** No Residue cost for run-scoped Sanctuary Attune grafts.

**Rationale:** Core Loop §4.3 / §10.2: Attune consumes Sanctuary service, not persistent Residue.

**Evidence:**
- `src/context/RunContext.tsx` — `sessionVeilResidueCollected graft charge` — Spend on successful graft
- `src/components/ClassGraftUI.tsx` — `residueBalance` — UI afford gate

**Shutdown/merge plan:** Feature-flag Residue graft costs off; retain Residue economy for other systems until audited.

**Migration:** None for account balances; stop debiting on graft.

**Risk:** medium · **Stage:** II-B

**Unresolved:**
- Other live Residue sinks that must remain?

### crossCuttingPersistence

#### persistence.accountAndWorld — `KEEP`

**Component:** PlayerAccount + WorldState AsyncStorage persistence

**Current behavior:** player_account_v2 and world_state_v1 persist progression, weapons, keepsakes, residue, aftermath maps. ActiveIncursion and pendingDebrief are in-memory only.

**Target responsibility:** Retain account/world persistence; mid-run resume remains absent unless flagged later.

**Rationale:** Core infrastructure; Core Loop does not require mid-run save for proof-of-fun.

**Evidence:**
- `src/context/PlayerAccountContext.tsx` — `@veil_incursion/player_account_v2` — Account persist
- `src/context/WorldStateContext.tsx` — `@veil_incursion/world_state_v1` — World persist
- `src/context/RunContext.tsx` — `useState ActiveIncursion` — In-memory run
- `src/data/runIntegration/runLoopAuditEngine.ts` — `auditPersistenceSeparation` — Validator

**Shutdown/merge plan:** N/A.

**Migration:** See saveMigrationInventory for field-level work.

**Risk:** low · **Stage:** continuous

#### persistence.featureFlagHost — `KEEP`

**Component:** Existing featureFlags module as host for future shutdown flags

**Current behavior:** src/data/featureFlags.ts currently exposes AMBUSH_ENCOUNTERS_ENABLED and RESONANCE_SYSTEM_ACTIVE only.

**Target responsibility:** Host Core Loop shutdown/migration flags without implementing them in Stage I.

**Rationale:** Core Loop §4.3: disabled systems should be feature-flagged before deletion when migration needed.

**Evidence:**
- `src/data/featureFlags.ts` — `AMBUSH_ENCOUNTERS_ENABLED / RESONANCE_SYSTEM_ACTIVE` — Existing flags

**Shutdown/merge plan:** Add candidate flags listed in featureFlagCandidates (audit only).

**Migration:** None now.

**Risk:** low · **Stage:** II+

### expeditionRelics

#### relic.keepsakeRuntimeBase — `KEEP`

**Component:** Expedition Relic (keepsake) catalog and preferred retained runtime

**Current behavior:** 20 KeepsakeId relics; equippedKeepsakeId + keepsakeDeployment; initializeKeepsakeRuntime; scanner/cargo/market/contract/safehouse/echo/extract hooks; debrief via runDebriefKeepsakeEngine. No direct combat stat bonuses by design.

**Target responsibility:** Technical base for merged Expedition Requisitions; donor catalog not 1:1 preserved.

**Rationale:** Core Loop §5 prefers adapting Expedition Relic runtime (deployment choices, hooks, counters, debrief).

**Evidence:**
- `src/data/expeditionKeepsakeRegistry.ts` — `ALL_KEEPSAKE_IDS` — 20-relic roster
- `src/data/expeditionKeepsakeEngine.ts` — `initializeKeepsakeRuntime / applyKeepsakeOnRunStart` — Runtime init
- `src/data/keepsakeRunState.ts` — `keepsakeRuntime helpers` — Run state
- `src/components/hub/KeepsakeLoadoutPanel.tsx` — `equip UI` — Loadout
- `src/data/runDebriefKeepsakeEngine.ts` — `debrief summary` — Debrief
- `src/types/expeditionKeepsake.ts` — `Expedition Relic comment` — Explicitly not combat boons

**Shutdown/merge plan:** Retain runtime; absorb selected BR donors; retire dual-slot UI.

**Migration:** Account equippedKeepsakeId + keepsakeDeployment remain; map BR crafteds into new IDs.

**Risk:** medium · **Stage:** IV

### boundRequisitions

#### requisition.boundCatalogRuntime — `MERGE`

**Component:** Bound Requisition catalog, runtime, dual loadout slot

**Current behavior:** 19 Bound Requisition IDs; pre-run offers on BoundRequisitionScreen; runtime buildBoundRequisitionRuntime / applyBoundRequisitionAtRunStart; combat hooks (adrenaline, kinetic battery); market/ley-scar flags; account craftedAugments.

**Target responsibility:** Donor catalog into single Expedition Requisition (one equip). Recurring combat engines leave Requisition surface.

**Rationale:** Core Loop §5.1 merges BR + Relics; BR effects that are combat engines/mandates migrate conceptually.

**Evidence:**
- `src/data/boundRequisitions.ts` — `BOUND_REQUISITIONS catalog` — 19 IDs
- `src/data/boundRequisitionEngine.ts` — `buildBoundRequisitionRuntime` — Runtime builder
- `src/screens/BoundRequisitionScreen.tsx` — `confirmBoundRequisition` — Pre-run UI

**Shutdown/merge plan:** Migrate selected BR effects onto keepsake-style runtime; remove separate BR loadout slot; explicit ID migration table.

**Migration:** Bound Requisition IDs require explicit save/run-state migration table (Core Loop §5).

**Risk:** high · **Stage:** IV

**Unresolved:**
- Final merged roster size and which BR combat engines move to Authorities?

#### requisition.dualLoadoutSlots — `REMOVE`

**Component:** Separate Bound Requisition and Expedition Relic loadout slots

**Current behavior:** Player can equip both a Bound Requisition and an Expedition Relic for the same run (separate screens/state).

**Target responsibility:** Exactly one Expedition Requisition before deployment.

**Rationale:** Core Loop §4.3 removes separate BR and Relic loadout slots.

**Evidence:**
- `src/screens/BoundRequisitionScreen.tsx` — `confirmBoundRequisition` — BR slot
- `src/components/hub/KeepsakeLoadoutPanel.tsx` — `equippedKeepsakeId` — Relic slot
- `src/types/game.ts` — `boundRequisition / keepsakeRuntime` — Parallel run fields

**Shutdown/merge plan:** Collapse to one equip UI after donor merge.

**Migration:** Choose surviving equipped ID when both present.

**Risk:** medium · **Stage:** IV

### sanctuary

#### sanctuary.attuneAndGraft — `MIGRATE`

**Component:** ATTUNE heal + GRAFT mutate flow, Residue costs

**Current behavior:** RestScreen binary SanctuaryChoice ATTUNE|GRAFT. applySanctuaryAttune heals 30% max SA. Graft rolls 3 offers, rank-filters, charges sessionVeilResidueCollected. No MEND. Equipped-action filtering via canGraftClassAbility / Aegis surface.

**Target responsibility:** Mend=substantial heal; Attune=choose one of three grafts without Residue; grafts run-scoped.

**Rationale:** Core Loop §10.1–10.2 locked Mend/Attune flow; §4.3 removes persistent Residue costs for run-scoped grafts.

**Evidence:**
- `src/screens/RestScreen.tsx` — `SanctuaryChoice / ATTUNE / GRAFT` — Current UI binary
- `src/context/RunContext.tsx` — `applySanctuaryAttune / applyClassGraftToAbility` — Heal and graft commits
- `src/data/classGraftEngine.ts` — `rollClassGraftOffers` — Offer roll
- `src/data/graftSynergy/permanentGraftLoadoutEngine.ts` — `validateSanctuaryGraftApplication` — Residue + capacity validation

**Shutdown/merge plan:** Split ATTUNE heal→Mend; redefine Attune as graft choice; remove Residue charge for Sanctuary grafts; retarget SURVIVALIST/cargo heal hooks to Mend.

**Migration:** Clear abilityGrafts on extract/death/abandon (already run-scoped); stop charging Residue.

**Risk:** high · **Stage:** II-B

**Unresolved:**
- Does Veil Residue remain for non-graft uses after Sanctuary decoupling?

#### sanctuary.forceNextSanctuary — `DISABLE`

**Component:** Narrative forceNextSanctuary write without consumer

**Current behavior:** narrativeEncounterMatrix can set forceNextSanctuary on IncursionProgressState; never read by node generation.

**Target responsibility:** Either consume in procedural schedule or remove writer.

**Rationale:** Dead write misleads future Sanctuary guarantee work.

**Evidence:**
- `src/data/narrativeEncounterMatrix.ts` — `forceNextSanctuary` — Writer
- `src/types/game.ts` — `IncursionProgressState.forceNextSanctuary` — Typed field; no readers found

**Shutdown/merge plan:** Disable writer until consumer exists, or wire into schedule.

**Migration:** None.

**Risk:** low · **Stage:** II-B

#### sanctuary.generationAndTwisted — `KEEP`

**Component:** Normal Sanctuary generation and twisted variants

**Current behavior:** rollSanctuarySchedule always places local 14 + extras; sectorGraph injects SANCTUARY nodes. Twisted CORRUPTED_SANCTUARY (D2) and NO_EXIT_SANCTUARY (D3) lock ATTUNE+GRAFT until choice resolves. No ALTERED_SANCTUARY id.

**Target responsibility:** Guarantee ≥1 reachable normal Sanctuary per depth; keep twisted as exceptional content.

**Rationale:** Core Loop §10.2 keeps Sanctuary presence; twisted variants remain valid fiction.

**Evidence:**
- `src/data/sanctuaryScheduleEngine.ts` — `rollSanctuarySchedule` — Schedule authority
- `src/data/sectorGraphEngine.ts` — `createSanctuaryNode` — Node inject
- `src/data/twistedTemplateCatalog.ts` — `CORRUPTED_SANCTUARY / NO_EXIT_SANCTUARY` — Twisted variants

**Shutdown/merge plan:** Add per-depth guarantee if missing; leave twisted UI.

**Migration:** None.

**Risk:** low · **Stage:** II-B

**Unresolved:**
- Does schedule already guarantee one per depth in all procedural paths?

### legacyCombatTrinkets

#### trinket.definitions — `REMOVE`

**Component:** Catalog definitions (TRINKET_POOL / POST_COMBAT_BOON_POOL)

**Current behavior:** Six mid-run combat Trinket defs in TRINKET_POOL and five POST_COMBAT_BOON_POOL variants grant parry/slice/abyssal/HP/stamina bonuses. Distinct from Expedition Relics (KeepsakeId) and Run Items.

**Target responsibility:** None — Core Loop §4.3 removes legacy mid-run combat trinkets without converting them into boons.

**Rationale:** Superseded catalogs with no live product ownership; post-combat pool is unused.

**Evidence:**
- `src/data/regions.ts` — `TRINKET_POOL` — Defines mid-run combat trinket catalog
- `src/data/regions.ts` — `POST_COMBAT_BOON_POOL` — Legacy post-combat trinket variants (not class boons)
- `src/types/run.ts` — `Trinket` — Session combat-trinket type
- `docs/current-game-systems-design.md` — `Expedition Relics vs combat trinkets` — GDD distinguishes systems

**Shutdown/merge plan:** Delete pools and Trinket interface after grant/runtime callers removed; do not touch keepsake/run-item registries.

**Migration:** None for PlayerAccount; activeTrinkets is session RunState only.

**Risk:** low · **Stage:** II-A (trinket removal)

**Unresolved:**
- Should CRITICAL_SUCCESS skill-check rewards migrate to Run Items/cargo instead of pure deletion?

#### trinket.grants — `DISABLE`

**Component:** Grant and acquisition paths

**Current behavior:** applyTrinket exists but no screen calls it. Skill-check CRITICAL_SUCCESS appends one TRINKET_POOL entry via applySkillCheckTier. pickRandomPostCombatBoons has zero call sites. Live PostCombatBoonScreen awards class boons, not Trinket. startSkillCheck has no call sites found.

**Target responsibility:** All grant paths unreachable; no replacement mid-run combat-trinket grants.

**Rationale:** Core Loop requires every reward-pool route that can still grant combat trinkets disabled before deletion.

**Evidence:**
- `src/context/RunContext.tsx` — `applyTrinket` — Exported grant API with no screen callers
- `src/context/RunContext.tsx` — `applySkillCheckTier` — CRITICAL_SUCCESS rolls pickRandomTrinkets
- `src/data/regions.ts` — `pickRandomPostCombatBoons` — Defined; zero call sites
- `src/screens/PostCombatBoonScreen.tsx` — `preparePostCombatMutations consumers` — Class/ley boons only

**Shutdown/merge plan:** Feature-flag or delete skill-check trinket roll; delete applyTrinket export; leave class-boon post-combat intact.

**Migration:** None.

**Risk:** medium · **Stage:** II-A

**Unresolved:**
- Is SkillCheckScreen reachable via any navigator not found by symbol search?

#### trinket.runtime — `REMOVE`

**Component:** Runtime modifiers and combat hooks

**Current behavior:** aggregateModifiers sums parry/slice/abyssal into RunState. CombatScreen passes startingAbyssalReservePercent/parryWindowBonus/sliceDamagePenalty into TacticalCombatHub. parryMultiplierBonus prop is unused in hub body.

**Target responsibility:** Zero combat influence from activeTrinkets.

**Rationale:** Runtime path only populated by near-dead grants; must have no live influence.

**Evidence:**
- `src/context/RunContext.tsx` — `aggregateModifiers` — Sums trinket combat bonuses
- `src/screens/CombatScreen.tsx` — `parryWindowBonus / startingAbyssalReservePercent` — Passes aggregated mods into hub
- `src/components/TacticalCombatHub.tsx` — `parryWindowBonus` — Consumes window bonus; multiplier unused

**Shutdown/merge plan:** Remove aggregation; keep hub props only if another non-trinket source needs them.

**Migration:** None.

**Risk:** low · **Stage:** II-A

**Unresolved:**
- Is parryMultiplierBonus awaiting a non-trinket source?

#### trinket.saveUiDebrief — `REMOVE`

**Component:** Save fields, UI, debrief, telemetry

**Current behavior:** activeTrinkets on session RunState only. Hub equipment.trinketId always null. RunCompleteScreen shows TRINKETS count. No OperationDebrief keepsake-style reporting. Telemetry tracks keepsake/runItem triggers, not combat trinkets. trinketBalanceConfig validates expedition relic soft-caps (naming collision).

**Target responsibility:** No presentation or persistence of mid-run combat trinkets.

**Rationale:** Presentation of a retired system; rename relic balance config separately.

**Evidence:**
- `src/types/run.ts` — `RunState.activeTrinkets` — Session field
- `src/types/game.ts` — `equipment.trinketId` — Unused hub placeholder
- `src/screens/RunCompleteScreen.tsx` — `activeTrinkets.length` — Only UI count
- `src/data/balance/trinketBalanceConfig.ts` — `formatTrinketBalanceConfigSummary` — Relic soft-caps, not combat trinkets

**Shutdown/merge plan:** Drop activeTrinkets and trinketId; rename trinketBalanceConfig later; leave keepsake debrief alone.

**Migration:** Ignore/strip trinketId on load if present.

**Risk:** low · **Stage:** II-A

### weaponTier

#### weapon.familyOwnership — `KEEP`

**Component:** Horizontal weapon-family unlock and equip

**Current behavior:** Nine families, three per class; weaponUnlocks, equippedWeaponByClass, WEAPON_REGISTRY identity/WA kits. Unlock spend is permanent horizontal access.

**Target responsibility:** Preserve family ownership and kit identity; no vertical combat power.

**Rationale:** Core Loop §4.1 keeps nine families; §4.2 converts progression to horizontal unlocks only.

**Evidence:**
- `src/data/weaponRegistry.ts` — `WEAPON_REGISTRY` — Family definitions
- `src/context/PlayerAccountContext.tsx` — `weaponUnlocks / equippedWeaponByClass` — Account ownership
- `src/types/weapon.ts` — `WeaponFamilyId` — Horizontal identity key

**Shutdown/merge plan:** N/A — retain while stripping tiers.

**Migration:** None.

**Risk:** low · **Stage:** III (after trinkets)

#### weapon.tier.definitionsAndRuntime — `MIGRATE`

**Component:** Vertical Tier I–III combat-stat ladder and T3 once-per-combat passives

**Current behavior:** Every family has tiers [1,2,3] with escalating statModifiers and often T3 oncePerCombatPassive. resolveWeaponState(family,tier) feeds combat damage/cost/resource/pierce. Descent snapshots activeWeaponTier.

**Target responsibility:** Single power row per family (baseline stats); retire vertical ladder and tier-only passives.

**Rationale:** Core Loop §4.3 disables permanent Tier I→III combat-stat growth and Tier III combat passives.

**Evidence:**
- `src/types/weapon.ts` — `WeaponTierDefinition / WeaponOncePerCombatPassiveId` — Tier model
- `src/data/weaponProgressionEngine.ts` — `resolveWeaponState` — Selects tier row
- `src/data/weaponCombatEngine.ts` — `runWeaponOn*Hooks` — Consumes tier passives
- `src/types/game.ts` — `ActiveIncursionState.activeWeaponTier` — Run snapshot

**Shutdown/merge plan:** Flatten registry to one combat row; always resolveWeaponState(id,1) or equivalent; decide which T3 fantasies become permanent family traits.

**Migration:** Clamp saved weaponTiers[*]→1 or delete map; activeWeaponTier always 1.

**Risk:** high · **Stage:** III

**Unresolved:**
- Baseline = T1 stats, or fold selected T3 fantasies into family identity?

#### weapon.tier.economy — `REMOVE`

**Component:** Tier upgrade economy, UI, debrief, debug

**Current behavior:** canUpgradeWeaponTier/upgradeWeaponTier spend stash; ChassisWorkspace/WeaponLoadoutPanel upgrade UI; debrief UPGRADE_AVAILABLE; god mode unlockAllWeapons sets tiers to 3.

**Target responsibility:** No vertical upgrade spend; keep family unlock spend.

**Rationale:** Vertical economy is the treadmill Core Loop removes.

**Evidence:**
- `src/data/weaponProgressionEngine.ts` — `upgradeWeaponTier` — Spend path
- `src/components/hub/loadout/ChassisWorkspace.tsx` — `upgrade UI` — Player-facing tier upgrade
- `src/data/devGodModeEngine.ts` — `unlockAllWeapons` — Forces tier 3

**Shutdown/merge plan:** Remove upgrade buttons/costs/debrief lines; keep unlock+equip.

**Migration:** Normalize weaponTiers away; compensation policy for prior spends UNKNOWN.

**Risk:** medium · **Stage:** III

**Unresolved:**
- Refund stash for prior tier upgrades?

### Donor dispositions (Bound Requisitions × Expedition Relics)

Not a final merged roster. Likely retained technical base: Expedition Relic / keepsake runtime.

| Kind | ID | Disposition | Rationale |
|---|---|---|---|
| boundRequisition | `ADRENALINE_PRIMER` | retain_as_expedition_requisition | Limited combat prep, once-per-run |
| boundRequisition | `APEX_BAIT` | move_to_corrupted_bargain | Elite loot ×2 + resonance |
| boundRequisition | `BLOOD_PRICE` | move_to_corrupted_bargain | Curated Ley-Scar + HP cost |
| boundRequisition | `BRIBE_THE_FERRYMAN` | move_to_contract_clause | Evac + elite pressure bargain |
| boundRequisition | `CHALK_LINE_WARD` | retain_as_expedition_requisition | Route safety / resonance |
| boundRequisition | `DEAD_DROP_TRACKER` | remove_as_duplicate | Overlaps dead_drop_receiver |
| boundRequisition | `ENDLESS_MARCH` | move_to_contract_clause | Legion mandate; blocked evac + combat ramp |
| boundRequisition | `HAZARD_PAY` | retain_as_expedition_requisition | Starting credits prep |
| boundRequisition | `HOLLOW_POINT_REQUISITION` | move_to_authority | Combat doctrine bonus |
| boundRequisition | `IRONCLAD_LOGISTICS` | move_to_authority | Cabal mandate; blocks Ley-Scars |
| boundRequisition | `KINETIC_BATTERY` | move_to_authority | Recurring combat engine — forbidden on Requisitions |
| boundRequisition | `MARTYRS_BARGAIN` | move_to_corrupted_bargain | Death cargo keep + HP cost |
| boundRequisition | `REINFORCED_TRENCH_COAT` | defer_pending_design | Generic max-HP bonus conflicts with Requisition must-not list |
| boundRequisition | `SCAVENGERS_MARK` | remove_as_duplicate | Overlaps black_market_mark |
| boundRequisition | `SMUGGLERS_POCKETS` | remove_as_duplicate | Overlaps smugglers_wrap / cargo relics |
| boundRequisition | `STANDARD_ISSUE_COAGULANT` | retain_as_expedition_requisition | Run Item seed |
| boundRequisition | `SUNKEN_RITE` | move_to_contract_clause | Sponsor mandate + scars |
| boundRequisition | `VOID_TOUCHED_ARTIFACT` | move_to_corrupted_bargain | Locked slots + blueprint risk |
| boundRequisition | `WIRETAP_OVERRIDE` | defer_pending_design | Scanner intel; overlap with signal_compass |
| expeditionRelic | `anchor_charm` | retain_as_expedition_requisition | Anchor/ops trail |
| expeditionRelic | `ashen_cartograph` | retain_as_expedition_requisition | Route doctrine |
| expeditionRelic | `bent_nail` | defer_pending_design | Outside cargo hook |
| expeditionRelic | `black_market_mark` | retain_as_expedition_requisition | Market prep |
| expeditionRelic | `bloodhound_tag` | retain_as_expedition_requisition | Tagged quarry |
| expeditionRelic | `cargo_seal` | retain_as_expedition_requisition | Cargo risk control |
| expeditionRelic | `contract_seal` | move_to_contract_clause | Contract-specific |
| expeditionRelic | `dead_drop_receiver` | retain_as_expedition_requisition | Absorbs BR tracker fantasy |
| expeditionRelic | `extraction_token` | retain_as_expedition_requisition | Extraction prep |
| expeditionRelic | `false_evac_beacon` | move_to_corrupted_bargain | Decoy/lure extraction |
| expeditionRelic | `grave_polaroid` | retain_as_expedition_requisition | Imprint on echo/anomaly |
| expeditionRelic | `gutter_crown` | retain_as_expedition_requisition | Sanctuary/safehouse service |
| expeditionRelic | `hollow_keyring` | defer_pending_design | Occult locks + noise |
| expeditionRelic | `last_light_matchbook` | move_to_corrupted_bargain | Skip safe extract |
| expeditionRelic | `ley_siphon_needle` | defer_pending_design | Bargain-flavored cargo risk |
| expeditionRelic | `mirror_writ` | move_to_contract_clause | Mirrored side objective |
| expeditionRelic | `mourners_bell` | retain_as_expedition_requisition | Echo bias |
| expeditionRelic | `null_ledger` | move_to_corrupted_bargain | Debt economy |
| expeditionRelic | `signal_compass` | retain_as_expedition_requisition | Scanner certainty |
| expeditionRelic | `smugglers_wrap` | retain_as_expedition_requisition | Contraband prep |

## 6. Cross-system dependency map

### conflict.eliteBoonVsSuppression

Elite post-combat is the only live random class-boon source, while Aftermath ELITE_SUPPRESSION / reduced eliteWeight fire after successful elite/boss clears — a positive condition that can reduce build growth. eliteWeight<1 also fails to lower spawn weights today.

- Systems: `boon.eliteOnlyGrantPath`, `aftermath.eliteSuppression`
- Severity: high
- Hint: Diversify boon sources before or while simplifying Aftermath; ensure suppression cannot starve build power.

### conflict.dualAftermathNaming

Sector aftermath modifiers and operation-lifecycle AFTERMATH progress lock share the word Aftermath but different persistence and player meaning.

- Systems: `aftermath.stackingSectorModifiers`, `aftermath.operationLifecycle`
- Severity: medium
- Hint: Rename in product language when simplifying to one condition.

### conflict.trinketNamingCollision

trinketBalanceConfig and historical 'Trinkets v2' naming refer to Expedition Relics, not RunState.activeTrinkets combat trinkets.

- Systems: `trinket.saveUiDebrief`, `relic.keepsakeRuntimeBase`
- Severity: medium
- Hint: Rename balance config during Relic→Requisition merge; never disable relic soft-caps when removing combat trinkets.

### conflict.residueVsAttune

Sanctuary grafts currently charge persistent Residue; Core Loop Attune must not.

- Systems: `graft.residueEconomy`, `sanctuary.attuneAndGraft`
- Severity: high
- Hint: Disable Residue debit on Sanctuary grafts when introducing Mend/Attune.

## 7. Save and migration inventory

| Field | Location | Action | Risk |
|---|---|---|---|
| `RunState.activeTrinkets` | session only | drop | low |
| `PlayerAccount.equipment.trinketId` | account | strip/ignore | low |
| `PlayerAccount.weaponTiers` | account | clamp to 1 or delete after flatten | high |
| `ActiveIncursionState.activeWeaponTier` | run session | force 1 | medium |
| `progressionProfile.classes[*].rank/xp` | account | KEEP informational | low |
| `graft capacity derived from rank` | runtime | stop reading rank for capacity | medium |
| `sessionVeilResidueCollected graft debit` | run | disable for Sanctuary Attune | medium |
| `boundRequisition + craftedAugments` | run+account | migrate via explicit ID table into Requisition | high |
| `equippedKeepsakeId + keepsakeDeployment` | account | KEEP as Requisition base | medium |
| `sectorAftermathModifiersBySector` | world | collapse to one named condition | high |
| `temporarySectorModifiers / sectorOperationLifecycle` | world | simplify featured Operation | medium |
| `forceNextSanctuary` | run progress | DISABLE writer or wire consumer | low |
| `ActiveIncursion mid-run disk resume` | absent | DEFER unless MID_RUN_PERSISTENCE | low |

## 8. Candidate feature boundaries

Proposed only — **not implemented** in Stage I.

| Flag | Default | Purpose | Host |
|---|---|---|---|
| `LEGACY_COMBAT_TRINKETS_ENABLED` | False | Gate applyTrinket / skill-check trinket grants / aggregation | `src/data/featureFlags.ts` |
| `WEAPON_TIER_COMBAT_POWER_ENABLED` | False | Force resolveWeaponState tier=1; hide upgrade UI | `src/data/featureFlags.ts` |
| `CLASS_RANK_GRAFT_GATES_ENABLED` | False | Bypass getGraftSocketAccessForClassRank ladder | `src/data/featureFlags.ts` |
| `SANCTUARY_RESIDUE_GRAFT_COST_ENABLED` | False | Disable Residue debit on Sanctuary grafts | `src/data/featureFlags.ts` |
| `DUAL_REQUISITION_SLOTS_ENABLED` | False | Hide Bound Requisition slot once merge lands | `src/data/featureFlags.ts` |
| `ELITE_ONLY_BOON_OFFERS` | True | Preserve current elite gate until Contacts/Omen exist | `src/data/featureFlags.ts` |
| `ELITE_SUPPRESSION_AFFECTS_SPAWNS` | False | Control whether eliteWeight<1 lowers node weights | `src/data/featureFlags.ts` |
| `SECTOR_AFTERMATH_STACKING_ENABLED` | True | Allow temporary disable of multi-modifier aftermath | `src/data/featureFlags.ts` |
| `MID_RUN_PERSISTENCE` | False | Optional ActiveIncursion disk resume | `src/data/featureFlags.ts` |

## 9. Highest-risk shutdowns

- weapon.tier.definitionsAndRuntime — large combat/test blast radius
- boon.eliteOnlyGrantPath × aftermath.eliteSuppression — build-growth starvation risk
- requisition.boundCatalogRuntime merge — dual loadout + combat-engine donors
- sanctuary.attuneAndGraft + graft.residueEconomy — heal/graft/Residue rewiring

## 10. Unknowns and contradictions

- SkillCheckScreen reachability for trinket CRITICAL_SUCCESS path
- Weapon tier baseline choice (T1 vs folded T3 fantasy)
- Whether Veil Residue retains non-graft sinks after Sanctuary decoupling
- Authority Contact node type presence in live procedural generation
- Compensation policy for spent weapon tier upgrades
- Whether eliteWeight<1 non-application is intentional

See also cross-system conflicts in §6.

## 11. Stage I exit-gate assessment

- Complete: True
- deprecatedSystemsHaveGrantRuntimePersistPresentationPlans: True
- hiddenUiNotTreatedAsDisabledRuntime: True
- horizontalWeaponOwnershipSeparatedFromVerticalTier: True
- boundReqAndRelicOverlapsIndividuallyDocumented: True
- operationAftermathCoreLoopInteractionsVisible: True
- nextSliceExecutableWithoutRediscovery: True

**Gaps:**
- PDF masters not vendored in repo — audit cites Downloads paths + extracted /tmp copies
- Mid-run ActiveIncursion disk resume absent (documented DEFER)

## 12. Recommended next implementation slice

**legacy combat-trinket removal** — isolated=True

Grant paths nearly orphaned; no account persistence; distinct from keepsakes/run items; lowest blast radius among Core Loop removals.

**Likely files:**
- `src/data/regions.ts`
- `src/types/run.ts`
- `src/context/RunContext.tsx`
- `src/screens/RunCompleteScreen.tsx`
- `src/screens/CombatScreen.tsx`
- `src/components/TacticalCombatHub.tsx`
- `src/types/game.ts`
- `src/data/featureFlags.ts`

**Do not touch:**
- `src/data/balance/trinketBalanceConfig.ts`
- `src/data/expeditionKeepsakeRegistry.ts`
- `src/data/expeditionKeepsakeEngine.ts`
- `src/data/boundRequisitions.ts`
- `src/screens/PostCombatBoonScreen.tsx`

**Acceptance risks:**
- Skill-check CRITICAL_SUCCESS becomes empty if screen is revived without replacement reward
- Combat props (parryWindowBonus etc.) may still be set from non-trinket sources — verify defaults
- Naming collision with Expedition Relic 'trinket' balance config must not cause accidental disable

---

*End of Stage I-A audit. Do not begin Stage II from this document alone without the paired JSON.*
