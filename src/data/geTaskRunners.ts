import {
  anomalyDetectionSetupCode,
  clusterizationSetupCode,
  largeFileSetupCode,
} from '@/data/gePythonSetups'

type BaseRunner = {
  starterCode?: string
  note?: string
}

export type PythonTaskRunner = BaseRunner & {
  language: 'python'
  stdin?: string
  expectedStdout?: string
  setupCode?: string
}

export type SqlTaskRunner = BaseRunner & {
  language: 'sql'
  scenarioId: 'giaAirport'
}

export type HtmlTaskRunner = BaseRunner & {
  language: 'html'
}

export type GeTaskRunner = PythonTaskRunner | SqlTaskRunner | HtmlTaskRunner

const readLargeFileStarter = `def read_large_file(file_path):
    data = []
    with open(file_path, 'r', encoding='utf-8') as file:
        for line in file:
            # TODO: process line and append to data
            ...
    return data

file_path = 'your_large_file.txt'
data_array = read_large_file(file_path)
print(f"Read {len(data_array)} lines.")
`
const intersectArraysStarter = `def find_intersection(arr1, arr2):
    set_arr2 = set(arr2)
    # TODO: keep only values from arr1 that are present in arr2
    ...

X = [1, 5, 9, 0]
Y = [3, 0, 2, 9]
print(find_intersection(X, Y))
`
const removeBracketsStarter = `def remove_text_in_brackets(text):
    result = []
    depth = 0

    for char in text:
        # TODO: skip text inside brackets
        ...

    return ''.join(result)

text = "Это (пример (вложенных) скобок) и еще (одни) скобки."
print(remove_text_in_brackets(text))
`
const mod77Starter = `numbers = [77, 5, 154, -3, 8]

filtered_numbers = filter(
    lambda x: 10 <= abs(x) <= 99 and x % 77 == 0,
    numbers,
)
squared_numbers = map(
    lambda x: x ** 2,
    filtered_numbers,
)
result = sum(squared_numbers)

print(result)
`
const clockStarter = `n = int(input())

hours = ...
minutes = ...
seconds = ...

print(f"{hours}:{minutes:02d}:{seconds:02d}")
`
const trainStarter = `class Train:
    def __init__(self, type, speed):
        # TODO: save type and speed in object fields
        ...

my_train = Train(type="грузовой", speed=120)
print(my_train.speed)
`
const listComprehensionStarter = `a = [1, 2, 3, 4, 5]

# TODO: create a new list where each value is increased by 1
a2 = ...

print(a2)
`
const checkDateStarter = `import pandas as pd

data = {
    'Date': ['2021-01-18', '2021-01-20', '2021-01-23', '2021-01-25'],
    'event': ['fail', 'correct', 'fail', 'fail'],
}
df = pd.DataFrame(data)
df['Date'] = pd.to_datetime(df['Date'])

try:
    user_date = pd.to_datetime(input("YYYY-MM-DD: ").strip())
except ValueError:
    print("Invalid date format")
    raise SystemExit

# TODO: print exact event or nearest date
`
const readJsonStarter = `import json
import sys

def process_value(value):
    if isinstance(value, list):
        return ', '.join(map(str, value))
    return str(value)

def print_key_value_pairs(json_data):
    for key, value in json_data.items():
        print(f"{key}: {process_value(value)}")

def main():
    input_data = ''.join(sys.stdin.readlines())

    try:
        json_obj = json.loads(input_data)
        if isinstance(json_obj, dict):
            print_key_value_pairs(json_obj)
        else:
            print("Input must be a JSON object")
    except json.JSONDecodeError:
        print("Invalid JSON")

if __name__ == "__main__":
    main()
`
const permutationsStarter = `class Permutations:
    def __init__(self, nums):
        self.nums = list(nums)
        self.solution = []

    def permute(self):
        self.solution = []
        self._backtrack(0, self.nums.copy())
        return self.solution

    def _backtrack(self, start, current):
        # TODO: generate permutations with backtracking
        ...

    def mediana(self):
        # TODO: compute median of the first elements
        ...

a = Permutations([1, 2, 3])
a.permute()
print(a.solution)
print(a.mediana())
`
const romanNumsStarter = `def cache_result(func):
    def wrapper(self, *args, **kwargs):
        if self.solution:
            print("Берем число из кэша...")
            return self.solution
        print("Вычисляем число...")
        result = func(self, *args, **kwargs)
        self.solution = result
        return result
    return wrapper

class Class:
    def __init__(self, num):
        self.num = num
        self.solution = ""

    @cache_result
    def intToRoman(self):
        roman_map = [
            (1000, "M"), (900, "CM"),
            (500, "D"), (400, "CD"),
            (100, "C"), (90, "XC"),
            (50, "L"), (40, "XL"),
            (10, "X"), (9, "IX"),
            (5, "V"), (4, "IV"),
            (1, "I"),
        ]
        # TODO: convert self.num to Roman numerals
        ...

a = Class(495)
a.intToRoman()
print(a)
`
const countAndSayStarter = `class CountAndSay:
    def __init__(self, num):
        if not isinstance(num, int) or num <= 0:
            raise ValueError("num must be positive")
        self.num = num
        self.solution = ""

    def countAndSay(self):
        # TODO: build the sequence value
        ...

    def __str__(self):
        return f"Result after {self.num} steps: {self.solution}"

a = CountAndSay(4)
a.countAndSay()
print(a)
`
const removeDuplicatesStarter = `def cache_sum(func):
    def wrapper(self, *args, **kwargs):
        if hasattr(self, "_sum"):
            return self._sum
        result = func(self, *args, **kwargs)
        self._sum = result
        return result
    return wrapper

class Class:
    def __init__(self, nums):
        self.nums = nums[:]
        self.solution = []

    def removeDuplicates(self):
        # TODO: keep unique values and fill the rest with '_'
        ...

    @cache_sum
    def all_sum(self):
        # TODO: sum source values
        ...

a = Class([0, 0, 1, 1, 1, 2, 2, 3, 3, 4])
a.removeDuplicates()
print(a.solution)
print(a.all_sum())
`
const dijkstraStarter = `class Graph:
    def __init__(self):
        self.nodes = set()
        self.edges = {}
        self.distances = {}

    def add_node(self, value):
        # TODO
        ...

    def add_edge(self, from_node, to_node, distance):
        # TODO
        ...

def dijkstra(graph, initial):
    # TODO: compute shortest paths
    ...

graph = Graph()
# TODO: add nodes and edges, then call dijkstra(graph, start)
`
const minNumStarter = `numbers = [int(x) for x in input().split()]

numbers_ending_with_3 = [num for num in numbers if num % 10 == 3]

if numbers_ending_with_3:
    min_number = ...
    print(f"Минимальное число, оканчивающееся на 3: {min_number}")
else:
    print("В последовательности нет чисел, оканчивающихся на 3")
`
const fibonacciStarter = `from functools import lru_cache

def fibonacci_iterative(n):
    # TODO
    ...

def fibonacci_binet(n):
    # TODO
    ...

@lru_cache(maxsize=None)
def fibonacci_memo(n):
    # TODO
    ...

def fibonacci_recursive(n):
    # TODO
    ...

n = 10
print(fibonacci_iterative(n))
print(fibonacci_binet(n))
print(fibonacci_memo(n))
print(fibonacci_recursive(n))
`
const binaryHeapStarter = `def insert_into_heap(heap, new_element):
    heap.append(new_element)
    current_index = len(heap) - 1

    # TODO: sift the element up
    ...

    return heap

heap = [1, 3, 6, 5, 9, 8]
new_element = 4
print(insert_into_heap(heap, new_element))
`
const listNodeStarter = `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def delete_node(head, index):
    # TODO: remove node by index
    ...

head = ListNode(1, ListNode(2, ListNode(3, ListNode(4, ListNode(5)))))
new_head = delete_node(head, 2)

current = new_head
while current:
    print(current.val, end=" -> ")
    current = current.next
`
const convertBaseStarter = `binary_number = input().strip()

if not all(char in '01' for char in binary_number):
    print("Ошибка: введено не двоичное число!")
else:
    decimal_number = ...
    hexadecimal_number = ...

    print(f"Двоичное число: {binary_number}")
    print(f"Десятичное число: {decimal_number}")
    print(f"Шестнадцатеричное число: {hexadecimal_number}")
`
const vowelPercentStarter = `input_string = input()
vowels = {'а', 'е', 'ё', 'и', 'о', 'у', 'ы', 'э', 'ю', 'я'}

total_letters = 0
vowel_count = 0

for char in input_string.lower():
    # TODO: count letters and vowels
    ...

if total_letters > 0:
    vowel_ratio = vowel_count / total_letters
else:
    vowel_ratio = 0.0

print(f"Доля гласных букв в строке: {vowel_ratio:.2%}")
`
const complexNumberStarter = `def parse_complex_number(s):
    # TODO: parse strings like '2 + i*3'
    ...

def complex_sum(z1, z2):
    return (z1[0] + z2[0], z1[1] + z2[1])

def complex_diff(z1, z2):
    return (z1[0] - z2[0], z1[1] - z2[1])

def complex_mult(z1, z2):
    # TODO
    ...

z1_str = input()
z2_str = input()

z1 = parse_complex_number(z1_str)
z2 = parse_complex_number(z2_str)

print(f"Сумма: {complex_sum(z1, z2)}")
print(f"Разность: {complex_diff(z1, z2)}")
print(f"Произведение: {complex_mult(z1, z2)}")
`
const bubbleSortStarter = `def bubble_sort(arr):
    n = len(arr)

    for i in range(n - 1):
        swapped = False
        for j in range(n - i - 1):
            # TODO: swap adjacent items if needed
            ...
        if not swapped:
            break
    return arr

numbers = [64, 34, 25, 12, 22, 11, 90]
print(bubble_sort(numbers))
`
const mergeSortStarter = `def merge_sort(arr):
    if len(arr) <= 1:
        return arr

    mid = len(arr) // 2
    left_half = arr[:mid]
    right_half = arr[mid:]

    # TODO: sort halves and merge them back
    ...

numbers = [38, 27, 43, 3, 9, 82, 10]
sorted_numbers = merge_sort(numbers.copy())
print("Исходный массив:", numbers)
print("Отсортированный массив:", sorted_numbers)
`
const anomalyDetectionStarter = `import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# df is already prepared by setupCode
print(f"Rows: {len(df)}")

features = [
    'loco_11.tu17l1', 'loco_11.tu17r1', 'loco_11.tu17l2', 'loco_11.tu17r2',
    'loco_11.tu17l3', 'loco_11.tu17r3', 'loco_11.tu17l4', 'loco_11.tu17r4',
    'loco_11.tu17l5', 'loco_11.tu17r5',
]

df_clean = df.dropna(subset=features).copy()
scaler = StandardScaler()
X_scaled = scaler.fit_transform(df_clean[features])

# TODO: choose k, fit KMeans, inspect anomalies or clusters
`
const clusterizationStarter = `import pandas as pd
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler

# df is already prepared by setupCode
print(df.head())

features = df.columns[:5] if len(df.columns) >= 5 else df.columns
scaler = StandardScaler()
X_scaled = scaler.fit_transform(df[features])

# TODO: run KMeans / DBSCAN and analyze the clusters
`
const defaultSqlStarter = `-- Напиши SQL-запрос здесь
-- Можно использовать таблицы:
-- Company(Id_comp, id_comp, name)
-- Trip(trip_no, id_comp, town_from, town_to, plane, time_out)
-- Passenger(Id_psg, id_psg, name)
-- Pass_in_trip(trip_no, id_psg, date_trip, place)

SELECT
  -- перечисли нужные поля
FROM Company;
`

