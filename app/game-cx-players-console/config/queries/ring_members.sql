-- Devices and accounts on one shared device fingerprint, with risk, spend, and chargebacks.
-- @param fingerprint STRING
WITH player_chargebacks AS (
  SELECT
    player_id,
    SUM(CASE WHEN has_chargeback THEN 1 ELSE 0 END) AS chargebacks,
    SUM(CASE WHEN has_chargeback THEN amount_usd ELSE 0 END) AS chargeback_usd
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.gold_fact_event
  WHERE event_type = 'PURCHASE'
    AND player_id IN (
      SELECT player_id
      FROM mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_device
      WHERE device_fingerprint = :fingerprint
    )
  GROUP BY player_id
)
SELECT
  d.device_id,
  d.player_id,
  d.device_model,
  d.platform,
  d.device_type,
  d.is_emulator,
  d.is_rooted_or_jailbroken,
  m.fraud_risk_score,
  m.lifetime_spend_usd,
  m.recommended_action,
  CAST(COALESCE(cb.chargebacks, 0) AS BIGINT) AS chargebacks,
  CAST(COALESCE(cb.chargeback_usd, 0) AS DOUBLE) AS chargeback_usd
FROM mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_device d
LEFT JOIN mg_aws_serverless_workspace_catalog.game_cx_players.gold_mart_player_360 m
  ON d.player_id = m.player_id
LEFT JOIN player_chargebacks cb
  ON d.player_id = cb.player_id
WHERE d.device_fingerprint = :fingerprint
ORDER BY m.fraud_risk_score DESC, d.player_id
