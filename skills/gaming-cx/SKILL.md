---
name: gaming-cx
description: Domain knowledge for the Emberline Studios Game CX demo (catalog mg_aws_serverless_workspace_catalog, schema game_cx_players). Read this skill when the user asks about players, sessions, transactions, chargebacks, toxicity, fraud rings, churn, live-ops events, or any table in game_cx_players. Contains the full table map, join keys, business vocabulary, as_of_date rule, metric view usage, and common query patterns.
---

## Ground rules

- **Never use `current_date()`**. The demo's reference date is `as_of_date = 2026-12-31`. Read it from `gold_dim_date WHERE is_as_of_date = true`. Every relative date ("last 14 days", "this month", "active recently") is measured from it.
- Catalog: `mg_aws_serverless_workspace_catalog`, schema: `game_cx_players`.
- No "febar" in any Databricks asset name.

---

## Business vocabulary

| Term | Definition |
|---|---|
| **High-value player** | `lifetime_spend_usd > 50 AND last_active_date >= DATE '2026-12-17'` (within 14 days of as_of_date). Filter: `is_high_value_player = true` on `gold_mart_player_360`. |
| **At-risk player** | `churn_risk = 1` from `churn_player_classifier@champion`. Filter: `is_at_risk = true` on `gold_mart_player_360`. |
| **Live-ops event** | In-game, time-limited campaign or promotion. Types: `ranked_season`, `esports`, `skin_drop`, `sale`. Source: `gold_dim_live_ops_event` (144 events). |
| **Fraud ring** | 2+ accounts sharing one `device_fingerprint` with `is_emulator = true`. At as_of_date: 155 fingerprints, 604 accounts. Source: `gold_dim_device`. |
| **Chargeback rate** | `chargeback_count / purchase_count`. Use `is_chargeback_window_closed = true` for final rates (chargebacks arrive 15–75 days after purchase). Source: `mv_player_trust_safety`. |
| **Toxicity score** | Share of a player's LLM-classified sent messages that are toxic (0–1). Based on 10K-message sample. Source: `gold_mart_player_360.toxicity_score`. |

---

## Table map

### Bronze (raw ingest, schema-inferred streaming tables)
`bronze_account_players`, `bronze_games`, `bronze_live_ops_events`, `bronze_telemetry_devices`, `bronze_telemetry_sessions`, `bronze_commerce_transactions`, `bronze_payments_chargebacks`, `bronze_chat_messages`, `bronze_safety_player_reports`

### Silver (cleaned, typed materialized views)
| Table | Grain | Key columns |
|---|---|---|
| `silver_players` | 1 row / player | `player_id`, `email`\*, `phone_number`\*, `registration_date`, `country`, `acquisition_channel` |
| `silver_sessions` | 1 row / session | `session_id`, `player_id`, `game_id`, `device_id`, `session_date`, `duration_min`, `matchmaking_quality` |
| `silver_transactions` | 1 row / transaction | `txn_id`, `player_id`, `game_id`, `device_id`, `txn_date`, `amount_usd`, `payment_method`, `item_type`, `billing_country`, `ip_country` |
| `silver_chargebacks` | 1 row / chargeback | `chargeback_id`, `txn_id`, `player_id`, `chargeback_date`, `disputed_amount_usd`, `chargeback_fee_usd` |
| `silver_chat_messages` | 1 row / message | `message_id`, `sender_player_id`, `recipient_player_id`, `sent_date`, `message_text`\* |
| `silver_player_reports` | 1 row / report | `report_id`, `reporter_player_id`, `reported_player_id`, `report_date`, `report_category`, `evidence_message_id` |
| `silver_devices` | 1 row / device | `device_id`, `player_id`, `device_fingerprint`, `is_emulator`, `is_rooted_or_jailbroken` |

\* PII — masked for non-members of `game_cx_pii_viewers`.

### Gold dimensions
| Table | Grain | Key |
|---|---|---|
| `gold_dim_player` | 1 row / player | `player_id` |
| `gold_dim_game` | 1 row / game (6 total) | `game_id` → G01–G06 |
| `gold_dim_device` | 1 row / device | `device_id` |
| `gold_dim_date` | 1 row / date (730 days) | `date_key` (INT) |
| `gold_dim_geography` | 1 row / country (18) | `country_code` |
| `gold_dim_live_ops_event` | 1 row / event (144) | `event_id` |

