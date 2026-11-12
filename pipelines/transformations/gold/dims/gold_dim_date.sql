-- Gold dimension: calendar date spine (2025-01-01 to 2026-12-31)
CREATE OR REFRESH MATERIALIZED VIEW gold_dim_date (
  date_key          INT     COMMENT 'Integer surrogate key YYYYMMDD.',
  date              DATE    COMMENT 'Calendar date.',
  week              INT     COMMENT 'ISO week number within the year.',
  month             INT     COMMENT 'Month number 1-12.',
  quarter           INT     COMMENT 'Quarter number 1-4.',
  year              INT     COMMENT 'Calendar year.',
  is_weekend        BOOLEAN COMMENT 'True for Saturday and Sunday.',
  is_holiday_season BOOLEAN COMMENT 'True for Dec 15 - Jan 5 (peak gaming season).',
  is_as_of_date     BOOLEAN COMMENT 'True for the simulated reference date 2026-12-31.'
)
COMMENT 'Date dimension. One row per day from 2025-01-01 to 2026-12-31. is_as_of_date marks the simulated reference date 2026-12-31.'
AS SELECT
  CAST(DATE_FORMAT(d, 'yyyyMMdd') AS INT) AS date_key,
  d AS date,
  WEEKOFYEAR(d)   AS week,
  MONTH(d)        AS month,
  QUARTER(d)      AS quarter,
  YEAR(d)         AS year,
  DAYOFWEEK(d) IN (1, 7) AS is_weekend,
  (MONTH(d) = 12 AND DAYOFMONTH(d) >= 15)
    OR (MONTH(d) = 1 AND DAYOFMONTH(d) <= 5) AS is_holiday_season,
  d = DATE '2026-12-31' AS is_as_of_date
FROM (
  SELECT EXPLODE(
    SEQUENCE(DATE '2025-01-01', DATE '2026-12-31', INTERVAL 1 DAY)
  ) AS d
);
