# Game CX Players: Player 360, Payment Fraud and Toxicity (plan and requirements)

Status: PLANNING (no build yet). Owner: Mayur Gupta. Last updated: 2026-10-22.

Purpose: a reusable gaming customer demo that also serves as the FE Bar submission. Databricks asset names stay generic (no program-specific names) so the build can be reused with customers.

## 1. Business outcome (lead with this)

**Customer (fictional):** Emberline Studios, a multi-title live-service publisher with 6 titles (sample of 50K players representing a base of about 8M monthly active users).

**Problem:** three linked revenue leaks, owned by three teams that each see only part of the player.

| Leak | Owner | KPI hurt |
|---|---|---|
| Payment fraud: fraud rings buy currency with stolen cards and resell it | Payments / Finance | Chargeback rate, chargeback losses and fees, standing with card-network dispute monitoring programs |
| Toxicity: about 4% of players drive abuse; the players they target churn about 2x | Trust & Safety | Victim churn, report backlog, time to action |
| No Player 360: payments, sessions, chat and moderation are siloed | Player Experience / LiveOps | Retention of high-value players, LTV |

**Outcome:** one governed Player 360 that scores every player and transaction for fraud risk, churn risk and toxicity, and puts a moderator and fraud-analyst console on top of it, with actions written back.

**Buyer personas (also the role-play personas)**
* Executive sponsor: VP Player Experience / Head of Trust & Safety (cares about retention, revenue protected, brand safety).
* Domain owner: Fraud and Payments lead, Trust & Safety operations manager.
* Technical stakeholder: Director of Data Platform (cares about architecture, governance, cost, latency, integration).

## 2. Decisions so far

| Topic | Decision |
|---|---|
| Use case | Player 360 metrics + payment fraud detection + toxicity |
| Branding | Fictional studio Emberline Studios; fictional titles: Iron Vanguard (battle royale shooter), Starfall Legends (hero shooter), Realm of Ash (MMORPG), Hollow Crown (action RPG), Gem Tide (match-3, mobile), Pocket Racers (kart racing, mobile) |
| Catalog / schema | `mg_aws_serverless_workspace_catalog.game_cx_players` (underscores, no backticks needed) |
| Approach | Built from scratch: no code, data, naming or assets reused from earlier demos |
| Data window | 24 months, 2025-01-01 to 2026-12-31 (two full calendar years), with a simulated as-of date of 2026-12-31. All relative logic uses `as_of_date`, never `current_date()` |
| Data generation | Hybrid: dbldatagen for independent-attribute tables (players, devices, games, live-ops calendar, latent player traits); PySpark for behaviour and time-dependent tables (sessions, transactions, chargebacks, chat, reports) |
| Scale | 50K players, about 7M sessions, about 1M transactions, about 2M chat messages (estimate) |
| Model | Star schema (facts + dimensions) |
| Raw landing | UC volumes inside the schema: `raw` (source files) and `ground_truth` (evaluation labels only, restricted) |
| Table prefix | None (the schema is dedicated to this project, so table names carry the medallion layer instead) |
| Repo | https://github.com/knwldg-hub/dbx-game-cx-febar (name kept). Workspace Git folder `/Users/mayur.gupta@databricks.com/dbx-game-cx-febar` |
| Language | PySpark for data generation (>1M rows), SQL for pipeline transformations |

## 3. End-to-end data journey (integrated, one flow)

```
Source systems (synthetic daily files)
  -> UC volume raw/<source>/<entity>/                       [Unity Catalog: volume]
  -> Lakeflow SDP: Auto Loader bronze -> silver -> gold star schema   [Lakeflow]
  -> Unity Catalog: comments, tags, PII masks, lineage, metric view   [govern]
  -> ML: fraud model, churn model (MLflow, UC registry) + GenAI toxicity (ai_query)  [intelligent]
  -> gold_player_360 + ml_* scores -> serve_player_risk_profile synced to Lakebase   [operational serving]
  -> Genie space over gold star schema + scores + metric view   [natural language]
  -> Databricks App: Trust & Safety console reads Lakebase, writes moderation actions back   [business surface]
  -> Moderation actions flow back to the lakehouse (closed loop)
```

