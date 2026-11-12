-- Gold dimension: one row per device
CREATE OR REFRESH MATERIALIZED VIEW gold_dim_device (
  device_id               STRING  COMMENT 'Device identifier.',
  player_id               STRING  COMMENT 'Player associated with this device.',
  device_type             STRING  COMMENT 'Form factor: mobile, pc, console.',
  platform                STRING  COMMENT 'OS/platform: iOS, Android, Windows, PlayStation, Xbox.',
  device_fingerprint      STRING  COMMENT 'Hardware fingerprint for fraud ring detection. PII: device identifier.',
  is_emulator             BOOLEAN COMMENT 'True if device is a software emulator — fraud signal.',
  is_rooted_or_jailbroken BOOLEAN COMMENT 'True if OS has been tampered with — fraud signal.',
  device_model            STRING  COMMENT 'Hardware model identifier.'
)
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
