-- Gross revenue per title from the governed metric view (6 titles), for the selected region and period.
-- Not filtered by game: the overview highlights the selected title and a bar click selects it.
-- @param region STRING
-- @param start_date DATE
SELECT
  game_title,
  MEASURE(gross_revenue_usd) AS gross_revenue_usd
FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_trust_safety
WHERE game_title IS NOT NULL
  AND (:region = '' OR player_region = :region)
  AND event_date >= :start_date
GROUP BY ALL
ORDER BY gross_revenue_usd DESC
