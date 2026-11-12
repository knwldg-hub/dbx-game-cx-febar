-- Gold dimension: one row per player with derived age_band and region
CREATE OR REFRESH MATERIALIZED VIEW gold_dim_player
COMMENT 'Player dimension. One row per player with age_band and region derived from silver.'
CLUSTER BY (country)
AS SELECT
  player_id,
  gamertag,
  email,
  date_of_birth,
  CASE
    WHEN age < 18  THEN '13-17'
    WHEN age < 25  THEN '18-24'
    WHEN age < 35  THEN '25-34'
    WHEN age < 45  THEN '35-44'
    ELSE '45+'
  END AS age_band,
  country,
  CASE
    WHEN country IN ('US', 'CA', 'MX', 'BR') THEN 'Americas'
    WHEN country IN ('GB', 'DE', 'FR', 'PL', 'SE', 'RU', 'TR') THEN 'EMEA'
    WHEN country IN ('JP', 'KR', 'AU', 'IN') THEN 'APAC'
    ELSE 'Other'
  END AS region,
  registration_date,
  acquisition_channel,
  signup_game_id
FROM silver_players;
