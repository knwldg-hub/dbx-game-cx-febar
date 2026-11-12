-- Silver: cleansed chargeback records with DQ expectations
CREATE OR REFRESH MATERIALIZED VIEW silver_chargebacks (
  chargeback_id       STRING COMMENT 'Chargeback case identifier.',
  txn_id              STRING COMMENT 'Original transaction that was disputed.',
  player_id           STRING COMMENT 'Player subject to the chargeback. PII: account identity.',
  chargeback_date     DATE   COMMENT 'Date the chargeback was filed.',
  reason_code         STRING COMMENT 'Reason code from the card network.',
  disputed_amount_usd DOUBLE COMMENT 'Disputed amount in USD.',
  chargeback_fee_usd  DOUBLE COMMENT 'Processing fee charged to Emberline Studios in USD.',
  card_network        STRING COMMENT 'Card network: VISA, MC, AMEX, DISCOVER.',
  CONSTRAINT pk_chargeback         EXPECT (chargeback_id IS NOT NULL AND txn_id IS NOT NULL) ON VIOLATION DROP ROW,
  CONSTRAINT positive_disputed_amt EXPECT (disputed_amount_usd > 0)                         ON VIOLATION DROP ROW
)
COMMENT 'Cleansed chargebacks. Null keys and non-positive disputed amounts dropped.'
AS SELECT
  chargeback_id,
  txn_id,
  CAST(player_id AS STRING)              AS player_id,
  CAST(chargeback_date AS DATE)          AS chargeback_date,
  reason_code,
  CAST(disputed_amount_usd AS DOUBLE)    AS disputed_amount_usd,
  CAST(chargeback_fee_usd AS DOUBLE)     AS chargeback_fee_usd,
  card_network
FROM bronze_payments_chargebacks;
