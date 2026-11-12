-- Gold dimension: one row per player with derived age_band and region
CREATE OR REFRESH MATERIALIZED VIEW gold_dim_player (
  player_id           STRING  COMMENT 'Player identifier. PII: account identity.',
  gamertag            STRING  COMMENT 'Public display name.',
  email               STRING  COMMENT 'Email address. PII: direct identifier.',
  date_of_birth       DATE    COMMENT 'Date of birth. PII: quasi-identifier.',
  age_band            STRING  COMMENT 'Age bracket: 13-17, 18-24, 25-34, 35-44, 45+.',
  country             STRING  COMMENT 'Two-letter ISO registration country.',
  region              STRING  COMMENT 'Derived region: Americas, EMEA, APAC.',
  registration_date   DATE    COMMENT 'Account creation date.',
  acquisition_channel STRING  COMMENT 'Marketing channel that drove signup.',
  signup_game_id      STRING  COMMENT 'First game the player registered into.'
)
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
    WHEN country IN ('US', 'CA', 'MX', 'BR', 'AR') THEN 'Americas'
    WHEN country IN ('GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL', 'SE') THEN 'EMEA'
    WHEN country IN ('JP', 'KR', 'AU', 'IN', 'PH') THEN 'APAC'
    ELSE 'Other'
  END AS region,
  registration_date,
  acquisition_channel,
  signup_game_id
FROM silver_players;
