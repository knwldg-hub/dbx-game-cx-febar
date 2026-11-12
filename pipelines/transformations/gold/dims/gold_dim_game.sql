-- Gold dimension: one row per game title
CREATE OR REFRESH MATERIALIZED VIEW gold_dim_game (
  game_id            STRING        COMMENT 'Title identifier (G01-G06). Join key to all facts.',
  title              STRING        COMMENT 'Game title name, e.g. Iron Vanguard.',
  genre              STRING        COMMENT 'Game genre, e.g. battle royale, MMORPG, match-3.',
  platforms          ARRAY<STRING> COMMENT 'Array of platforms the title ships on.',
  monetization_model STRING        COMMENT 'How the title earns revenue, e.g. free-to-play.',
  launch_date        DATE          COMMENT 'Title launch date.',
  publisher          STRING        COMMENT 'Publishing studio (Emberline Studios).'
)
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
