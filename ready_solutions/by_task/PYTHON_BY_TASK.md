# Python: task-by-task solutions

```python
import math
import time
from datetime import datetime
from functools import lru_cache, wraps
```

## Task 1. DataKeeper

```python
class DataKeeper:
    def __init__(self, source):
        self.source = list(source)
        self.distinct = []

        for number in self.source:
            if number not in self.distinct:
                self.distinct.append(number)

    @property
    def sum_distinct(self):
        return sum(self.distinct)

    @staticmethod
    def calc_average(instance):
        if len(instance.distinct) == 0:
            return 0

        return sum(instance.distinct) / len(instance.distinct)

    @classmethod
    def from_comma_string(cls, text):
        numbers = []

        for part in text.split(","):
            part = part.strip()

            if part:
                numbers.append(int(part))

        return cls(numbers)

    def __len__(self):
        return len(self.distinct)
```

## Task 2. Lucas sequence

```python
def generate_sequence(n):
    first = 2
    second = 1

    for _ in range(n):
        yield first
        first, second = second, first + second

def lucas_recursive(k):
    if k == 0:
        return 2

    if k == 1:
        return 1

    return lucas_recursive(k - 1) + lucas_recursive(k - 2)


@lru_cache(None)

def lucas_memo(k):
    if k == 0:
        return 2

    if k == 1:
        return 1

    return lucas_memo(k - 1) + lucas_memo(k - 2)

def compare_lucas_performance(n):
    start = time.perf_counter()
    list(generate_sequence(n))
    print("generator:", round((time.perf_counter() - start) * 1000, 3), "ms")

    start = time.perf_counter()
    [lucas_recursive(i) for i in range(n)]
    print("recursive:", round((time.perf_counter() - start) * 1000, 3), "ms")

    start = time.perf_counter()
    [lucas_memo(i) for i in range(n)]
    print("memo:", round((time.perf_counter() - start) * 1000, 3), "ms")
```

## Task 3. TableMapper

```python
class TableMapper:
    def __init__(self, rows):
        self.rows = rows or []

        if len(self.rows) == 0:
            self.fields = []
            self.data = []
        else:
            self.fields = self.rows[0]
            self.data = self.rows[1:]

    def __iter__(self):
        for row in self.data:
            if not row:
                continue

            if len(row) < len(self.fields):
                continue

            yield dict(zip(self.fields, row))
```

## Task 4. process_time_series

```python
def process_time_series(records):
    prepared = []

    for record in records:
        date = datetime.strptime(record["dt"], "%Y-%m-%d")

        new_record = dict(record)
        new_record["yr"] = date.year
        new_record["mo"] = date.month
        new_record["dy"] = date.day

        prepared.append(new_record)

    groups = {}

    for record in prepared:
        group_name = record["group"]

        if group_name not in groups:
            groups[group_name] = []

        groups[group_name].append(record)

    result = []

    for group_records in groups.values():
        group_records.sort(key=lambda item: item["dt"])

        for index in range(len(group_records)):
            current = dict(group_records[index])
            current["rolling_avg"] = None

            if 0 < index < len(group_records) - 1:
                previous_amount = group_records[index - 1]["amount"]
                current_amount = group_records[index]["amount"]
                next_amount = group_records[index + 1]["amount"]

                current["rolling_avg"] = (
                    previous_amount + current_amount + next_amount
                ) / 3

            result.append(current)

    return result
```

## Task 5. trace_calls and extract_unique

```python
def trace_calls(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        end = time.perf_counter()

        print("function:", func.__name__)
        print("args:", args)
        print("kwargs:", kwargs)
        print("result:", result)
        print("time:", round((end - start) * 1000, 3), "ms")

        return result

    return wrapper


@trace_calls

def extract_unique(lst):
    counts = {}

    for number in lst:
        if number not in counts:
            counts[number] = 0

        counts[number] += 1

    result = []

    for number in lst:
        if counts[number] == 1:
            result.append(number)

    return result
```

## Task 6. Figure classes

```python
class Figure:
    def get_area(self):
        return 0

class Square(Figure):
    def __init__(self, side):
        self.side = side

    def get_area(self):
        return self.side ** 2

class Disk(Figure):
    def __init__(self, radius):
        self.radius = radius

    def get_area(self):
        return math.pi * self.radius ** 2

class RightTriangle(Figure):
    def __init__(self, a, b):
        self.a = a
        self.b = b

    def get_area(self):
        return self.a * self.b / 2

def sum_areas(figures):
    total = 0

    for figure in figures:
        total += figure.get_area()

    return total
```

## Task 7. deep_flatten

```python
def deep_flatten(source, prefix=""):
    result = {}

    if isinstance(source, dict):
        items = source.items()
    elif isinstance(source, list):
        items = enumerate(source)
    else:
        result[prefix] = source
        return result

    for key, value in items:
        if prefix:
            new_key = prefix + "." + str(key)
        else:
            new_key = str(key)

        if isinstance(value, dict) or isinstance(value, list):
            nested = deep_flatten(value, new_key)
            result.update(nested)
        else:
            result[new_key] = value

    return result
```

## Task 8. FileWriter

```python
class FileWriter:
    def __init__(self, path):
        self.path = path
        self.file = None
        self.bytes_written = 0

    def __enter__(self):
        self.file = open(self.path, "w", encoding="utf-8")
        return self

    def write(self, text):
        self.file.write(text)
        self.bytes_written += len(text.encode("utf-8"))

    def __exit__(self, exc_type, exc, tb):
        if exc is not None:
            self.write("Ошибка: " + str(exc) + "\n")

        self.file.close()
        print("Записано байт:", self.bytes_written)

        return False
```

## Task 9. validate_and_compute

```python
def validate_and_compute(input_dict):
    values = input_dict.get("values")
    mode = input_dict.get("mode")

    if not isinstance(values, list):
        return {"status": "fail", "message": "values должен быть списком"}

    if len(values) == 0:
        return {"status": "fail", "message": "values не должен быть пустым"}

    for value in values:
        if not isinstance(value, int):
            return {"status": "fail", "message": "в values должны быть целые числа"}

    if mode not in ["sum", "avg", "max", "min"]:
        return {"status": "fail", "message": "неверный mode"}

    if mode == "sum":
        result = sum(values)
    elif mode == "avg":
        result = sum(values) / len(values)
    elif mode == "max":
        result = max(values)
    else:
        result = min(values)

    return {"status": "ok", "result": result}
```

## Task 10. GridAnalyzer

```python
class GridAnalyzer:
    def __init__(self, grid):
        self.grid = grid

    def fetch_row(self, i):
        if i < 0 or i >= len(self.grid):
            print("Некорректный индекс строки")
            return None

        return self.grid[i]

    def fetch_col(self, j):
        result = []

        for row in self.grid:
            if j < 0 or j >= len(row):
                print("Некорректный индекс столбца")
                return None

            result.append(row[j])

        return result

    def find_max(self):
        maximum = self.grid[0][0]

        for row in self.grid:
            for value in row:
                if value > maximum:
                    maximum = value

        return maximum

    def find_min(self):
        minimum = self.grid[0][0]

        for row in self.grid:
            for value in row:
                if value < minimum:
                    minimum = value

        return minimum

    def create_transpose(self):
        result = []
        rows_count = len(self.grid)
        columns_count = len(self.grid[0])

        for column_index in range(columns_count):
            new_row = []

            for row_index in range(rows_count):
                new_row.append(self.grid[row_index][column_index])

            result.append(new_row)

        return result
```
