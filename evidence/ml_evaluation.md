# Phase 4 ML Evaluation — Emberline Studios Game CX

as_of_date: 2026-12-31

---

## 4a. Transaction Fraud — `fraud_txn_classifier@champion`

**Notebook:** `notebooks/02_train_fraud_model.ipynb`  
**MLflow run:** `03b1918776e2451e95466c4b8542b4f1`  
**UC model:** `mg_aws_serverless_workspace_catalog.game_cx_players.fraud_txn_classifier` v1 `@champion`

**Training design**
- Features: account age, billing vs IP country mismatch, is_emulator, is_rooted, shared_fp_accounts (fraud-ring signal), 24h and 7d purchase velocity, amount, payment method, item type, hour of day
- Label: transaction has a chargeback
- Only transactions with `txn_date <= 2026-10-17` (75 days before as_of_date) used for training/test so chargeback labels are mature
- Time-based split: train `< 2026-06-01` (600,914 rows), test `2026-06-01..2026-10-17` (210,878 rows)
- Model: `HistGradientBoostingClassifier` with one-hot categoricals

**Test-set metrics**

| Metric | Value |
|---|---|
| Base rate (chargebacks / transactions) | 1.0% |
| ROC-AUC | 0.765 |
| PR-AUC | 0.314 |
| Precision at top-1% review capacity | 44.8% |
| Recall at top-1% review capacity | 44.7% |
| Chargeback dollars caught at top-1% review | $67,647 (75.6% of total) |
| Fraud-ring player recall (GT: 600 ring players) | 100% (600/600) |
| Non-ring players flagged | 4.8% (2,369/49,400) |

**Scoring output:** `ml_fraud_txn_scores` — 948,078 rows, 10,022 flagged (is_flagged = True)

> Note: ring recall is 100% partly by construction — `shared_fp_accounts` is a direct feature and rings are defined by shared fingerprints.

---

## 4b. Player Churn — `churn_player_classifier@champion`

**Notebook:** `notebooks/03_train_churn_model.ipynb`  
**MLflow run:** `4cb712f2c2554419b2a7942181992105`  
**UC model:** `mg_aws_serverless_workspace_catalog.game_cx_players.churn_player_classifier` v1 `@champion`

**Training design**
- Label: player active in the 30 days before a month-end who has no session in the next 30 days
- Features: sessions_30d, engagement_trend, days_since_last_session, matchmaking_quality_30d, ping_ms_30d, toxic_msgs_received_30d, reports_filed_30d, spend_30d, lifetime_spend_usd, account_age_days
- Train on month-end observation dates `<= 2026-08-31` (420,899 player-month rows across 18 months)
- Validation obs: 2026-09-30 (threshold selection via F1 optimisation → 0.235)
- Test obs: 2026-11-30 (22,516 rows)
- Model: `HistGradientBoostingClassifier`

**Test-set metrics**

| Metric | Value |
|---|---|
| Monthly churn rate (base rate) | 6.1% |
| ROC-AUC | 0.882 |
| PR-AUC | 0.493 |
| Top-decile lift | 5.81× |
| Precision at threshold (0.235) | 50.5% |
| Recall at threshold | 43.4% |
| GT `is_churned` capture rate | 72.2% (at-risk flag on truly-churned vs 1.6% on non-churned) |

**Scoring output:** `ml_churn_player_scores` — 50,000 rows; 745 `churn_risk = 1` (at-risk); 26,813 lapsed; 1,638 never-played

---

## 4c. Chat Toxicity — LLM Classification via `ai_query`

**Notebook:** `notebooks/04_classify_toxicity.ipynb`  
**MLflow run:** `game-cx-players-toxicity-eval` experiment  
**Model:** `system.ai.meta-llama-3-3-70b-instruct` via `ai_query` (batch, `failOnError => false`)

**Sample design**
- 7,000 reported messages (evidence_message_id from silver_player_reports)
- 3,000 randomly sampled unreported messages
- Total: 10,000 (cost-guard cap)
- 0 API errors

