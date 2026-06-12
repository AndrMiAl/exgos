# SQL

## Задание_1

**Условие:**

Для каждого клиента, который хотя бы раз брал авто в аренду, проведите анализ дисциплины аренды.

Для каждого такого клиента определите:

- общее количество арендованных авто;
- количество авто, возвращённых в срок;
- количество авто, возвращённых с нарушением срока;
- количество авто, не возвращённых до настоящего момента;
- штрафной показатель: каждое нарушение срока даёт 2 балла, каждая невозвращённая машина даёт 5 баллов;
- ранг клиента по дисциплине: меньший штраф выше, при равных штрафах ранг одинаковый;
- количество различных поставщиков `supplier`, с которыми связаны арендованные авто.

Включите в отчёт только тех клиентов, у которых штрафной показатель больше нуля ИЛИ общее количество арендованных авто не менее трёх.

**Решение:**

```sql
WITH client_stats AS (
    SELECT
        c.id,
        c.last_name,
        c.first_name,
        c.middle_name,
        COUNT(r.id) AS total_rentals,
        SUM(CASE
            WHEN r.fact_return IS NOT NULL
             AND r.fact_return <= r.end_date THEN 1
            ELSE 0
        END) AS returned_on_time,
        SUM(CASE
            WHEN r.fact_return IS NOT NULL
             AND r.fact_return > r.end_date THEN 1
            ELSE 0
        END) AS returned_late,
        SUM(CASE
            WHEN r.fact_return IS NULL THEN 1
            ELSE 0
        END) AS not_returned,
        COUNT(DISTINCT cm.id_supplier) AS suppliers_count
    FROM client c
    JOIN rental r ON r.id_client = c.id
    JOIN vehicle v ON v.id = r.id_vehicle
    JOIN carmodel cm ON cm.id = v.id_carmodel
    GROUP BY c.id, c.last_name, c.first_name, c.middle_name
),
penalties AS (
    SELECT
        cs1.id,
        cs1.last_name,
        cs1.first_name,
        cs1.middle_name,
        cs1.total_rentals,
        cs1.returned_on_time,
        cs1.returned_late,
        cs1.not_returned,
        cs1.returned_late * 2 + cs1.not_returned * 5 AS penalty_score,
        COUNT(DISTINCT cs2.returned_late * 2 + cs2.not_returned * 5) + 1 AS discipline_rank,
        cs1.suppliers_count
    FROM client_stats cs1
    LEFT JOIN client_stats cs2
      ON cs2.returned_late * 2 + cs2.not_returned * 5
         < cs1.returned_late * 2 + cs1.not_returned * 5
    GROUP BY
        cs1.id,
        cs1.last_name,
        cs1.first_name,
        cs1.middle_name,
        cs1.total_rentals,
        cs1.returned_on_time,
        cs1.returned_late,
        cs1.not_returned,
        cs1.suppliers_count
)
SELECT
    last_name,
    first_name,
    middle_name,
    total_rentals,
    returned_on_time,
    returned_late,
    not_returned,
    penalty_score,
    discipline_rank,
    suppliers_count
FROM penalties
WHERE penalty_score > 0
   OR total_rentals >= 3
ORDER BY discipline_rank, last_name, first_name;
```

## Задание_2

**Условие:**

Найдите все пары клиентов, которые арендовали один и тот же автомобиль, то есть один VIN, и периоды их аренды пересекаются.

Пересечение означает, что второй клиент получил авто до того, как первый его вернул. Если первый клиент ещё не вернул авто, считайте, что он продолжает его удерживать до текущей даты `2026-06-09`.

Для каждой такой пары выведите:

- ФИО обоих клиентов;
- VIN-номер;
- модель авто;
- дату аренды первому клиенту;
- дату аренды второму клиенту.

Исключите пары, где клиент совпадает сам с собой.

**Решение:**

```sql
SELECT
    c1.last_name || ' ' || c1.first_name || ' ' || COALESCE(c1.middle_name, '') AS first_client,
    c2.last_name || ' ' || c2.first_name || ' ' || COALESCE(c2.middle_name, '') AS second_client,
    v.vin_number,
    cm.model_name,
    r1.start_date AS first_client_start,
    r2.start_date AS second_client_start
FROM rental r1
JOIN rental r2
    ON r1.id_vehicle = r2.id_vehicle
   AND r1.id_client <> r2.id_client
   AND r1.id < r2.id
JOIN client c1 ON c1.id = r1.id_client
JOIN client c2 ON c2.id = r2.id_client
JOIN vehicle v ON v.id = r1.id_vehicle
JOIN carmodel cm ON cm.id = v.id_carmodel
WHERE r1.start_date <= COALESCE(r2.fact_return, DATE('2026-06-09'))
  AND r2.start_date <= COALESCE(r1.fact_return, DATE('2026-06-09'))
ORDER BY v.vin_number, first_client, second_client;
```

