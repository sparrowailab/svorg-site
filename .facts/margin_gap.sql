-- Ozon-юнит: маржа «как в обычном калькуляторе» против реальной.
-- Только чтение, на выходе одни агрегаты, без данных селлеров.
-- «Обычная» = (цена − комиссия Ozon − себестоимость) / цена.
-- «Реальная» = прибыль на единицу после всех 18 статей (weighted_profit,
--   хранится в profit_moscow для расчётов unit_economics) / цена.
-- Берём последний расчёт по каждому товару каждого селлера, чтобы
-- пересчёты одного товара не перевешивали.
-- Запуск: ssh ozon-kz "docker exec -i ozon-calculator-db-1 psql -U postgres -d ozon_calculator" < margin_gap.sql
WITH last_calc AS (
  SELECT DISTINCT ON (c.user_id, COALESCE(c.user_product_id::text, lower(c.product_name) || '|' || c.sku))
         c.user_id, c.price, c.cogs, c.commission_rate, c.profit_moscow, c.created_at
  FROM calculations_calculation c
  WHERE c.calculation_type = 'unit_economics'
    AND c.price > 0
    AND c.user_id IS NOT NULL
  ORDER BY c.user_id, COALESCE(c.user_product_id::text, lower(c.product_name) || '|' || c.sku), c.created_at DESC
), m AS (
  SELECT user_id, created_at,
         (price - price * commission_rate - cogs) / price AS naive,
         profit_moscow / price                          AS real
  FROM last_calc
)
SELECT count(*)                                                                      AS products,
       count(DISTINCT user_id)                                                       AS sellers,
       round(100 * (percentile_cont(0.5)  WITHIN GROUP (ORDER BY naive))::numeric, 1) AS naive_median_pct,
       round(100 * (percentile_cont(0.5)  WITHIN GROUP (ORDER BY real))::numeric, 1)  AS real_median_pct,
       round(100 * (percentile_cont(0.25) WITHIN GROUP (ORDER BY naive))::numeric, 1) AS naive_p25,
       round(100 * (percentile_cont(0.75) WITHIN GROUP (ORDER BY naive))::numeric, 1) AS naive_p75,
       round(100 * (percentile_cont(0.25) WITHIN GROUP (ORDER BY real))::numeric, 1)  AS real_p25,
       round(100 * (percentile_cont(0.75) WITHIN GROUP (ORDER BY real))::numeric, 1)  AS real_p75,
       round(100 * (percentile_cont(0.5)  WITHIN GROUP (ORDER BY naive - real))::numeric, 1) AS gap_median_pp,
       round(100.0 * avg((real < 0)::int), 1)                AS pct_loss,
       round(100.0 * avg((naive > 0 AND real < 0)::int), 1)  AS pct_looked_profitable_but_loss,
       round(100.0 * avg((real < naive / 2)::int), 1)        AS pct_real_less_than_half,
       min(created_at)::date AS from_date,
       now()::date           AS on_date
FROM m
WHERE naive BETWEEN -1 AND 1
  AND real  BETWEEN -2 AND 1;

-- Сколько селлеров «оцифровали бизнес»: подключили Ozon API и получают данные
-- (P&L по дням, остатки, реклама). Тоже только агрегаты.
SELECT (SELECT count(DISTINCT user_id) FROM analytics_ozoncredentials WHERE is_valid)          AS api_connected,
       (SELECT count(DISTINCT user_id) FROM analytics_dailypnl)                                AS with_pnl,
       (SELECT count(DISTINCT user_id) FROM analytics_stocklevel)                              AS with_stock,
       (SELECT count(DISTINCT user_id) FROM analytics_advertisingexpense)                      AS with_ads,
       (SELECT count(DISTINCT user_id) FROM calculations_calculation)                          AS ever_calculated,
       (SELECT count(*) FROM calculations_calculation)                                         AS calculations_total;
