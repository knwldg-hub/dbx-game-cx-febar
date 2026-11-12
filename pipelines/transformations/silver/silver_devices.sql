-- Silver: cleansed device registry
CREATE OR REFRESH MATERIALIZED VIEW silver_devices (
  CONSTRAINT pk_device_id   EXPECT (device_id IS NOT NULL)   ON VIOLATION DROP ROW,
  CONSTRAINT fk_player_id   EXPECT (player_id IS NOT NULL)   ON VIOLATION DROP ROW
)
COMMENT 'Cleansed device registry. Null device_id or player_id rows dropped.'
AS SELECT
  device_id,
  CAST(player_id AS STRING)              AS player_id,
  device_type,
  platform,
  device_fingerprint,
  CAST(is_emulator AS BOOLEAN)           AS is_emulator,
  CAST(is_rooted_or_jailbroken AS BOOLEAN) AS is_rooted_or_jailbroken,
  device_model,
  CAST(first_seen_date AS DATE) AS first_seen_date
FROM bronze_telemetry_devices;
