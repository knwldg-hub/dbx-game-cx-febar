-- Gold dimension: one row per game title
CREATE OR REFRESH MATERIALIZED VIEW gold_dim_game
COMMENT 'Game dimension. One row per Emberline Studios title.'
AS SELECT
  game_id,
  title,
  genre,
  platforms,
  monetization_model,
  launch_date,
  publisher
FROM silver_games;
