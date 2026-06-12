# Algorithms

## Задание_1

**Условие:**

Задача 1. Ближайшая большая высота
Условие:
Дан массив целых чисел heights, где heights[i] — высота здания в i-м квартале.
Реализуйте функцию:
python
def next_greater_height(heights: list[int]) -> list[int]
Функция возвращает массив answer, где answer[i] — количество кварталов, которое нужно проехать от i-го квартала, чтобы встретить здание строго большей высоты. Если такого здания нет — -1.
Ограничения:
Длина массива: 1 ≤ n ≤ 10^5
Высоты: 1 ≤ h ≤ 1000
Пример:
python
heights = [50, 60, 55, 70, 65, 45, 80, 40]
# Ожидаемый результат: [1, 2, 1, 4, 2, 1, -1, -1]
Пояснение:
50 → 60 (через 1) → 1
60 → 70 (через 2) → 2
55 → 70 (через 1) → 1
70 → 80 (через 4) → 4
65 → 80 (через 2) → 2
45 → 80 (через 1) → 1
80 → нет → -1
40 → нет → -1
Требования:
Указать сложность O-большое
Алгоритмическая парадигма: монотонный стек

**Решение:**

```python
def next_greater_height(heights):
    answer = [-1] * len(heights)
    stack = []

    for current_index in range(len(heights)):
        current_height = heights[current_index]

        while stack and heights[stack[-1]] < current_height:
            previous_index = stack.pop()
            answer[previous_index] = current_index - previous_index

        stack.append(current_index)

    return answer
```

## Задание_2

**Условие:**

Задача 2. Самый частотный символ (без учёта регистра)
Условие:
Дана строка s, содержащая буквы латинского алфавита, цифры и пробелы.
Реализуйте функцию:
python
def max_freq_char_sum(s: str) -> int
Функция возвращает суммарное количество вхождений всех символов (игнорируя регистр: 'A' и 'a' считаются одним символом), частота которых максимальна. Небуквенные символы не учитываются.
Определения:
Частота символа = количество его вхождений в строке (без учёта регистра)
max_freq = максимальная частота среди всех букв
Нужно найти все буквы с частотой = max_freq и сложить их частоты
Ограничения:
Длина строки: 0 ≤ len(s) ≤ 10^5
Символы: латиница (a-z, A-Z), цифры, пробелы
Примеры:
python
s = "a A b B c C d D D"
# Буквы: a(2), b(2), c(2), d(3)
# max_freq = 3 (буква d)
# Результат: 3
s = "Hello HELLO hello"
# h(3), e(3), l(6), o(3)
# max_freq = 6 (буква l)
# Результат: 6
s = "abc123 ABC"
# a(2), b(2), c(2)
# max_freq = 2
# Результат: 2+2+2 = 6
Требования:
Сложность O(n) по времени, O(k) по памяти (k — количество уникальных букв)
Запрещено использовать collections.Counter (но можно реализовать свой подсчёт)

**Решение:**

```python
def max_freq_char_sum(s):
    frequencies = {}

    for char in s.lower():
        if "a" <= char <= "z":
            if char not in frequencies:
                frequencies[char] = 0
            frequencies[char] += 1

    if not frequencies:
        return 0

    max_frequency = max(frequencies.values())
    result = 0

    for frequency in frequencies.values():
        if frequency == max_frequency:
            result += frequency

    return result
```

## Задание_3

**Условие:**

Задача 3. Поиск k-го элемента двух отсортированных массивов
Условие:
Даны два отсортированных по возрастанию массива целых чисел A и B. Реализуйте функцию:
python
def find_kth_element(A: list[int], B: list[int], k: int) -> int
Функция возвращает k-й по порядку элемент (отсчитывая с 1) объединённого массива.
Примеры:
python
A = [1, 3, 5, 7]
B = [2, 4, 6, 8]
k = 5
# Объединённый: [1,2,3,4,5,6,7,8]
# 5-й элемент = 5
# Результат: 5
A = [10, 20, 30]
B = [5, 15, 25, 35]
k = 4
# Объединённый: [5,10,15,20,25,30,35]
# 4-й элемент = 20
# Результат: 20
A = []
B = [1, 2, 3]
k = 2
# Результат: 2
Ограничения:
0 ≤ len(A), len(B) ≤ 10^5
1 ≤ k ≤ len(A) + len(B)
Элементы: -10^9 ≤ x ≤ 10^9
Требования:
Сложность: O(log(min(n, m))) или O(log(n+m)) по времени
Память: O(1)
Запрещено сливать массивы

**Решение:**

```python
def find_kth_element(A, B, k):
    index_a = 0
    index_b = 0

    while True:
        if index_a == len(A):
            return B[index_b + k - 1]

        if index_b == len(B):
            return A[index_a + k - 1]

        if k == 1:
            return min(A[index_a], B[index_b])

        step = k // 2
        new_index_a = min(index_a + step, len(A)) - 1
        new_index_b = min(index_b + step, len(B)) - 1

        if A[new_index_a] <= B[new_index_b]:
            removed_count = new_index_a - index_a + 1
            k -= removed_count
            index_a = new_index_a + 1
        else:
            removed_count = new_index_b - index_b + 1
            k -= removed_count
            index_b = new_index_b + 1
```

## Задание_4

**Условие:**