## 4. Raw data design

**Layout:** `/Volumes/mg_aws_serverless_workspace_catalog/game_cx_players/raw/<source_system>/<entity>/<source_system>_<entity>_<yyyymmdd>.<ext>`

| Source system | Entity | Format | Delivery |
|---|---|---|---|
| account | players | CSV | Snapshot as of AS_OF (contains PII: gamertag, email, date of birth) |
| catalog | games, live_ops_events | JSON | Snapshot |
| telemetry | devices | CSV | Snapshot |
| telemetry | sessions | JSON | Daily files |
| commerce | transactions | JSON | Daily files |
| payments | chargebacks | CSV | Daily files, late-arriving (15-75 days after purchase) |
| chat | chat_messages | JSON | Daily files |
| safety | player_reports | JSON | Daily files |
| ground_truth (separate volume) | players, transactions, chat_labels | Parquet | Evaluation only, never used as features |

**Realistic patterns built in**
* Free-to-play spend mix: 2% whales, 8% dolphins, 20% minnows, 70% non-payers.
* Seasonality: evening peak, weekend uplift, Black Friday / holiday purchase spike, summer uplift, back-to-school dip.
* Year-over-year title trends: Starfall Legends and Pocket Racers growing, Realm of Ash declining, launch cohorts front-loaded after each title's launch.
* Churn: engagement decays over the 30 days before a player leaves; driven by toxicity exposure, poor matchmaking and being new; whales churn least.
* Fraud rings: about 75 rings of about 8 new accounts sharing device fingerprints, emulators, VPN country mismatch, bursts of $50-$100 currency packs; about 65% charge back.
* Friendly fraud: under-18 players dispute charges at about 8x the base rate (label noise).
* Toxicity: harassment, hate speech (redacted as [slur]), threats, scam spam from fraudsters; leetspeak obfuscation; banter that looks toxic to keyword filters.
* Cheaters: about 1.5% of shooter players with impossible accuracy and headshot rates.
* LiveOps: ranked seasons and esports raise activity and toxicity; skin drops and sales raise purchases.

**Validation the generator must print (execution evidence):** monthly MAU and revenue trend, churn by toxicity exposure, chargeback lift by risk factor, revenue concentration, cheater separation, toxicity by event type, keyword-filter false positives.

## 5. Star schema (gold)

| Table | Grain | Key columns |
|---|---|---|
| gold_dim_player | 1 row per player | player_id, gamertag, email (masked), date_of_birth (masked), age_band, country, region, registration_date, acquisition_channel, signup_game_id |
| gold_dim_game | 1 row per title | game_id, title, genre, platforms, monetization_model, launch_date |
| gold_dim_device | 1 row per device | device_id, player_id, device_type, platform, device_fingerprint, is_emulator, is_rooted_or_jailbroken |
| gold_dim_date | 1 row per day | date_key (yyyymmdd), date, week, month, quarter, year, is_weekend, is_holiday_season |
| gold_dim_geography | 1 row per country | country, region, currency |
| gold_dim_live_ops_event | 1 row per event | event_id, game_id, event_name, event_type, start_date, end_date, discount_pct |
| gold_fact_game_session | 1 row per session | session_id, player_id, game_id, device_id, date_key, duration_min, matches, kills, deaths, accuracy_pct, headshot_pct, ping_ms, matchmaking_quality, ip_country, live_ops_event_id |
| gold_fact_transaction | 1 row per purchase | txn_id, player_id, game_id, device_id, session_id, date_key, item_type, amount_usd, payment_method, billing_country, store, has_chargeback |
| gold_fact_chargeback | 1 row per dispute | chargeback_id, txn_id, date_key, reason_code, disputed_amount_usd, fee_usd |
| gold_fact_chat_message | 1 row per message | message_id, session_id, sender_player_id, recipient_player_id, game_id, date_key, channel, message_text |
| gold_fact_player_report | 1 row per report | report_id, reporter_player_id, reported_player_id, game_id, message_id, date_key, report_category |
| gold_fact_moderation_action | 1 row per action taken in the app | action_id, player_id, action_type (warn, mute, suspend, ban, block_payment, clear), reason, moderator, action_ts (real), effective_date (simulated), source_score |
| gold_player_360 | 1 row per player | lifetime spend, last_active_date, sessions_30d, engagement trend, is_high_value_player, churn_risk, fraud_risk_score, toxicity_score, reports_received, toxic_messages_received |

