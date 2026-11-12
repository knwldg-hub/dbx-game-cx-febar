-- Silver: cleansed game catalog
CREATE OR REFRESH MATERIALIZED VIEW silver_games (
  game_id            STRING        COMMENT 'Title identifier (G01-G06).',
  title              STRING        COMMENT 'Game title name.',
  genre              STRING        COMMENT 'Game genre, e.g. battle royale, MMORPG, match-3.',
  platforms          ARRAY<STRING> COMMENT 'Platforms the title ships on.',
  monetization_model STRING        COMMENT 'Revenue model, e.g. free-to-play.',
  launch_date        DATE          COMMENT 'Title launch date.',
  publisher          STRING        COMMENT 'Publishing studio.',
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