Задача 4. Объединение двух отсортированных списков времени
Часть 1. Слияние
Условие:
Даны два списка событий во времени, отсортированных по возрастанию:
times1 — время начала событий (секунды)
times2 — время окончания событий (секунды)
Реализуйте функцию:
python
def merge_sorted_times(times1: list[int], times2: list[int]) -> list[int]
Функция возвращает объединённый отсортированный список всех моментов времени.
Пример:
python
times1 = [10, 30, 50, 70]
times2 = [20, 40, 60, 80]
# Результат: [10, 20, 30, 40, 50, 60, 70, 80]
Часть 2. Сортировка слиянием для времени
Реализуйте функцию:
python
def merge_sort_times(times: list[int]) -> list[int]
Функция сортирует массив моментов времени по возрастанию, используя алгоритм сортировки слиянием и функцию merge_sorted_times из части 1.
Пример:
python
times = [45, 12, 89, 23, 67, 34, 90, 11]
# Результат: [11, 12, 23, 34, 45, 67, 89, 90]
Требования:
Указать сложность по времени и памяти
Назвать минимум 2 недостатка сортировки слиянием по сравнению с быстрой сортировкой
Не использовать встроенную сортировку

**Решение:**

```python
def merge_sorted_times(times1, times2):
    index1 = 0
    index2 = 0
    result = []

    while index1 < len(times1) and index2 < len(times2):
        if times1[index1] <= times2[index2]:
            result.append(times1[index1])
            index1 += 1
        else:
            result.append(times2[index2])
            index2 += 1

    while index1 < len(times1):
        result.append(times1[index1])
        index1 += 1

    while index2 < len(times2):
        result.append(times2[index2])
        index2 += 1

    return result

def merge_sort_times(times):
    if len(times) <= 1:
        return times

    middle = len(times) // 2
    left_part = times[:middle]
    right_part = times[middle:]

    sorted_left = merge_sort_times(left_part)
    sorted_right = merge_sort_times(right_part)

    return merge_sorted_times(sorted_left, sorted_right)
```

## Задание_5

**Условие:**

Задача 5. Бинарный поиск в массиве и поиск корня
Часть 1. Бинарный поиск первого вхождения
Реализуйте функцию:
python
def binary_search_first(arr: list[int], target: int) -> int
arr — отсортированный по возрастанию массив (могут быть дубликаты)
target — искомое число
Возвращает индекс первого вхождения target или -1, если элемент не найден
Пример:
python
arr = [2, 4, 6, 8, 8, 8, 10, 12]
target = 8
# Результат: 3 (индекс первого 8)
arr = [1, 3, 5, 7]
target = 4
# Результат: -1
Часть 2. Поиск корня уравнения методом бисекции
Используя ту же логику бинарного поиска (метод деления отрезка пополам), реализуйте функцию:
python
def find_root(f, a: float, b: float, eps: float) -> float
Где:
f — функция (например, lambda x: x**3 - 2*x - 5)
a, b — границы отрезка, на котором f(a) и f(b) имеют разные знаки
eps — точность
Возвращает приближённое значение корня
Пример:
python
f = lambda x: x**3 - 2*x - 5
# Корень на отрезке [2, 3] с точностью 0.00001
# Ожидаемый результат: ~2.094...
Требования:
Для бинарного поиска: сложность O(log n)
Для поиска корня: сложность O(log((b-a)/eps))

**Решение:**

```python
def binary_search_first(arr, target):
    left = 0
    right = len(arr) - 1
    answer = -1

    while left <= right:
        middle = (left + right) // 2

        if arr[middle] == target:
            answer = middle
            right = middle - 1
        elif arr[middle] < target:
            left = middle + 1
        else:
            right = middle - 1

    return answer

def find_root(f, a, b, eps):
    if f(a) * f(b) > 0:
        raise ValueError("На концах отрезка функция должна иметь разные знаки")

    left = a
    right = b

    while right - left > eps:
        middle = (left + right) / 2

        if f(left) * f(middle) <= 0:
            right = middle
        else:
            left = middle

    return (left + right) / 2
```

## Задание_6

**Условие:**

Задача 6. Проверка правильной вложенности тегов
Условие:
Дана строка html, содержащая текст и HTML-подобные теги двух типов:
<tag> и </tag> — угловые скобки
{tag} и {/tag} — фигурные скобки
Реализуйте функцию:
python
def is_valid_tags(s: str) -> bool
Функция проверяет, являются ли теги правильно вложенными:
Каждый открывающий тег должен иметь соответствующий закрывающий того же типа
Теги должны быть правильно вложены (нельзя закрыть внешний тег до внутреннего)
Любые другие символы (текст, пробелы, цифры) игнорируются
Примеры:
python
"<div>text</div>"           → True
"{b}bold{/b}"               → True
"<div>{i}text{/i}</div>"    → True
"<div>{i}text</div>{/i}"    → False (неправильный порядок)
"<div>text{/div}"           → False (несовпадение типов)
"just text no tags"         → True
"<div><span>text</span></div>" → True
"<div><span>text</div></span>" → False
Требования:
Сложность: O(n) по времени, O(n) по памяти в худшем случае
Использовать структуру данных "стек"
Игнорировать все символы, кроме <, >, {, }, /

**Решение:**

```python
def is_valid_tags(s):
    stack = []
    index = 0

    while index < len(s):
        char = s[index]

        if char != "<" and char != "{":
            index += 1
            continue

        if char == "<":
            closing_bracket = ">"
            tag_type = "<"
        else:
            closing_bracket = "}"
            tag_type = "{"

        closing_index = s.find(closing_bracket, index + 1)

        if closing_index == -1:
            return False

        tag_name = s[index + 1:closing_index]

        if tag_name.startswith("/"):
            real_name = tag_name[1:]

            if not stack:
                return False

            last_tag_type, last_tag_name = stack.pop()

            if last_tag_type != tag_type or last_tag_name != real_name:
                return False
        else:
            stack.append((tag_type, tag_name))

        index = closing_index + 1

    return len(stack) == 0
```