const defaultHtmlStarter = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Title</title>
</head>
<body>

</body>
</html>
`

export const geTaskRunners: Record<string, GeTaskRunner> = {
  'Python/ex1_read-7gb-file.py': {
    language: 'python',
    setupCode: largeFileSetupCode,
    note: 'В песочницу уже подложен файл `your_large_file.txt`, чтобы можно было прогонять примеры чтения.',
    starterCode: readLargeFileStarter,
  },
  'Python/ex2_intersect-arrays.py': {
    language: 'python',
    expectedStdout: '[9, 0]',
    starterCode: intersectArraysStarter,
  },
  'Python/ex3_remove-brackets.py': {
    language: 'python',
    expectedStdout: 'Это  и еще  скобки.',
    starterCode: removeBracketsStarter,
  },
  'Python/ex4_found-mod-77.py': {
    language: 'python',
    expectedStdout: '5929',
    starterCode: mod77Starter,
  },
  'Python/ex5_clock.py': {
    language: 'python',
    stdin: '3661\n',
    expectedStdout: '1:01:01',
    starterCode: clockStarter,
  },
  'Python/ex6_class-train.py': {
    language: 'python',
    expectedStdout: '120',
    starterCode: trainStarter,
  },
  'Python/ex7_list-comprehension.py': {
    language: 'python',
    expectedStdout: '[2, 3, 4, 5, 6]',
    starterCode: listComprehensionStarter,
  },
  'Python/ex8_check-date.py': {
    language: 'python',
    stdin: '2021-01-20\n',
    note: 'Для проверки даты уже задан пример входа `2021-01-20`.',
    starterCode: checkDateStarter,
  },
  'Python/ex9_read-json.py': {
    language: 'python',
    stdin: '{"name":"Ann","skills":["Python","SQL"]}',
    expectedStdout: 'name: Ann\nskills: Python, SQL',
    starterCode: readJsonStarter,
  },
  'Python/ex10_permutations.py': {
    language: 'python',
    expectedStdout:
      'Для массива [1, 2, 3] будут такие перестановки: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 2, 1], [3, 1, 2]]\n2',
    starterCode: permutationsStarter,
  },
  'Python/ex11_roman-nums.py': {
    language: 'python',
    expectedStdout:
      'Вычисляем число...\nЧисло 495 в римской системе счисления равно CDXCV\nБерем число из кэша...\nЧисло 495 в римской системе счисления равно CDXCV\nВычисляем число...\nЧисло 1949 в римской системе счисления равно MCMXLIX\nБерем число из кэша...\nЧисло 1949 в римской системе счисления равно MCMXLIX',
    starterCode: romanNumsStarter,
  },
  'Python/ex12_count-and-say.py': {
    language: 'python',
    expectedStdout: 'Выполнение операции 4 раз дает ответ 1211\nВыполнение операции 7 раз дает ответ 13112221',
    starterCode: countAndSayStarter,
  },
  'Python/ex13_remove-duplicates-from-array.py': {
    language: 'python',
    expectedStdout:
      "После преобразования массив [0, 0, 1, 1, 1, 2, 2, 3, 3, 4] будет выглядеть так: [0, 1, 2, 3, 4, '_', '_', '_', '_', '_']\n17\nПосле преобразования массив [0, 1, 1, 3, 3, 4, 4, 4, 4, 5] будет выглядеть так: [0, 1, 3, 4, 5, '_', '_', '_', '_', '_']\n29",
    starterCode: removeDuplicatesStarter,
  },
  'Algorhitms/ex1_dejkstra.py': {
    language: 'python',
    starterCode: dijkstraStarter,
  },
  'Algorhitms/ex2_minnum.py': {
    language: 'python',
    stdin: '10 23 43 13 7 3 18\n',
    expectedStdout: 'Минимальное число, оканчивающееся на 3: 3',
    starterCode: minNumStarter,
  },
  'Algorhitms/ex3_fibonacci.py': {
    language: 'python',
    note: 'В архивном файле только функции. Добавь свои `print(...)`, чтобы увидеть результат.',
    starterCode: fibonacciStarter,
  },
  'Algorhitms/ex4_binaryheap.py': {
    language: 'python',
    expectedStdout: '[1, 3, 4, 5, 9, 8, 6]',
    starterCode: binaryHeapStarter,
  },
  'Algorhitms/ex5_listnode.py': {
    language: 'python',
    expectedStdout: '1 -> 2 -> 4 -> 5 -> ',
    starterCode: listNodeStarter,
  },
  'Algorhitms/ex6_convert2to10and16.py': {
    language: 'python',
    stdin: '1010\n1010\n',
    expectedStdout:
      'Двоичное число: 1010\nДесятичное число: 10\nШестнадцатеричное число: 0xa\nДесятичное число: 10\nШестнадцатеричное число: 0xA',
    starterCode: convertBaseStarter,
  },
  'Algorhitms/ex7_percent-of-vowels.py': {
    language: 'python',
    stdin: 'мама\n',
    note: 'В примере во вход подставлено слово `мама`, чтобы можно было быстро проверить долю гласных.',
    starterCode: vowelPercentStarter,
  },
  'Algorhitms/ex8_complexnum.py': {
    language: 'python',
    stdin: '2 + i*3\n-1 + i*4\n',
    note: 'Во вход уже подставлены два комплексных числа для тестового прогона.',
    starterCode: complexNumberStarter,
  },
  'Algorhitms/ex9_bubblesort.py': {
    language: 'python',
    expectedStdout: '[11, 12, 22, 25, 34, 64, 90]',
    starterCode: bubbleSortStarter,
  },
  'Algorhitms/ex10_mergesort.py': {
    language: 'python',
    expectedStdout: 'Исходный массив: [38, 27, 43, 3, 9, 82, 10]\nОтсортированный массив: [3, 9, 10, 27, 38, 43, 82]',
    starterCode: mergeSortStarter,
  },
  'ML/ex2_AnomalyDetection.py': {
    language: 'python',
    setupCode: anomalyDetectionSetupCode,
    note: 'Для запуска уже подложен учебный DataFrame вместо файла `loco_11_corr.tsv`, а графики заменены на текстовую отметку.',
    starterCode: anomalyDetectionStarter,
  },
  'ML/ex3_clusterization.py': {
    language: 'python',
    setupCode: clusterizationSetupCode,
    note: 'Для запуска уже подложен учебный Excel-набор пассажиров, а графики выводятся как отметка о построении.',
    starterCode: clusterizationStarter,
  },
  'SQL/ex1_seatsAD.txt': {
    language: 'sql',
    scenarioId: 'giaAirport',
    starterCode: defaultSqlStarter,
    note: 'Запрос выполняется на учебной базе с таблицами Company, Trip, Passenger и Pass_in_trip.',
  },
  'SQL/ex2_dep+arr-in-airports.txt': {
    language: 'sql',
    scenarioId: 'giaAirport',
    starterCode: defaultSqlStarter,
    note: 'Запрос выполняется на учебной базе с таблицами Company, Trip, Passenger и Pass_in_trip.',
  },
  'SQL/ex3_cnt-psg-by-plane-type.txt': {
    language: 'sql',
    scenarioId: 'giaAirport',
    starterCode: defaultSqlStarter,
    note: 'Запрос выполняется на учебной базе с таблицами Company, Trip, Passenger и Pass_in_trip.',
  },
  'SQL/ex4_cnt-trips-of-psg-by-plane-type.txt': {
    language: 'sql',
    scenarioId: 'giaAirport',
    starterCode: defaultSqlStarter,
    note: 'Запрос выполняется на учебной базе с таблицами Company, Trip, Passenger и Pass_in_trip.',
  },
  'SQL/ex5_cnt-psg-by-airline.txt': {
    language: 'sql',
    scenarioId: 'giaAirport',
    starterCode: defaultSqlStarter,
    note: 'Запрос выполняется на учебной базе с таблицами Company, Trip, Passenger и Pass_in_trip.',
  },
  'SQL/ex6_cnt-psg-even-odd.txt': {
    language: 'sql',
    scenarioId: 'giaAirport',
    starterCode: defaultSqlStarter,
    note: 'Запрос выполняется на учебной базе с таблицами Company, Trip, Passenger и Pass_in_trip.',
  },
  'SQL/ex7_cnt-psg+flights_for_tripno.txt': {
    language: 'sql',
    scenarioId: 'giaAirport',
    starterCode: defaultSqlStarter,
    note: 'Запрос выполняется на учебной базе с таблицами Company, Trip, Passenger и Pass_in_trip.',
  },
  'web_practice/task_1.html': {
    language: 'html',
    starterCode: defaultHtmlStarter,
    note: 'HTML и CSS можно сразу редактировать и смотреть в живом превью ниже.',
  },
  'web_practice/task_2.html': {
    language: 'html',
    starterCode: defaultHtmlStarter,
    note: 'HTML и CSS можно сразу редактировать и смотреть в живом превью ниже.',
  },
  'web_practice/task_3.html': {
    language: 'html',
    starterCode: defaultHtmlStarter,
    note: 'HTML и CSS можно сразу редактировать и смотреть в живом превью ниже.',
  },
}
