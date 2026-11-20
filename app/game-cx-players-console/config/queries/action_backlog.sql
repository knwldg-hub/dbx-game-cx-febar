-- Prescriptive backlog: players per recommended action, how many are still open (no moderator action yet),
-- and the value at stake. Status as of 2026-12-31; filtered by region only (actions are player-level, not per game).
-- @param region STRING
SELECT
  m.recommended_action,
  CAST(COUNT(*) AS BIGINT)                                         AS players,
  CAST(COUNT_IF(m.actions_taken = 0) AS BIGINT)                    AS open_players,
  CAST(COUNT_IF(m.is_high_value_player) AS BIGINT)                 AS high_value_players,
  CAST(SUM(m.lifetime_spend_usd) AS DOUBLE)                        AS lifetime_spend_usd,
  CAST(SUM(CASE WHEN m.is_high_value_player THEN m.lifetime_spend_usd ELSE 0 END) AS DOUBLE)
                                                                   AS high_value_spend_usd,
  CAST(SUM(m.reports_received) AS BIGINT)                          AS reports_received
FROM mg_aws_serverless_workspace_catalog.game_cx_players.gold_mart_player_360 m
JOIN mg_aws_serverless_workspace_catalog.game_cx_players.gold_dim_player p
  ON m.player_id = p.player_id
WHERE m.recommended_action IS NOT NULL
  AND (:region = '' OR p.region = :region)
GROUP BY m.recommended_action
ORDER BY CASE m.recommended_action
  WHEN 'suspend' THEN 1 WHEN 'review_fraud' THEN 2 WHEN 'warn_toxicity' THEN 3
  WHEN 'review_cheating' THEN 4 WHEN 'retain' THEN 5 ELSE 6 END
