# SQL: task-by-task solutions

## Task 1

```sql
-- 1. Топ-3 городов, где опубликовано больше всего книг.
SELECT p.city, COUNT(*) AS books_count
FROM book b JOIN publisher p ON p.id = b.id_publisher
GROUP BY p.city
ORDER BY books_count DESC
LIMIT 3;
```

## Task 2

```sql
-- 2. Автор, написавший больше всех книг, и количество его книг.
SELECT a.last_name, a.first_name, COUNT(*) AS books_count
FROM book b JOIN author a ON a.id = b.id_author
GROUP BY a.id, a.last_name, a.first_name
ORDER BY books_count DESC
LIMIT 1;
```

## Task 3

```sql
-- 3. Книга с самым большим тиражом. Тираж = количество экземпляров.
SELECT b.title, COUNT(be.id) AS copies_count
FROM book b JOIN book_exemplar be ON be.id_book = b.id
GROUP BY b.id, b.title
ORDER BY copies_count DESC
LIMIT 1;
```

## Task 4

```sql
-- 4. Топ-3 книг по количеству экземпляров.
SELECT b.title, COUNT(be.id) AS copies_count
FROM book b JOIN book_exemplar be ON be.id_book = b.id
GROUP BY b.id, b.title
ORDER BY copies_count DESC
LIMIT 3;
```

## Task 5

```sql
-- 5. Книга, опубликованная последней.
SELECT title, year_publish
FROM book
ORDER BY year_publish DESC
LIMIT 1;

-- Дополнительно по базе repa: невозвращенные автомобили.
SELECT r.id, v.plate_number, c.last_name, c.first_name, r.start_date, r.end_date
FROM rental r
JOIN vehicle v ON v.id = r.id_vehicle
JOIN client c ON c.id = r.id_client
WHERE r.fact_return IS NULL;

-- Топ клиентов по количеству аренд.
SELECT c.last_name, c.first_name, COUNT(*) AS rentals_count
FROM rental r JOIN client c ON c.id = r.id_client
GROUP BY c.id, c.last_name, c.first_name
ORDER BY rentals_count DESC
LIMIT 10;
```
