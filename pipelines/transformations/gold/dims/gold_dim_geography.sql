-- Gold dimension: one row per country with region and local currency
CREATE OR REFRESH MATERIALIZED VIEW gold_dim_geography
COMMENT 'Geography dimension. One row per country with region and local currency mapping.'
AS SELECT
  country,
  CASE
    WHEN country IN ('US', 'CA', 'MX', 'BR') THEN 'Americas'
    WHEN country IN ('GB', 'DE', 'FR', 'PL', 'SE', 'RU', 'TR') THEN 'EMEA'
    WHEN country IN ('JP', 'KR', 'AU', 'IN') THEN 'APAC'
    ELSE 'Other'
  END AS region,
  CASE country
    WHEN 'US' THEN 'USD'  WHEN 'CA' THEN 'CAD'  WHEN 'MX' THEN 'MXN'
    WHEN 'BR' THEN 'BRL'  WHEN 'GB' THEN 'GBP'  WHEN 'DE' THEN 'EUR'
    WHEN 'FR' THEN 'EUR'  WHEN 'PL' THEN 'PLN'  WHEN 'SE' THEN 'SEK'
    WHEN 'RU' THEN 'RUB'  WHEN 'TR' THEN 'TRY'  WHEN 'JP' THEN 'JPY'
    WHEN 'KR' THEN 'KRW'  WHEN 'AU' THEN 'AUD'  WHEN 'IN' THEN 'INR'
    ELSE 'USD'
  END AS currency
FROM (
  SELECT DISTINCT country
  FROM silver_players
  WHERE country IS NOT NULL
);
