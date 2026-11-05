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
| game_svc | games, live_ops_events | JSON | Snapshot |
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
| gold_fact_session | 1 row per session | session_id, player_id, game_id, device_id, date_key, duration_min, matches, kills, deaths, accuracy_pct, headshot_pct, ping_ms, matchmaking_quality, ip_country, live_ops_event_id |
| gold_fact_event | 1 row per account-level event | event_id, event_type (PURCHASE/REPORT/ACTION), player_id, game_id, device_id, date_key, amount_usd, payment_method, billing_country, has_chargeback, chargeback_date, chargeback_reason, chargeback_amount_usd, chargeback_fee_usd, report_category, reported_player_id, action_type, moderator |
| gold_mart_player_360 | 1 row per player | player_id, lifetime_spend_usd, last_active_date, sessions_30d, engagement_trend, is_high_value_player, is_at_risk, churn_risk_score, fraud_risk_score, toxicity_score, reports_received, toxic_messages_received, recommended_action |

Business definitions (from your standards): **high-value player** = lifetime spend > $50 AND last active within 14 days; **at-risk** = churn_risk = 1; **live-ops event** = in-game time-limited campaign or promotion.

## 6. Security — no hardcoded secrets (mandatory, non-negotiable)

> **Rule: no secret, password, token, webhook URL, API key or credential of any kind may appear in code, config files, notebooks, or any file committed to Git. No exceptions.**

### What counts as a secret
* Slack webhook URLs
* AI Gateway tokens or API keys
* Lakebase / Postgres connection strings and passwords
* Any OAuth client secret
* Personal access tokens (PATs)
* Email SMTP credentials
* Any value that grants access to a system

### How secrets are handled in this project
| Credential | Storage | How code reads it |
|---|---|---|
| Slack webhook URL | Databricks Secrets: scope `game-cx-players`, key `slack-webhook-url` | `dbutils.secrets.get("game-cx-players", "slack-webhook-url")` |
| Any external API key | Same scope, distinct key | Same pattern |
| Lakebase connection password | Databricks Secrets or Lakebase OAuth (preferred) | Never a raw password in code |
| DAB bundle variable references | `{{secrets/game-cx-players/slack-webhook-url}}` in YAML | Resolved at deploy time, never stored in the file |

### Git hygiene
* `.gitignore` includes: `.env`, `*.env`, `secrets.json`, `*.pem`, `*.key`, `*.p12`, `local_config.py`
* Notebooks: no `spark.conf.set("key", "hardcoded-value")`, no `os.environ["KEY"] = "value"` with a real value
* If a secret is accidentally committed: rotate it immediately, then remove it from history with `git filter-repo` (not just a follow-up commit — it must be purged from the log)
* CI/CD: add a pre-commit secret-scanning step (e.g. `detect-secrets` or GitHub secret scanning on the public repo) before the final push

### Reviewer checklist (before every commit)
- [ ] `grep -r "webhook" .` returns no URLs
- [ ] `grep -rE "(password|secret|token|key)\s*=\s*['\"][^'\"]{8,}" .` returns no matches
- [ ] All `dbutils.secrets.get()` calls reference a scope + key name only, never a fallback literal

## 6b. Naming convention

* Tables: `bronze_<source>_<entity>`, `silver_<entity>`, `gold_dim_<entity>`, `gold_fact_<entity>`, `gold_mart_<name>`, `ml_feat_<subject>`, `ml_<model>_scores`, `mv_<subject>` (metric views), `lb_serve_<entity>` (Lakebase synced read), `lb_<entity>` (Lakebase operational write).
* Reserved-word note: never use `catalog` as a source-system prefix (SQL reserved word). Game catalog source is prefixed `game_svc`.
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

* `lb_serve_player_risk_profile`: synced table from gold_mart_player_360 + scores (sub-second lookups for the app). `lb_` prefix marks all Lakebase tables.
* `lb_moderation_actions` (native Postgres table): actions taken in the app (warn, mute, suspend, refund-block, clear), synced back to gold_fact_event (ACTION rows) for analytics and retraining.

## 9. Genie space

New space "Emberline - Player 360, Fraud & Toxicity" over the gold star schema, scores and metric view, with instructions for business definitions, join paths, sample questions and benchmark questions.

## 10. Databricks App