Business definitions (from your standards): **high-value player** = lifetime spend > $50 AND last active within 14 days; **at-risk** = churn_risk = 1; **live-ops event** = in-game time-limited campaign or promotion.

## 6. Naming convention

* Tables: `bronze_<source>_<entity>`, `silver_<entity>`, `gold_dim_<entity>`, `gold_fact_<entity>`, `gold_<mart>`, `ml_feat_<subject>`, `ml_<model>_scores`, `mv_<subject>` (metric views), `serve_<entity>` (Lakebase synced).
* Columns: `<entity>_id`, `date_key`, `is_`/`has_` booleans, `_usd`, `_ts`, `_date`.
* Other assets: `game-cx-players-pipeline`, `game-cx-players-daily-job`, `game-cx-players-lakebase`, `game-cx-players-console`, MLflow experiments `game-cx-players-<model>`; UC models `fraud_txn_classifier`, `churn_player_classifier`.
* Notebooks: `NN_<verb>_<subject>`.

## 7. Intelligence (ML + GenAI)

| Capability | Approach | Evaluation |
|---|---|---|
| Transaction fraud | Gradient-boosted classifier on transaction + device + account features (account age, billing vs IP country, emulator, shared fingerprint count, purchase velocity). Train only on transactions older than 75 days (mature chargeback labels); time-based split | PR-AUC, precision at a fixed review capacity, dollars of chargebacks caught |
| Fraud rings | Shared device fingerprint graph (accounts per fingerprint) as a feature and a ring view in the app | Ring recall vs ground truth |
| Churn | Classifier on 30-day engagement trend, toxicity received, matchmaking quality, spend; produces churn_risk | AUC, lift in top decile |
| Toxicity | `ai_query` with a foundation model (structured output: category, severity, rationale) on reported messages plus a sample; compared with a keyword baseline | Precision / recall vs ground_truth chat labels, keyword false-positive rate |
| Cheating | Rule-based behavioural flags (accuracy, headshot rate, kills per match) | Precision vs ground truth |

All training tracked in MLflow; models registered in Unity Catalog; batch scores written to `ml_*_scores`.

## 8. Lakebase (operational serving)

* `serve_player_risk_profile`: synced table from gold_player_360 + scores (sub-second lookups for the app).
* `moderation_actions` (native Postgres table): actions taken in the app (warn, mute, suspend, refund-block, clear), synced back to the lakehouse for analytics and retraining.

## 9. Genie space

New space "Emberline - Player 360, Fraud & Toxicity" over the gold star schema, scores and metric view, with instructions for business definitions, join paths, sample questions and benchmark questions.

## 10. Databricks App

`game-cx-players-console`: risk queue (high fraud / toxicity / churn), Player 360 profile page, fraud-ring view, message evidence with LLM rationale, action buttons written to Lakebase, embedded Genie for ad-hoc questions.

## 11. Governance (Unity Catalog)

Table and column comments; governed tags (pii, domain, layer); column masks on email and date_of_birth for non-privileged groups; restricted `ground_truth` volume; lineage from volume to app; metric view `mv_player_trust_safety`.

## 12. Orchestration and evidence

