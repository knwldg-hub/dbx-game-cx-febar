-- Gold fact: unified account-level events (PURCHASE + REPORT; ACTION added in Phase 8)
CREATE OR REFRESH MATERIALIZED VIEW gold_fact_event
COMMENT 'Unified event fact table. PURCHASE rows from transactions (with chargeback merge), REPORT rows from player reports. ACTION rows added in Phase 8 from Lakebase moderation actions.'
CLUSTER BY (event_type, player_id)
AS
-- PURCHASE events: transactions LEFT JOIN chargebacks
SELECT
  t.txn_id                       AS event_id,
  'PURCHASE'                     AS event_type,
  t.player_id,
  t.game_id,
  t.device_id,
  CAST(DATE_FORMAT(t.txn_date, 'yyyyMMdd') AS INT) AS date_key,
  t.amount_usd,
  t.payment_method,
  t.billing_country,
  c.chargeback_id IS NOT NULL    AS has_chargeback,
  c.chargeback_date,
  c.reason_code                  AS chargeback_reason,
  c.disputed_amount_usd          AS chargeback_amount_usd,
  c.chargeback_fee_usd,
  CAST(NULL AS STRING)           AS report_category,
  CAST(NULL AS STRING)           AS reported_player_id,
  CAST(NULL AS STRING)           AS action_type,
  CAST(NULL AS STRING)           AS moderator
FROM silver_transactions t
LEFT JOIN silver_chargebacks c
  ON t.txn_id = c.txn_id

UNION ALL

-- REPORT events: player reports
SELECT
  r.report_id                    AS event_id,
  'REPORT'                       AS event_type,
  r.reporter_player_id           AS player_id,
  r.game_id,
  CAST(NULL AS STRING)           AS device_id,
  CAST(DATE_FORMAT(r.report_date, 'yyyyMMdd') AS INT) AS date_key,
  CAST(NULL AS DOUBLE)           AS amount_usd,
  CAST(NULL AS STRING)           AS payment_method,
  CAST(NULL AS STRING)           AS billing_country,
  FALSE                          AS has_chargeback,
  CAST(NULL AS DATE)             AS chargeback_date,
  CAST(NULL AS STRING)           AS chargeback_reason,
  CAST(NULL AS DOUBLE)           AS chargeback_amount_usd,
  CAST(NULL AS DOUBLE)           AS chargeback_fee_usd,
  r.report_category,
  r.reported_player_id,
  CAST(NULL AS STRING)           AS action_type,
  CAST(NULL AS STRING)           AS moderator
FROM silver_player_reports r;