## Задание_3

**Условие:**

Для каждого дня в период с `2024-03-01` по `2024-04-30` определите:

- количество аренд, совершённых в этот день;
- скользящее среднее количество аренд за последние 7 дней, включая текущий день;
- скользящее среднее количество аренд за последние 30 дней.

Дополнительно отметьте дни, в которых количество аренд более чем в два раза превышает среднее значение за последние 7 дней.

**Решение:**

```sql
WITH RECURSIVE days AS (
    SELECT DATE('2024-03-01') AS day_date
    UNION ALL
    SELECT DATEADD(day, 1, day_date)
    FROM days
    WHERE day_date < DATE('2024-04-30')
),
daily_rentals AS (
    SELECT
        d.day_date,
        COUNT(r.id) AS rentals_count
    FROM days d
    LEFT JOIN rental r
        ON r.start_date = d.day_date
    GROUP BY d.day_date
),
avg_7 AS (
    SELECT
        d1.day_date,
        ROUND(AVG(d2.rentals_count), 2) AS avg_last_7_days
    FROM daily_rentals d1
    JOIN daily_rentals d2
      ON d2.day_date BETWEEN DATEADD(day, -6, d1.day_date) AND d1.day_date
    GROUP BY d1.day_date
),
avg_30 AS (
    SELECT
        d1.day_date,
        ROUND(AVG(d2.rentals_count), 2) AS avg_last_30_days
    FROM daily_rentals d1
    JOIN daily_rentals d2
      ON d2.day_date BETWEEN DATEADD(day, -29, d1.day_date) AND d1.day_date
    GROUP BY d1.day_date
)
SELECT
    d.day_date,
    d.rentals_count,
    a7.avg_last_7_days,
    a30.avg_last_30_days,
    CASE
        WHEN d.rentals_count > 2 * a7.avg_last_7_days
        THEN 'YES'
        ELSE 'NO'
    END AS is_peak_day
FROM daily_rentals d
JOIN avg_7 a7 ON a7.day_date = d.day_date
JOIN avg_30 a30 ON a30.day_date = d.day_date
ORDER BY d.day_date;
```

## Задание_4

**Условие:**

Найдите клиентов, которые за всё время арендовали автомобили только одного производителя `manufacturer`.

Для каждого такого клиента укажите:

- название производителя;
- общее количество арендованных авто;
- количество различных моделей этого производителя, которые были арендованы.

Исключите из отчёта клиентов, у которых всего одна аренда.

Автомобили без указания производителя не учитываются при определении “только одного производителя”.

**Решение:**

```sql
SELECT
    c.last_name,
    c.first_name,
    c.middle_name,
    MIN(m.name) AS manufacturer_name,
    COUNT(*) AS total_rentals,
    COUNT(DISTINCT cm.id) AS different_models_count
FROM client c
JOIN rental r ON r.id_client = c.id
JOIN vehicle v ON v.id = r.id_vehicle
JOIN carmodel cm ON cm.id = v.id_carmodel
JOIN manufacturer m ON m.id = cm.id_manufacturer
GROUP BY c.id, c.last_name, c.first_name, c.middle_name
HAVING COUNT(*) > 1
   AND COUNT(DISTINCT m.id) = 1
ORDER BY c.last_name, c.first_name;
```

## Задание_5

**Условие:**

Для каждого поставщика `supplier` выведите:

- общее количество автомобилей, связанных с этим поставщиком;
- количество различных моделей, поставляемых поставщиком;
- количество автомобилей, которые никогда не сдавались в аренду;
- долю таких автомобилей в процентах от общего числа.

**Решение:**

```sql
WITH vehicle_stats AS (
    SELECT
        s.id,
        s.name AS supplier_name,
        cm.id AS model_id,
        v.id AS vehicle_id,
        MAX(CASE
            WHEN r.id IS NULL THEN 0
            ELSE 1
        END) AS was_rented
    FROM supplier s
    LEFT JOIN carmodel cm ON cm.id_supplier = s.id
    LEFT JOIN vehicle v ON v.id_carmodel = cm.id
    LEFT JOIN rental r ON r.id_vehicle = v.id
    GROUP BY s.id, s.name, cm.id, v.id
)
SELECT
    supplier_name,
    COUNT(DISTINCT vehicle_id) AS total_vehicles,
    COUNT(DISTINCT model_id) AS different_models,
    SUM(CASE
        WHEN was_rented = 0 AND vehicle_id IS NOT NULL THEN 1
        ELSE 0
    END) AS never_rented_vehicles,
    ROUND(
        100.0 * SUM(CASE
            WHEN was_rented = 0 AND vehicle_id IS NOT NULL THEN 1
            ELSE 0
        END) / NULLIF(COUNT(DISTINCT vehicle_id), 0),
        2
    ) AS never_rented_percent
FROM vehicle_stats
GROUP BY id, supplier_name
ORDER BY supplier_name;
```

