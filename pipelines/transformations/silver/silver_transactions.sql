-- Silver: cleansed purchase transactions with DQ expectations
CREATE OR REFRESH MATERIALIZED VIEW silver_transactions (
  CONSTRAINT pk_txn_id             EXPECT (txn_id IS NOT NULL)                                       ON VIOLATION DROP ROW,
  CONSTRAINT positive_amount       EXPECT (amount_usd > 0)                                           ON VIOLATION DROP ROW,
  CONSTRAINT valid_payment_method  EXPECT (payment_method IN ('card', 'paypal', 'wallet', 'gift_card'))
)
COMMENT 'Cleansed transactions. Null txn_id and non-positive amounts dropped; invalid payment methods warned.'
AS SELECT
  txn_id,
  CAST(player_id AS STRING)       AS player_id,
  game_id,
  device_id,
  session_id,
  CAST(txn_date AS DATE)          AS txn_date,
  CAST(txn_ts AS TIMESTAMP)       AS txn_ts,
  item_type,
  currency,
  CAST(amount_usd AS DOUBLE)      AS amount_usd,
  CAST(amount_local AS DOUBLE)    AS amount_local,
  payment_method,
  billing_country,
  ip_country,
  live_ops_event_id
FROM bronze_commerce_transactions;
