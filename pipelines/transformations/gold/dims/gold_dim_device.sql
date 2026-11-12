-- Gold dimension: one row per device
CREATE OR REFRESH MATERIALIZED VIEW gold_dim_device
COMMENT 'Device dimension. One row per device with platform, fingerprint and fraud-relevant flags.'
AS SELECT
  device_id,
  player_id,
  device_type,
  platform,
  device_fingerprint,
  is_emulator,
  is_rooted_or_jailbroken,
  device_model
FROM silver_devices;