`game-cx-players-console`: risk queue (high fraud / toxicity / churn), Player 360 profile page, fraud-ring view, message evidence with LLM rationale, action buttons written to Lakebase, embedded Genie for ad-hoc questions.

## 11. Governance (Unity Catalog)

Governance spans 8 steps in Phase 3 of the build:

### 11a. Table and column comments
Every table and every key column gets a `COMMENT` in SQL (or `SET TBLPROPERTIES`). The evaluator, Genie and future users can read the purpose of every object without asking.

### 11b. Governed tags
| Tag key | Values | Applied to |
|---|---|---|
| `pii_type` | `email`, `date_of_birth`, `phone`, `player_name`, `chat_text` | PII columns across bronze, silver and gold |
| `data_classification` | `PII`, `SENSITIVE`, `PUBLIC` | Table-level and column-level |
| `layer` | `bronze`, `silver`, `gold`, `ml`, `serving` | Every table |
| `domain` | `trust_safety`, `player_experience`, `game_analytics` | Every table |

### 11c. ABAC column-mask policy (not per-table masks)
1. Create group `game_cx_pii_viewers` (T&S leads, data scientists — see full values).
2. Create UDF `mask_pii(val STRING)` — returns real value for `game_cx_pii_viewers`, `***REDACTED***` for everyone else.
3. `CREATE POLICY mask_pii_policy ON SCHEMA mg_aws_serverless_workspace_catalog.game_cx_players COLUMN MASK mask_pii TO account users EXCEPT (game_cx_pii_viewers) FOR TABLES MATCH COLUMNS has_tag('pii_type') AS pii_col ON COLUMN pii_col;`

Why ABAC: one policy at the schema level covers every current and future table. Adding a new PII column requires only tagging it — no ALTER TABLE, no new mask function. Centrally auditable in Catalog Explorer.

### 11d. Lakehouse Monitoring (DQM) on silver tables
Enable on `silver_sessions`, `silver_transactions`, `silver_chat_messages`. Tracks null rates, value distributions and row counts over time. Creates a ready-made DQM dashboard — shows continuous quality monitoring, not just a one-time check.

### 11e. Metric view `mv_player_trust_safety`
Semantic layer for the dashboard, Genie, app KPIs and agents. All business-logic aggregations defined once here.

Measures:
* Fraud: `chargeback_rate_pct`, `chargeback_loss_usd`, `fraud_txns_blocked`, `false_positive_rate`, `avg_fraud_score`
* Toxicity: `toxic_msgs_per_1k`, `pct_reports_auto_triaged`, `avg_time_to_action_hours`, `repeat_offender_rate`, `toxicity_driven_churn_rate`
* Player 360: `dau`, `mau`, `dau_mau_ratio`, `d7_retention`, `d30_retention`, `payer_conversion_rate`, `arppu_usd`, `high_value_player_count`, `revenue_at_risk_usd`
* LiveOps: `event_revenue_uplift_pct`, `event_toxicity_uplift_pct`

### 11f. UC Domain: `Gaming CX` with 3 sub-domains
Created in Unity Catalog Discover. All project assets assigned.

| Sub-domain | Tables | Other assets |
|---|---|---|
| Trust & Safety | `gold_fact_event`, `ml_fraud_txn_scores`, `ml_toxicity_message_labels`, `lb_serve_player_risk_profile`, `mv_player_trust_safety` | App `game-cx-players-console`, Dashboard pages 2 & 3 |
| Player Experience | `gold_fact_session`, `gold_dim_player`, `gold_mart_player_360`, `ml_churn_player_scores` | Dashboard page 1 |
| Game Analytics | `gold_dim_game`, `gold_dim_live_ops_event`, `gold_dim_date` | Genie space |

Why: in one screen, a Trust & Safety lead can navigate to their sub-domain and find every relevant table, app and dashboard. Strong product story: governed data estate for the whole business.

### 11g. UC Glossary Pages (7)
Human-authored business-term definitions, visible in Genie context, assistant and Catalog Explorer.

