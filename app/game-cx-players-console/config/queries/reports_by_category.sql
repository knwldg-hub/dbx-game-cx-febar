-- Player abuse reports by category (governed metric view).
-- @param game STRING
-- @param region STRING
-- @param start_date DATE
SELECT
  report_category,
  CAST(MEASURE(report_count) AS BIGINT) AS reports
FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_trust_safety
WHERE event_type = 'REPORT'
  AND report_category IS NOT NULL
  AND (:game = '' OR game_title = :game)
  AND (:region = '' OR player_region = :region)
  AND event_date >= :start_date
GROUP BY ALL
ORDER BY reports DESC
