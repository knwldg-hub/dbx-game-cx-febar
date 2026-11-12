-- Silver: cleansed game catalog
CREATE OR REFRESH MATERIALIZED VIEW silver_games (
  CONSTRAINT pk_game_id EXPECT (game_id IS NOT NULL) ON VIOLATION DROP ROW
)
COMMENT 'Cleansed game catalog. Null game_id rows dropped.'
AS SELECT
  game_id,
  title,
  genre,
  platforms,
  monetization_model,
  CAST(launch_date AS DATE) AS launch_date,
  publisher
FROM bronze_games;
