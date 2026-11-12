-- Silver: cleansed player accounts with DQ expectations
CREATE OR REFRESH MATERIALIZED VIEW silver_players (
  player_id           STRING  COMMENT 'Player identifier. PII: account identity.',
  gamertag            STRING  COMMENT 'Public display name (non-PII).',
  email               STRING  COMMENT 'Email address. PII: direct identifier.',
  phone_number        STRING  COMMENT 'Phone number. PII: direct identifier.',
  date_of_birth       DATE    COMMENT 'Date of birth. PII: quasi-identifier.',
  age                 INT     COMMENT 'Age in years at time of data extraction.',
  country             STRING  COMMENT 'Two-letter ISO registration country.',
  registration_date   DATE    COMMENT 'Account creation date.',
  signup_game_id      STRING  COMMENT 'First game the player registered into.',
  acquisition_channel STRING  COMMENT 'Marketing channel that drove signup.',
  account_status      STRING  COMMENT 'active | suspended | banned.',
  marketing_opt_in    BOOLEAN COMMENT 'True if the player opted into marketing emails.',
  CONSTRAINT pk_player_id   EXPECT (player_id IS NOT NULL)                                    ON VIOLATION DROP ROW,
  CONSTRAINT valid_email    EXPECT (email IS NOT NULL AND email RLIKE '^[^@]+@[^@]+\\.[^@]+') ,
  CONSTRAINT valid_reg_date EXPECT (registration_date BETWEEN '2020-01-01' AND '2026-12-31')
)
COMMENT 'Cleansed player account data. Null player_id rows dropped; invalid email and registration_date rows warned.'
AS SELECT
  CAST(player_id AS STRING)            AS player_id,
  gamertag,
  email,
  phone_number,
  CAST(date_of_birth AS DATE)          AS date_of_birth,
  CAST(age AS INT)                     AS age,
  country,
  CAST(registration_date AS DATE)      AS registration_date,
  signup_game_id,
  acquisition_channel,
  account_status,
  CAST(marketing_opt_in AS BOOLEAN)    AS marketing_opt_in
FROM bronze_account_players;