**Category breakdown (10,000 messages)**

| Category | Count | Toxic? |
|---|---|---|
| HARASSMENT | 4,263 | Yes |
| SCAM | 1,290 | Yes |
| THREAT | 981 | Yes |
| HATE_SPEECH | 528 | Yes |
| NEUTRAL | 2,380 | No |
| BANTER | 558 | No |

**Evaluation vs ground-truth labels (all 10,000 matched)**

| Metric | LLM | Keyword baseline |
|---|---|---|
| Precision | 0.998 | 0.925 |
| Recall | 0.990 | 0.106 |
| F1 | 0.994 | 0.191 |
| Banter false-positive rate | 20.5% | 69.3% |

The LLM correctly distinguishes competitive banter ("you're trash lol") from genuine toxicity, reducing false positives from 69% to 20% while maintaining 99% recall on actual toxic content.

**Scoring output:** `ml_toxicity_message_labels` — 10,000 rows with `category`, `severity`, `rationale`, `is_toxic`

---

## 4d. Player 360 Mart — ML Scores Wired

**Pipeline:** `game-cx-players-pipeline` update `0c6b7b30-09e7-4c97-8f54-bea556ee1a27` (dev mode)

`gold_mart_player_360` updated to join all three `ml_*` score tables:

| Column | Source | Non-null rows |
|---|---|---|
| `churn_risk_score` / `is_at_risk` | ml_churn_player_scores | 21,549 (active players) |
| `fraud_risk_score` | ml_fraud_txn_scores (max per player) | 14,271 (players with transactions) |
| `toxicity_score` | ml_toxicity_message_labels (sent) | 4,706 |
| `toxic_messages_received` | ml_toxicity_message_labels (recv) | 7,672 |

**Recommended action distribution (50,000 players)**

| Action | Players |
|---|---|
| (no signal) | 44,728 |
| review_fraud | 2,351 |
| warn_toxicity | 1,649 |
| monitor | 639 |
| suspend | 619 |
| retain (high-value + at-risk) | 14 |

Total rows: 50,000 (unchanged). `is_at_risk` is no longer NULL.

## 4e. Cheat detection (Phase 9) — rule in `gold_mart_player_360`

**Approach:** a transparent rule, not a model, so moderators can explain every flag. A player is `is_suspected_cheater` when they have
>= 3 sessions in the shooter titles (Iron Vanguard, Starfall Legends) and at least 2 of 3 signals: average headshot >= 40%,
average accuracy >= 45%, kills per match >= 9 (`pipelines/transformations/gold/mart/gold_mart_player_360.sql`). New action `review_cheating` sits between
`warn_toxicity` and `retain` in the priority order.

**Result vs ground truth** (`ground_truth/gt_players.is_cheater`, measured 2026-11-20):

| Cheaters | Caught |
|---|---|
| >= 20 shooter sessions: 277 | 277 |
| < 20 shooter sessions: 75 | 60 |
| No shooter sessions: 8 | 0 (no accuracy data; undetectable by design) |
| **Total 360** | **337** |

| Metric | Value |
|---|---|
| Precision | **1.000** (0 false positives) |
| Recall, all cheaters | 0.936 (337 / 360) |
| Recall, cheaters who played a shooter | 0.957 (337 / 352) |

**Recommended actions after Phase 9** (open = no moderator action yet):

| recommended_action | Players | Open |
|---|---|---|
| (no signal) | 44,433 | |
| review_fraud | 2,351 | 2,350 |
| warn_toxicity | 1,649 | 1,648 |
| monitor | 627 | 627 |
| suspend | 619 | 618 |
| review_cheating | 307 | 307 |
| retain (high-value + at-risk) | 14 | 14 |

30 of the 337 suspected cheaters carry a higher-priority action (18 `review_fraud`, 12 `warn_toxicity`), so 307 show as `review_cheating`.
