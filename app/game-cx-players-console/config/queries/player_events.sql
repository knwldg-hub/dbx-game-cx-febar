-- Most recent 25 purchase/report events for one player.
-- @param player_id STRING
SELECT
  e.event_id,
  e.event_type,
  TO_DATE(CAST(e.date_key AS STRING), 'yyyyMMdd') AS event_date,
  g.title AS game_title,
  e.amount_usd,
  e.has_chargeback,
  e.chargeback_reason,
  e.report_category
FROM mg_aws_serverless_workspace_catalog.game_cx_players.gold_fact_event e
LEFT JOIN mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_game g
  ON e.game_id = g.game_id
WHERE e.player_id = :player_id
ORDER BY e.date_key DESC, e.event_id
LIMIT 25
