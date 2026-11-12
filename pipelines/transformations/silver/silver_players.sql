-- Silver: cleansed player accounts with DQ expectations
CREATE OR REFRESH MATERIALIZED VIEW silver_players (
  CONSTRAINT pk_player_id        EXPECT (player_id IS NOT NULL)                                    ON VIOLATION DROP ROW,
  CONSTRAINT valid_email          EXPECT (email IS NULL OR email RLIKE '^[^@]+@[^@]+\\.[^@]+')      ,
  CONSTRAINT valid_reg_date       EXPECT (registration_date BETWEEN '2020-01-01' AND '2026-12-31')
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