* Job `game-cx-players-daily-job`: pipeline refresh -> scoring -> Lakebase sync.
* Evidence for the FE Bar evaluator (text only): notebooks committed as .ipynb with outputs (requires the admin setting "Allow repos to export IPYNB output" and a `.databricks/commit_outputs` file), plus exported run logs and query results as markdown under `evidence/`.

## 13. Repo layout (target)

```
README.md                 outcome first, architecture, value, decisions and trade-offs, AI usage
docs/PLAN.md              this file
docs/deck.md              business presentation (exported to PDF)
docs/roleplay_prep.md     tell-show-tell script, objection handling
notebooks/01_generate_raw_data
pipelines/transformations/{bronze,silver,gold}/*.sql
notebooks/02_train_fraud_model, 03_train_churn_model, 04_classify_toxicity, 05_publish_lakebase
app/                      Databricks App source
genie/                    space instructions and benchmark questions
evidence/                 run outputs as text
```

## 14. Value model (draft, to be refined with the generated data)

Assumptions to confirm: about 8M MAU, about $600M annual bookings, 0.8% chargeback rate, $15 fee per chargeback, about 15% of players exposed to toxicity, $25 annual revenue per active player.

| Lever | Estimate |
|---|---|
| Fraud: block or review 50% of fraudulent purchases | about $2.5-3M a year in losses and fees avoided, and a lower dispute ratio |
| Toxicity: 30% less exposure, lower victim churn | about $1.8M a year in retained revenue |
| Moderation: auto-triage 60% of reports | about $0.5M a year in analyst time |
| **Total** | **about $5M a year** (estimate) |

## 15. Decisions and trade-offs (to expand in README)

* Synthetic data with built-in signal vs public datasets: needed to join fraud, chat and telemetry for the same players.
* Hybrid generation (dbldatagen + PySpark) vs a single tool: dbldatagen keeps independent-attribute tables short and declarative; it only keeps keys consistent across tables, so behaviour that spans tables (churn decay, toxicity-driven churn, shared ring devices, delayed chargebacks, live-ops effects) stays in PySpark.
* Simulated as-of date (2026-12-31) vs real dates: two full calendar years give clean year-over-year comparisons; the cost is that every relative-date calculation must use `as_of_date` instead of `current_date()`.
* Materialized views vs streaming tables per layer: streaming bronze for incremental files, materialized views for gold.
* Mature-label training window for fraud vs using all data.
* LLM classification vs keyword rules vs fine-tuned classifier (cost, latency, accuracy); LLM run on reported and sampled messages only to control cost.
* Lakebase vs querying the SQL warehouse from the app (latency, concurrency, write-back).

## 16. Open questions (to settle before the build)

Status: all planning questions decided. Remaining build-time check: exact fast-tier Claude endpoint names, dbldatagen install on serverless.

