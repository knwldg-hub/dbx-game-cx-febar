-- Fraud rings: 2+ accounts sharing a device_fingerprint where at least one device is an emulator
-- (Genie glossary: "2+ players sharing a device_fingerprint with is_emulator = true").
-- One row per ring (155 rows), ranked by money lost to chargebacks.
-- No account belongs to more than one ring, so ring totals can be summed client-side.
-- missed_by_model = ring members whose per-player recommendation is NOT suspend/review_fraud.
WITH ring_fingerprints AS (
  SELECT
    device_fingerprint,
    CAST(SUM(CASE WHEN is_emulator THEN 1 ELSE 0 END) AS BIGINT) AS emulator_devices,
    CONCAT_WS(', ', SORT_ARRAY(COLLECT_SET(platform))) AS platforms
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_device
  GROUP BY device_fingerprint
  HAVING COUNT(DISTINCT player_id) >= 2
    AND SUM(CASE WHEN is_emulator THEN 1 ELSE 0 END) >= 1
),
members AS (
  SELECT DISTINCT d.device_fingerprint, d.player_id
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_device d
  JOIN ring_fingerprints r ON d.device_fingerprint = r.device_fingerprint
),
player_chargebacks AS (
  SELECT
    player_id,
    SUM(CASE WHEN has_chargeback THEN 1 ELSE 0 END) AS chargebacks,
    SUM(CASE WHEN has_chargeback THEN amount_usd ELSE 0 END) AS chargeback_usd
  FROM mg_aws_serverless_workspace_catalog.game_cx_players.gold_fact_event
  WHERE event_type = 'PURCHASE'
    AND player_id IN (SELECT player_id FROM members)
  GROUP BY player_id
)
SELECT
  r.device_fingerprint,
  CAST(COUNT(m.player_id) AS BIGINT) AS ring_size,
  r.emulator_devices,
  r.platforms,
  CAST(AVG(p.fraud_risk_score) AS DOUBLE) AS avg_fraud_score,
  CAST(SUM(COALESCE(p.lifetime_spend_usd, 0)) AS DOUBLE) AS ring_spend_usd,
  CAST(SUM(COALESCE(cb.chargebacks, 0)) AS BIGINT) AS chargebacks,
  CAST(SUM(COALESCE(cb.chargeback_usd, 0)) AS DOUBLE) AS chargeback_usd,
  CAST(COUNT(CASE WHEN p.recommended_action IS NULL
                    OR p.recommended_action NOT IN ('suspend', 'review_fraud') THEN 1 END) AS BIGINT) AS missed_by_model
FROM ring_fingerprints r
JOIN members m ON r.device_fingerprint = m.device_fingerprint
LEFT JOIN mg_aws_serverless_workspace_catalog.game_cx_players.gold_mart_player_360 p ON m.player_id = p.player_id
LEFT JOIN player_chargebacks cb ON m.player_id = cb.player_id
GROUP BY r.device_fingerprint, r.emulator_devices, r.platforms
ORDER BY chargeback_usd DESC, ring_size DESC, r.device_fingerprint