## Задание_6

**Условие:**

Найдите клиентов, у которых в настоящий момент есть хотя бы один невозвращённый автомобиль и при этом ни одной аренды за всё время не было возвращено вовремя.

То есть каждая аренда либо ещё не завершена, либо завершена с опозданием.

Для каждого такого клиента выведите:

- общее количество аренд;
- количество невозвращённых авто;
- количество возвращённых с опозданием.

**Решение:**

```sql
SELECT
    c.last_name,
    c.first_name,
    c.middle_name,
    COUNT(r.id) AS total_rentals,
    SUM(CASE
        WHEN r.fact_return IS NULL THEN 1
        ELSE 0
    END) AS not_returned,
    SUM(CASE
        WHEN r.fact_return IS NOT NULL
         AND r.fact_return > r.end_date THEN 1
        ELSE 0
    END) AS returned_late
FROM client c
JOIN rental r ON r.id_client = c.id
GROUP BY c.id, c.last_name, c.first_name, c.middle_name
HAVING SUM(CASE
           WHEN r.fact_return IS NULL THEN 1
           ELSE 0
       END) > 0
   AND SUM(CASE
           WHEN r.fact_return IS NOT NULL
            AND r.fact_return <= r.end_date THEN 1
           ELSE 0
       END) = 0
ORDER BY c.last_name, c.first_name;
```

## Задание_7

**Условие:**

Для каждого автомобиля `vehicle` вычислите:

- среднюю продолжительность аренды в днях;
- минимальную продолжительность аренды в днях;
- максимальную продолжительность аренды в днях.

Считать нужно только завершённые аренды. Продолжительность аренды равна разнице между фактической датой возврата и датой выдачи.

Если по автомобилю нет ни одной завершённой аренды, выведите пустое значение.

**Решение:**

```sql
SELECT
    v.id,
    v.vin_number,
    cm.model_name,
    ROUND(AVG(r.fact_return - r.start_date), 2) AS avg_duration_days,
    MIN(r.fact_return - r.start_date) AS min_duration_days,
    MAX(r.fact_return - r.start_date) AS max_duration_days
FROM vehicle v
JOIN carmodel cm ON cm.id = v.id_carmodel
LEFT JOIN rental r
    ON r.id_vehicle = v.id
   AND r.fact_return IS NOT NULL
GROUP BY v.id, v.vin_number, cm.model_name
ORDER BY v.id;
```

## Задание_8

**Условие:**

Определите пять самых популярных моделей авто по общему количеству аренд.

Для каждой модели укажите:

- общее количество аренд;
- количество уникальных клиентов, арендовавших эту модель;
- среднюю продолжительность аренды этой модели по завершённым арендам;
- клиента, который арендовал эту модель чаще всех.

Если таких клиентов несколько, можно вывести любого.

**Решение:**

```sql
WITH model_stats AS (
    SELECT
        cm.id,
        cm.model_name,
        COUNT(r.id) AS total_rentals,
        COUNT(DISTINCT r.id_client) AS unique_clients,
        ROUND(AVG(CASE
            WHEN r.fact_return IS NOT NULL THEN r.fact_return - r.start_date
            ELSE NULL
        END), 2) AS avg_duration_days
    FROM carmodel cm
    JOIN vehicle v ON v.id_carmodel = cm.id
    JOIN rental r ON r.id_vehicle = v.id
    GROUP BY cm.id, cm.model_name
),
top_models AS (
    SELECT *
    FROM model_stats
    ORDER BY total_rentals DESC
    LIMIT 5
),
client_rank AS (
    SELECT
        cm.id AS model_id,
        c.last_name,
        c.first_name,
        c.middle_name,
        COUNT(*) AS rentals_by_client,
        ROW_NUMBER() OVER (
            PARTITION BY cm.id
            ORDER BY COUNT(*) DESC
        ) AS rn
    FROM carmodel cm
    JOIN vehicle v ON v.id_carmodel = cm.id
    JOIN rental r ON r.id_vehicle = v.id
    JOIN client c ON c.id = r.id_client
    GROUP BY cm.id, c.id, c.last_name, c.first_name, c.middle_name
)
SELECT
    tm.model_name,
    tm.total_rentals,
    tm.unique_clients,
    tm.avg_duration_days,
    cr.last_name || ' ' || cr.first_name || ' ' || COALESCE(cr.middle_name, '') AS top_client
FROM top_models tm
LEFT JOIN client_rank cr
    ON cr.model_id = tm.id
   AND cr.rn = 1
ORDER BY tm.total_rentals DESC, tm.model_name;
```

