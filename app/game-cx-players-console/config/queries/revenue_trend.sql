-- Monthly gross revenue, net revenue and chargeback loss (governed metric view).
-- Chargeback loss for the last ~75 days is still incomplete (disputes arrive 15-75 days after purchase).
-- @param game STRING
-- @param region STRING
-- @param start_date DATE
SELECT
  event_month                                     AS month,
  CAST(MEASURE(gross_revenue_usd) AS DOUBLE)      AS gross_revenue_usd,
  CAST(MEASURE(net_revenue_usd) AS DOUBLE)        AS net_revenue_usd,
  CAST(MEASURE(chargeback_loss_usd) AS DOUBLE)    AS chargeback_loss_usd
FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_trust_safety
WHERE (:game = '' OR game_title = :game)
  AND (:region = '' OR player_region = :region)
  AND event_date >= :start_date
  AND event_type = 'PURCHASE'
GROUP BY ALL
ORDER BY month