### Gold facts
| Table | Grain | Key joins |
|---|---|---|
| `gold_fact_session` | 1 row / session | `player_id`, `game_id`, `device_id`, `date_key` → dims |
| `gold_fact_event` | 1 row / event (PURCHASE or REPORT) | `player_id`, `game_id`, `date_key` → dims; `txn_id` for purchases; `report_id` for reports |

### Gold mart
`gold_mart_player_360` — 1 row per player, 50,000 rows. Joins engagement (from sessions), spend (from transactions), churn score, fraud score, toxicity score, reports received, and recommended moderation action.

### Metric view
`mv_player_trust_safety` — 15 dimensions × 13 measures on `gold_fact_event`. **Always query this for aggregated fraud, revenue, chargeback, and report KPIs**; do not re-aggregate from fact tables unless you need a grain the metric view doesn't expose.

**Key measures:** `gross_revenue_usd`, `net_revenue_usd`, `chargeback_rate`, `chargeback_loss_usd`, `report_count`, `high_value_player_count`, `arppu_usd`

**Key dimensions:** `event_date`, `game_title`, `genre`, `player_region`, `age_band`, `is_high_value_player`, `chargeback_reason`, `report_category`

### ML tables
| Table | Grain | Key columns |
|---|---|---|
| `ml_fraud_txn_scores` | 1 row / transaction | `txn_id`, `player_id`, `fraud_score`, `is_flagged` |
| `ml_churn_player_scores` | 1 row / player | `player_id`, `churn_risk_score`, `churn_risk` (0/1) |
| `ml_toxicity_message_labels` | 1 row / message (10K sample) | `message_id`, `sender_player_id`, `category`, `severity`, `is_toxic` |

---

## Games reference

| ID | Title | Genre | Monetisation |
|---|---|---|---|
| G01 | Iron Vanguard | Battle Royale | F2P |
| G02 | Starfall Legends | Hero Shooter | F2P |
| G03 | Realm of Ash | MMORPG | Subscription |
| G04 | Hollow Crown | Action RPG | Premium |
| G05 | Gem Tide | Match-3 Mobile | F2P |
| G06 | Pocket Racers | Kart Racing Mobile | F2P |

---

## Common query patterns

### Fraud ring detection
```sql
SELECT
  device_fingerprint,
  COUNT(DISTINCT player_id) AS ring_size,
  SUM(CAST(is_emulator AS INT)) AS emulator_count
FROM mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_device
GROUP BY device_fingerprint
HAVING COUNT(DISTINCT player_id) >= 2
  AND SUM(CAST(is_emulator AS INT)) >= 1
ORDER BY ring_size DESC;
```

### Chargeback rate by game (closed window only)
```sql
SELECT
  game_title,
  SUM(chargeback_count) AS chargebacks,
  SUM(purchase_count)   AS purchases,
  ROUND(SUM(chargeback_count) * 1.0 / SUM(purchase_count), 4) AS chargeback_rate
FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_trust_safety
WHERE is_chargeback_window_closed = true
GROUP BY game_title
ORDER BY chargeback_rate DESC;
```

### High-value at-risk players (revenue at risk)
```sql
SELECT
  COUNT(*) AS at_risk_hvp,
  ROUND(SUM(lifetime_spend_usd), 2) AS revenue_at_risk
FROM mg_aws_serverless_workspace_catalog.game_cx_players.gold_mart_player_360
WHERE is_high_value_player = true
  AND is_at_risk = true;
```

### Live-ops event revenue uplift
```sql
SELECT
  game_title,
  CASE WHEN live_ops_event_id IS NOT NULL THEN 'during_event' ELSE 'baseline' END AS period,
  ROUND(SUM(amount_usd) / COUNT(DISTINCT txn_date), 2) AS daily_revenue_usd
FROM mg_aws_serverless_workspace_catalog.game_cx_players.silver_transactions
JOIN mg_aws_serverless_workspace_catalog.game_cx_players.silver_games USING (game_id)
GROUP BY 1, 2
ORDER BY 1, 2;
```

---

## Governance notes

- `email`, `phone_number`, `message_text` are PII. Masked by `mask_pii` column mask for non-members of `game_cx_pii_viewers`.
- Governed tags: `layer` (bronze/silver/gold), `data_classification` (pii/cui/u-nnpi), `pii_type` (email/phone).
- Discover domains: `Player-Trust-Safety` (fraud, chargebacks, toxicity) and `Player-Experience` (engagement, live-ops, churn).
- Pipeline `game-cx-players-pipeline` stays in development mode. Do not switch to production without asking the user.