## Задание_9

**Условие:**

Для каждого производителя `manufacturer` выведите:

- среднее количество мест `seats_count` по всем моделям производителя;
- количество моделей, выпущенных этим производителем;
- название модели с максимальным количеством мест среди моделей этого производителя.

**Решение:**

```sql
WITH ranked_models AS (
    SELECT
        m.id,
        m.name AS manufacturer_name,
        cm.model_name,
        cm.seats_count,
        ROW_NUMBER() OVER (
            PARTITION BY m.id
            ORDER BY cm.seats_count DESC, cm.model_name
        ) AS rn
    FROM manufacturer m
    JOIN carmodel cm ON cm.id_manufacturer = m.id
)
SELECT
    rm.manufacturer_name,
    ROUND(AVG(rm.seats_count), 2) AS avg_seats_count,
    COUNT(*) AS models_count,
    MAX(CASE WHEN rm.rn = 1 THEN rm.model_name END) AS max_seats_model
FROM ranked_models rm
GROUP BY rm.id, rm.manufacturer_name
ORDER BY rm.manufacturer_name;
```

## Задание_10

**Условие:**

Для каждого клиента найдите самую длинную непрерывную серию аренд, в которой интервал между датами аренды соседних авто в серии не превышает 7 дней.

Если у клиента есть несколько серий с одинаковой максимальной длиной, выберите самую позднюю по дате начала.

Для каждой такой серии выведите:

- длину серии;
- дату начала серии;
- дату окончания серии;
- список названий моделей в порядке аренды через запятую.

**Решение:**

```sql
WITH ordered_rentals AS (
    SELECT
        r.id,
        r.id_client,
        r.start_date,
        cm.model_name,
        MAX(prev.start_date) AS prev_start_date
    FROM rental r
    JOIN vehicle v ON v.id = r.id_vehicle
    JOIN carmodel cm ON cm.id = v.id_carmodel
    LEFT JOIN rental prev
      ON prev.id_client = r.id_client
     AND prev.start_date < r.start_date
    GROUP BY r.id, r.id_client, r.start_date, cm.model_name
),
marked_groups AS (
    SELECT
        *,
        CASE
            WHEN prev_start_date IS NULL THEN 1
            WHEN start_date - prev_start_date > 7 THEN 1
            ELSE 0
        END AS new_group_flag
    FROM ordered_rentals
),
grouped_rentals AS (
    SELECT
        *,
        SUM(new_group_flag) OVER (
            PARTITION BY id_client
            ORDER BY start_date
        ) AS group_id
    FROM marked_groups
),
series_stats AS (
    SELECT
        id_client,
        group_id,
        COUNT(*) AS series_length,
        MIN(start_date) AS series_start,
        MAX(start_date) AS series_end
    FROM grouped_rentals
    GROUP BY id_client, group_id
),
series_models AS (
    SELECT
        ordered_groups.id_client,
        ordered_groups.group_id,
        REPLACE(GROUP_CONCAT(ordered_groups.model_name), ',', ', ') AS models_list
    FROM (
        SELECT
            id_client,
            group_id,
            model_name,
            start_date
        FROM grouped_rentals
        ORDER BY id_client, group_id, start_date
    ) AS ordered_groups
    GROUP BY ordered_groups.id_client, ordered_groups.group_id
),
ranked_series AS (
    SELECT
        ss.*,
        sm.models_list,
        ROW_NUMBER() OVER (
            PARTITION BY ss.id_client
            ORDER BY series_length DESC, series_start DESC
        ) AS rn
    FROM series_stats ss
    JOIN series_models sm
      ON sm.id_client = ss.id_client
     AND sm.group_id = ss.group_id
)
SELECT
    c.last_name,
    c.first_name,
    c.middle_name,
    rs.series_length,
    rs.series_start,
    rs.series_end,
    rs.models_list
FROM ranked_series rs
JOIN client c ON c.id = rs.id_client
WHERE rs.rn = 1
ORDER BY c.last_name, c.first_name;
```
