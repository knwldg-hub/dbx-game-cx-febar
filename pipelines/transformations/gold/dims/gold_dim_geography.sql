-- Gold dimension: one row per country with region and local currency
CREATE OR REFRESH MATERIALIZED VIEW gold_dim_geography (
  country  STRING COMMENT 'Two-letter ISO country code.',
  region   STRING COMMENT 'Derived region: Americas, EMEA, APAC.',
  currency STRING COMMENT 'ISO 4217 local currency code.'
)
COMMENT 'Geography dimension. One row per country with region and local currency mapping.'
AS SELECT
  country,
  CASE
    WHEN country IN ('US', 'CA', 'MX', 'BR', 'AR') THEN 'Americas'
    WHEN country IN ('GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL', 'SE') THEN 'EMEA'
    WHEN country IN ('JP', 'KR', 'AU', 'IN', 'PH') THEN 'APAC'
    ELSE 'Other'
  END AS region,
  CASE country
    WHEN 'US' THEN 'USD'  WHEN 'CA' THEN 'CAD'  WHEN 'MX' THEN 'MXN'
    WHEN 'BR' THEN 'BRL'  WHEN 'AR' THEN 'ARS'  WHEN 'GB' THEN 'GBP'
    WHEN 'DE' THEN 'EUR'  WHEN 'FR' THEN 'EUR'  WHEN 'ES' THEN 'EUR'
    WHEN 'IT' THEN 'EUR'  WHEN 'NL' THEN 'EUR'  WHEN 'PL' THEN 'PLN'
    WHEN 'SE' THEN 'SEK'  WHEN 'JP' THEN 'JPY'  WHEN 'KR' THEN 'KRW'
    WHEN 'AU' THEN 'AUD'  WHEN 'IN' THEN 'INR'  WHEN 'PH' THEN 'PHP'
    ELSE NULL
  END AS currency
FROM (
  SELECT DISTINCT country
  FROM silver_players
  WHERE country IS NOT NULL
);