| # | Question | Status | Decision / recommendation |
|---|---|---|---|
| 1 | Value model inputs and KPIs | DECIDED (accepted) | KPI set in section 16a; studio inputs 8M MAU, $600M bookings, $25 annual revenue per active player, $25/hour moderator cost |
| 2 | Role-play personas | DECIDED (accepted) | Business: Priya Raman, VP Player Experience & Trust (executive sponsor). Technical: Marcus Chen, Director of Data Platform. Domain owner referenced in the deck: Head of Payments Risk |
| 3 | Lakebase type | DECIDED: autoscaling | Verified available: the workspace already has Lakebase autoscaling projects (Postgres 17). New project: `game-cx-players-lakebase` |
| 4 | LLM for toxicity | DECIDED (accepted); verify fast-tier Claude endpoint names at build time | Claude via Databricks-hosted foundation model endpoints with `ai_query` and structured output. Fast, low-cost Claude tier for bulk classification; Claude Opus (`databricks-claude-opus-4-7`, confirmed present) only for evaluating a small labelled sample. Benchmark cost against a low-cost GPT-6 Luna endpoint. Scope: reported messages plus a sample |
| 5 | App stack | DECIDED: AppKit | React + TypeScript (AppKit) app `game-cx-players-console` (name limit 26 chars) using built-in plugins: Lakebase (risk queue, moderation write-back), analytics (metric view KPIs via SQL warehouse), Genie chat, model serving if needed. Why: everything stays programmatic (code, typed SQL, bundle-deployed) and the app is backed by Lakebase for low-latency reads and transactional write-back. Fallback: Streamlit |
| 6 | AI/BI dashboard | DECIDED: yes | A metric view on the gold layer is the semantic layer; the dashboard, Genie space, app KPIs and agents all read from it |
| 7 | Bundles | DECIDED: yes | Pipeline, job and app deployed with Declarative Automation Bundles from the repo |
| 8 | Commit notebook outputs | DECIDED: allowed | The user already commits .ipynb outputs in another project in this workspace. Add `.databricks/commit_outputs` to the repo; keep text logs in `evidence/` as a backup |
| 9 | Scale | DECIDED: 50K players | Gives about 600 fraudsters (about 75 rings), about 2,000 toxic players and about 750 cheaters: enough signal; scaled up in the value model |
| 10 | Chat language | DECIDED: English only | |
| 11 | Data window | DECIDED: option (b) | 2025-01-01 to 2026-12-31, simulated as-of date 2026-12-31. Mitigations: (1) `as_of_date` reference plus an is-current flag in `gold_dim_date`, used everywhere instead of `current_date()`, and a Genie instruction plus benchmark to enforce it; (2) moderation actions store the real `action_ts` and the simulated `effective_date`; (3) README, deck and app header state the simulated as-of date; (4) hold back the last few days of files to demo incremental Auto Loader ingestion; (5) fraud model trains only on purchases older than 75 days; (6) lifetime metrics labelled "since Jan 2025" |
| 12 | Data generation tool | DECIDED: hybrid | dbldatagen for independent attributes, PySpark for cross-table behaviour. Verify the dbldatagen install on serverless first (latest release v0.4.0-Hotfix1-WheelBuild, May 2025, includes serverless fixes; Labs project, provided as-is) |
| 13 | Table count | Planned | 6 dimensions + 6 facts (adds `gold_fact_moderation_action` from the Lakebase write-back) + `gold_player_360`. No daily summary tables: the metric view serves aggregates |

### 16a. Recommended KPI set (beyond MAU, bookings, ARPU, moderator cost)

| Area | KPI | Audience |
|---|---|---|
| Fraud | Chargeback rate (% of transactions and % of $), fraud loss $ (amount plus fees), $ fraud caught at a fixed review capacity, false-positive rate / legitimate revenue blocked, time to detect a fraud ring | CFO, Head of Payments Risk |
| Toxicity | Toxic messages per 1K messages, % of players exposed to toxicity, churn uplift of exposed vs unexposed players, time to action, % of reports auto-triaged, report backlog, moderator cost per report, repeat-offender rate | VP Player Experience & Trust, T&S operations |
| Player 360 | DAU, MAU, DAU/MAU stickiness, D7/D30 retention, payer conversion, ARPDAU, ARPPU, number of high-value players, revenue at risk from at-risk high-value players, LTV | Executive sponsor, LiveOps |
| LiveOps | Event revenue uplift vs baseline, toxicity during events vs baseline, event participation | LiveOps lead |
| Cheating | Cheat reports per 1K matches, confirmed cheaters actioned | Game integrity |

## 17. Build sequence (starting tomorrow)

1. Data generator + validation (notebook 01).
2. Lakeflow pipeline (bronze, silver, gold star schema).
3. Governance (comments, tags, masks, metric view).
4. ML fraud + churn, GenAI toxicity.
5. Lakebase serving + write-back.
6. Genie space.
7. Databricks App.
8. Job, evidence export, README, deck, role-play prep, commit.
9. End-to-end verification.