| Page | Definition summary |
|---|---|
| `High-Value Player` | `lifetime_spend_usd > 50 AND last_active_date >= as_of_date - 14` |
| `At-Risk Player` | `churn_risk_score >= 0.7 OR risk_band = 'HIGH'` |
| `Fraud Ring` | 2+ accounts sharing `device_fingerprint` where at least one has `is_emulator = true` |
| `Live-Ops Event` | Time-limited in-game campaign (ranked seasons, esports events, skin drops, sales); see `gold_dim_live_ops_event` |
| `Toxicity Score` | Player-level aggregation from `ml_toxicity_message_labels`; formula and thresholds defined here |
| `Chargeback Rate` | `COUNT(chargebacks) / COUNT(transactions)` over a trailing 30-day window; basis for the metric view measure |
| `as_of_date` | The simulated reference date `2026-12-31`. All relative-date logic ("current", "last 14 days", "this month") uses this date, never `current_date()`. Genie, the app and the dashboard all read from `gold_dim_date WHERE is_as_of_date = true`. |

The `as_of_date` page is the most important: it ensures Genie always answers relative-date questions correctly on a simulated dataset.

### 11h. Custom Databricks Assistant Skill `gaming-cx`
File: `skills/gaming-cx/SKILL.md` in the repo (also deployed to `.assistant/skills/`).

Contents:
* Schema and table purposes
* Join paths (fact → dim keys, grain of each table)
* Business vocabulary (all 7 glossary definitions)
* `as_of_date` rule
* Common query patterns (fraud ring query, toxicity cohort comparison, YoY revenue)

Why: in future customer sessions, loading this skill means the assistant instantly understands the data model without re-explanation. Also a strong demo: "we packaged the domain knowledge as a reusable skill."

## 12. Data quality rules (bronze → silver)

**Bronze:** no expectations. Raw landing zone captures all rows. `_source_file`, `_ingested_at`, `_rescued_data` metadata columns added automatically by Auto Loader. Schema-on-read handles schema drift.

**Silver expectations** (SDP `CONSTRAINT` clauses — `ON VIOLATION DROP ROW` removes the row and counts the violation; `ON VIOLATION WARN` keeps the row but logs it):

| Table | Constraint | Behaviour |
|---|---|---|
| `silver_players` | `player_id IS NOT NULL` | DROP |
| `silver_players` | `email RLIKE '^[^@]+@[^@]+\\.[^@]+'` | WARN |
| `silver_players` | `registration_date BETWEEN '2020-01-01' AND '2026-12-31'` | WARN |
| `silver_sessions` | `session_id IS NOT NULL` | DROP |
| `silver_sessions` | `player_id IS NOT NULL AND game_id IS NOT NULL` | DROP |
| `silver_sessions` | `duration_min >= 0` | DROP |
| `silver_sessions` | `accuracy_pct BETWEEN 0 AND 100` | WARN |
| `silver_sessions` | `session_date BETWEEN '2025-01-01' AND '2026-12-31'` | WARN |
| `silver_transactions` | `txn_id IS NOT NULL` | DROP |
| `silver_transactions` | `amount_usd > 0` | DROP |
| `silver_transactions` | `payment_method IN ('card','paypal','wallet','gift_card')` | WARN |
| `silver_chargebacks` | `chargeback_id IS NOT NULL AND txn_id IS NOT NULL` | DROP |
| `silver_chargebacks` | `disputed_amount_usd > 0` | DROP |
| `silver_chat_messages` | `message_id IS NOT NULL AND sender_player_id IS NOT NULL` | DROP |
| `silver_chat_messages` | `LENGTH(TRIM(message_text)) > 0` | DROP |
| `silver_player_reports` | `report_id IS NOT NULL AND reporter_player_id IS NOT NULL AND reported_player_id IS NOT NULL` | DROP |
| `silver_player_reports` | `report_category IN ('HARASSMENT','HATE_SPEECH','THREAT','SCAM','CHEATING','GRIEFING','OTHER')` | WARN |

Expectation metrics are visible in the pipeline event log and (with Lakehouse Monitoring enabled) in the DQM dashboard.

**Cross-layer reconciliation** (run after each pipeline update, output to `evidence/reconciliation.md`):
* `COUNT(silver_sessions)` vs `COUNT(bronze_telemetry_sessions)` minus DROP violations
* `COUNT(gold_fact_event WHERE event_type='PURCHASE')` vs `COUNT(silver_transactions)` after drops
* `COUNT(gold_fact_event WHERE has_chargeback=true)` vs `COUNT(silver_chargebacks)` (MERGE completeness check)

## 13. Orchestration and evidence

