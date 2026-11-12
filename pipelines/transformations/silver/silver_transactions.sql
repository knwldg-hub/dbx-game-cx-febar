-- Silver: cleansed purchase transactions with DQ expectations
CREATE OR REFRESH MATERIALIZED VIEW silver_transactions (
  txn_id            STRING    COMMENT 'Transaction identifier.',
  player_id         STRING    COMMENT 'Purchasing player. PII: account identity.',
  game_id           STRING    COMMENT 'Game the purchase was made in.',
  device_id         STRING    COMMENT 'Device used at time of purchase.',
  session_id        STRING    COMMENT 'Session during which the purchase occurred.',
  txn_date          DATE      COMMENT 'Transaction date.',
  txn_ts            TIMESTAMP COMMENT 'Transaction timestamp.',
  item_type         STRING    COMMENT 'Item category: skin, pass, currency, loot_box.',
  currency          STRING    COMMENT 'ISO 4217 local currency code.',
  amount_usd        DOUBLE    COMMENT 'Transaction amount in USD.',
  amount_local      DOUBLE    COMMENT 'Transaction amount in local currency.',
  payment_method    STRING    COMMENT 'Payment method: card, paypal, wallet, gift_card. Invalid values warned.',
  billing_country   STRING    COMMENT 'Billing address country. PII: quasi-identifier.',
  ip_country        STRING    COMMENT 'Country inferred from IP at purchase time — used in fraud detection.',
  live_ops_event_id STRING    COMMENT 'Live-ops event active at time of purchase, if any.',
  CONSTRAINT pk_txn_id            EXPECT (txn_id IS NOT NULL)                                       ON VIOLATION DROP ROW,
  CONSTRAINT positive_amount      EXPECT (amount_usd > 0)                                           ON VIOLATION DROP ROW,
  CONSTRAINT valid_payment_method EXPECT (payment_method IN ('card', 'paypal', 'wallet', 'gift_card'))
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
