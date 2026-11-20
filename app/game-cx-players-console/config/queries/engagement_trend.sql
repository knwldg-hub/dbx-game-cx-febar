-- Monthly active players (MAU) and average DAU (governed engagement metric view).
-- @param game STRING
-- @param region STRING
-- @param start_date DATE
SELECT
  session_month                               AS month,
  CAST(MEASURE(active_players) AS BIGINT)     AS mau,
  CAST(MEASURE(avg_dau) AS DOUBLE)            AS avg_dau
FROM mg_aws_serverless_workspace_catalog.game_cx_players.mv_player_engagement
WHERE (:game = '' OR game_title = :game)
  AND (:region = '' OR player_region = :region)
  AND session_date >= :start_date
GROUP BY ALL
ORDER BY month