* Job `game-cx-players-daily-job`: pipeline refresh -> reconciliation -> ML scoring notebooks -> Lakebase sync.
* Evidence for the FE Bar evaluator (text only): notebooks committed as .ipynb with outputs (`.databricks/commit_outputs` file in repo), plus exported run logs and query results as markdown under `evidence/`.
* `evidence/reconciliation.md`: row-count reconciliation across all layers after the pipeline run.

## 14. Repo layout (target)

```
README.md                              outcome first, architecture, value, decisions and trade-offs, AI usage
docs/
  PLAN.md                              this file
  DECISIONS.md                         trade-offs in detail
  VALUE_MODEL.md                       quantified impact
  AI_BUILD_LOG.md                      tools, prompts, patterns used
  deck.md                              business presentation (exported to PDF for submission)
  roleplay_prep.md                     tell-show-tell script, Priya / Marcus personas, objections
notebooks/
  01_generate_raw_data.ipynb           (committed with outputs)
  02_train_fraud_model.ipynb
  03_train_churn_model.ipynb
  04_classify_toxicity.ipynb
  05_build_player_360.ipynb
pipelines/
  transformations/
    bronze/*.sql                       9 streaming tables (Auto Loader)
    silver/*.sql                       9 materialized views with expectations
    gold/dims/*.sql                    6 dimension tables
    gold/facts/*.sql                   gold_fact_session, gold_fact_event
    gold/mart/*.sql                    gold_mart_player_360
app/                                   Databricks App source (AppKit)
genie/
  instructions.md                      Genie space instructions
  benchmark_questions.md               10 benchmark Q&A
governance/
  abac_policy.sql                      ABAC UDF + policy DDL
  tags.sql                             governed tag assignments
  glossary_pages.md                    7 business-term definitions
resources/
  game-cx-players.pipeline.yml
  game-cx-players-daily-job.yml
  game-cx-players-console.app.yml
  game-cx-players-fraud-ring-alert.alert.yml
  game-cx-players-toxicity-spike-alert.alert.yml
databricks.yml                         bundle root (dev + prod targets)
evidence/
  reconciliation.md                    cross-layer row counts
  pipeline_run.md                      pipeline update log
  model_metrics.md                     fraud / churn / toxicity evaluation
  lakebase_timing.md                   Lakebase lookup and write-back latency
  genie_benchmarks.md                  Genie benchmark answers
skills/
  gaming-cx/
    SKILL.md                           custom assistant skill for future demos
.databricks/
  commit_outputs                       enables .ipynb output commits to GitHub
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
* ABAC schema-level policy vs per-table column masks: ABAC covers all current and future tables from one definition; adding a new PII column requires only a tag.
* AI Gateway with guardrails vs direct foundation model endpoint: gateway adds PII detection, safety filter, budget cap and fallback routing — the pattern for production.
* 2 gold facts vs 6: gold is business-model-oriented (session = gameplay, event = account-level); bronze/silver stay source-oriented (unchanged at 9 tables each); chargebacks merge as late-arriving attributes on PURCHASE rows.
* Lakebase vs querying the SQL warehouse from the app (latency, concurrency, write-back).

## 16. Open questions (to settle before the build)

Status: all planning questions decided. Remaining build-time check: exact fast-tier Claude endpoint names, dbldatagen install on serverless.

| # | Question | Status | Decision / recommendation |
|---|---|---|---|
| 1 | Value model inputs and KPIs | DECIDED (accepted) | KPI set in section 16a; studio inputs 8M MAU, $600M bookings, $25 annual revenue per active player, $25/hour moderator cost |
| 2 | Role-play personas | DECIDED (accepted) | Business: Priya Raman, VP Player Experience & Trust (executive sponsor). Technical: Marcus Chen, Director of Data Platform. Domain owner referenced in the deck: Head of Payments Risk |
| 3 | Lakebase type | DECIDED: autoscaling | Verified available: the workspace already has Lakebase autoscaling projects (Postgres 17). New project: `game-cx-players-lakebase` |
| 4 | LLM for toxicity | DECIDED | AI Gateway endpoint `game-cx-players-llm`: primary `databricks-claude-haiku-5-5` (bulk scoring), fallback `databricks-claude-haiku-4-5` (same cost tier, not Opus — avoids surprise cost spikes). PII input guardrail + safety filter + budget policy. Evaluation notebook uses `databricks-claude-opus-5-5` directly (small labelled sample, not on the gateway). Both endpoints confirmed READY. **Smart routing: explicitly excluded.** Smart routing selects the lowest-cost model for *coding* tasks (Claude Code, Codex, Omnigent). Our use case is text classification of gaming chat messages — not a coding task. Smart routing has no ability to optimise for classification quality vs cost, and could route away from Haiku-5-5 (chosen deliberately for structured-output reliability and cost). Explicit primary + fallback routing is the right pattern here. |
| 5 | App stack | DECIDED: AppKit | React + TypeScript (AppKit) app `game-cx-players-console` (name limit 26 chars) using built-in plugins: Lakebase (risk queue, moderation write-back), analytics (metric view KPIs via SQL warehouse), Genie chat, model serving if needed. Why: everything stays programmatic (code, typed SQL, bundle-deployed) and the app is backed by Lakebase for low-latency reads and transactional write-back. Fallback: Streamlit |
| 6 | AI/BI dashboard | DECIDED: yes | A metric view on the gold layer is the semantic layer; the dashboard, Genie space, app KPIs and agents all read from it |
| 7 | Bundles | DECIDED: yes | Pipeline, job and app deployed with Declarative Automation Bundles from the repo |
| 8 | Commit notebook outputs | DECIDED: allowed | The user already commits .ipynb outputs in another project in this workspace. Add `.databricks/commit_outputs` to the repo; keep text logs in `evidence/` as a backup |
| 9 | Scale | DECIDED: 50K players | Gives about 600 fraudsters (about 75 rings), about 2,000 toxic players and about 750 cheaters: enough signal; scaled up in the value model |
| 10 | Chat language | DECIDED: English only | |
| 11 | Data window | DECIDED: option (b) | 2025-01-01 to 2026-12-31, simulated as-of date 2026-12-31. Mitigations: (1) `as_of_date` reference plus an is-current flag in `gold_dim_date`, used everywhere instead of `current_date()`, and a Genie instruction plus benchmark to enforce it; (2) moderation actions store the real `action_ts` and the simulated `effective_date`; (3) README, deck and app header state the simulated as-of date; (4) hold back the last few days of files to demo incremental Auto Loader ingestion; (5) fraud model trains only on purchases older than 75 days; (6) lifetime metrics labelled "since Jan 2025" |
| 12 | Data generation tool | DECIDED: hybrid | dbldatagen for independent attributes, PySpark for cross-table behaviour. Verify the dbldatagen install on serverless first (latest release v0.4.0-Hotfix1-WheelBuild, May 2025, includes serverless fixes; Labs project, provided as-is) |
| 13 | Table count | DECIDED | Bronze 9, Silver 9, Gold dims 6, Gold facts 2 (`gold_fact_session` + `gold_fact_event`), Gold mart 1 (`gold_mart_player_360`), ML 3, metric view 1, Lakebase 2 (`lb_serve_player_risk_profile` + `lb_moderation_actions`). silver_chargebacks merges into gold_fact_event (late MERGE on PURCHASE rows). silver_chat_messages bypasses gold → ML only. gold_dim_date and gold_dim_geography are generated (no silver source). |
| 14 | PII governance | DECIDED | ABAC column-mask policy at schema level — tag-driven, not per-table. See section 11. |
| 15 | Raw file count | DECIDED | 3,659 raw files (4 reference + 5 × 731 daily) + 3 ground_truth parquet files. `catalog` removed from source-system names (reserved word) → game_svc. |

### 16a. Recommended KPI set (beyond MAU, bookings, ARPU, moderator cost)

| Area | KPI | Audience |
|---|---|---|
| Fraud | Chargeback rate (% of transactions and % of $), fraud loss $ (amount plus fees), $ fraud caught at a fixed review capacity, false-positive rate / legitimate revenue blocked, time to detect a fraud ring | CFO, Head of Payments Risk |
| Toxicity | Toxic messages per 1K messages, % of players exposed to toxicity, churn uplift of exposed vs unexposed players, time to action, % of reports auto-triaged, report backlog, moderator cost per report, repeat-offender rate | VP Player Experience & Trust, T&S operations |
| Player 360 | DAU, MAU, DAU/MAU stickiness, D7/D30 retention, payer conversion, ARPDAU, ARPPU, number of high-value players, revenue at risk from at-risk high-value players, LTV | Executive sponsor, LiveOps |
| LiveOps | Event revenue uplift vs baseline, toxicity during events vs baseline, event participation | LiveOps lead |
| Cheating | Cheat reports per 1K matches, confirmed cheaters actioned | Game integrity |

## 17. Build sequence

| Phase | Step | Key outputs / evidence |
|---|---|---|
| **0** | Setup: dbldatagen install, AI Gateway `game-cx-players-llm` (Haiku-5-5 primary, Haiku-4-5 fallback, PII guardrail, budget), schema `game_cx_players`, volumes `raw` + `ground_truth`, `.databricks/commit_outputs` | Gateway READY, schema and volumes exist |
| **1** | `01_generate_raw_data`: dbldatagen (players, devices, games, events, traits) + PySpark (sessions, txns, chargebacks, chat, reports, ground truth). 3,659 raw files + 3 ground-truth parquets. Validation cell printed | File inventory, signal checks in notebook output |
| **2** | Lakeflow SDP pipeline `game-cx-players-pipeline`: bronze (9 streaming tables) → silver (9 MVs with expectations) → gold dims (6) → gold facts (2) → `gold_mart_player_360` (placeholder, scores added in Phase 4) | Pipeline update SUCCESS, expectation metrics, row-count reconciliation in evidence/ |
| **3a** | Comments on all tables and columns | ALTER TABLE DDL run without errors |
| **3b** | Governed tags (`pii_type`, `data_classification`, `layer`, `domain`) on all tables and PII columns | Tags visible in Catalog Explorer |
| **3c** | ABAC: group `game_cx_pii_viewers`, UDF `mask_pii`, policy `mask_pii_policy` at schema level | Query as non-member → `***REDACTED***`; as member → full value |
| **3d** | Lakehouse Monitoring on `silver_sessions`, `silver_transactions`, `silver_chat_messages` | DQM dashboard created |
| **3e** | Metric view `mv_player_trust_safety` | Query returns all measures |
| **3f** | UC Domain `Gaming CX` + 3 sub-domains; assign all assets | Visible in Discover |
| **3g** | 7 Glossary pages | Pages published in Discover |
| **3h** | Custom skill `gaming-cx` in repo + `.assistant/skills/` | Skill loads cleanly |
| **4** | `02_train_fraud_model`, `03_train_churn_model`, `04_classify_toxicity`, `05_build_player_360` | MLflow runs, model metrics in evidence/, `gold_mart_player_360` fully populated |
| **5** | Lakebase `game-cx-players-lakebase`: `lb_serve_player_risk_profile` sync + `lb_moderation_actions` table + write-back to `gold_fact_event` ACTION rows | Lookup <50ms, round-trip write confirmed |
| **6** | Genie space with instructions, benchmark questions, as_of_date rule | All 10 benchmark questions pass |
| **7** | AI/BI dashboard `Emberline Player Trust & Safety` (3 pages on `mv_player_trust_safety`) + 2 Databricks SQL Alerts V2: `game-cx-players-fraud-ring-alert` (new fraud ring members with `fraud_risk_score > 0.8`, every 15 min, Slack + email) and `game-cx-players-toxicity-spike-alert` (`toxic_msgs_per_1k` rolling 1-hour rate > 2× 7-day baseline, every 30 min, Slack + email). Both alerts deployed via bundle. Demo destinations: Slack channel `#game-cx-players-alerts` + `mayur.gupta@databricks.com`. For a real customer: swap channel and DL — query SQL stays identical. Slack webhook URL stored in Databricks Secrets, never hardcoded. | Dashboard loads; both alerts fire on a test row; Slack message and email received |
| **8** | AppKit app `game-cx-players-console` (5 views: risk queue, player 360, fraud ring, KPI overview, Ask Genie) | Smoke test passes |
| **9** | Bundle `databricks.yml`: pipeline + job + app; `dev` deploy and run | Job run SUCCESS |
| **10** | README, deck, roleplay script, AI build log, evidence/ text files; commit all notebooks with outputs; push to GitHub | Repo public, all notebooks have output cells |
| **11** | End-to-end verification: reconciliation, ABAC check, Lakebase round-trip, app smoke test, Genie benchmark | All checks pass, documented in evidence/ |

1. Data generator + validation (notebook 01).
2. Lakeflow pipeline (bronze, silver, gold star schema).
3. Governance (comments, tags, masks, metric view).
4. ML fraud + churn, GenAI toxicity.
5. Lakebase serving + write-back.
6. Genie space.
7. Databricks App.
8. Job, evidence export, README, deck, role-play prep, commit.
9. End-to-end verification.
