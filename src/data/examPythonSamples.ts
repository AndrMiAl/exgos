export type ExamPythonSample = {
  sampleCode: string
  expectedStdout: string
}

const examPythonSamples: Record<string, ExamPythonSample> = {
  'python:1': {
    sampleCode: `# Пример запуска
keeper = DataKeeper([1, 2, 2, 3, 1, 4])
print(keeper.distinct)
print(keeper.sum_distinct)
print(DataKeeper.calc_average(keeper))
print(len(keeper))
print(DataKeeper.from_comma_string("5, 5, 7, 8").distinct)`,
    expectedStdout: `[1, 2, 3, 4]
10
2.5
4
[5, 7, 8]`,
  },
  'python:2': {
    sampleCode: `# Пример запуска
print(list(generate_sequence(7)))
print(lucas_recursive(6))
print(lucas_memo(6))

_counter = iter([1.0, 1.1, 2.0, 2.4, 3.0, 3.6])
time.perf_counter = lambda: next(_counter)
compare_lucas_performance(5)`,
    expectedStdout: `[2, 1, 3, 4, 7, 11, 18]
18
18
generator: 100.0 ms
recursive: 400.0 ms
memo: 600.0 ms`,
  },
  'python:3': {
    sampleCode: `# Пример запуска
print(list(TableMapper([
    ["name", "age"],
    ["Ann", 20],
    ["Bob"],
    [],
    ["Max", 30],
])))`,
    expectedStdout: `[{'name': 'Ann', 'age': 20}, {'name': 'Max', 'age': 30}]`,
  },
  'python:4': {
    sampleCode: `# Пример запуска
records = [
    {"dt": "2024-01-01", "amount": 10, "group": "A"},
    {"dt": "2024-01-02", "amount": 20, "group": "A"},
    {"dt": "2024-01-03", "amount": 40, "group": "A"},
]

for item in process_time_series(records):
    print(item["dt"], item["yr"], item["mo"], item["dy"], item["rolling_avg"])`,
    expectedStdout: `2024-01-01 2024 1 1 None
2024-01-02 2024 1 2 23.333333333333332
2024-01-03 2024 1 3 None`,
  },
  'python:5': {
    sampleCode: `# Пример запуска
_counter = iter([10.0, 10.25])
time.perf_counter = lambda: next(_counter)
extract_unique([4, 1, 2, 1, 3, 2, 5])`,
    expectedStdout: `function: extract_unique
args: ([4, 1, 2, 1, 3, 2, 5],)
kwargs: {}
result: [4, 3, 5]
time: 250.0 ms`,
  },
  'python:6': {
    sampleCode: `# Пример запуска
figures = [Square(2), Disk(1), RightTriangle(3, 4)]
print(round(sum_areas(figures), 2))`,
    expectedStdout: `13.14`,
  },
  'python:7': {
    sampleCode: `# Пример запуска
print(deep_flatten({"m": {"n": 5, "p": [6, 7]}, "q": 8}))`,
    expectedStdout: `{'m.n': 5, 'm.p.0': 6, 'm.p.1': 7, 'q': 8}`,
  },
  'python:8': {
    sampleCode: `# Пример запуска
with FileWriter("demo.txt") as writer:
    writer.write("hello")`,
    expectedStdout: `Записано байт: 5`,
  },
  'python:9': {
    sampleCode: `# Пример запуска
print(validate_and_compute({"values": [2, 4, 6], "mode": "avg"}))
print(validate_and_compute({"values": [2, 4, 6], "mode": "max"}))`,
    expectedStdout: `{'status': 'ok', 'result': 4.0}
{'status': 'ok', 'result': 6}`,
  },
  'python:10': {
    sampleCode: `# Пример запуска
grid = [[1, 2, 3], [4, 5, 6]]
analyzer = GridAnalyzer(grid)
print(analyzer.fetch_row(1))
print(analyzer.fetch_col(2))
print(analyzer.find_max())
print(analyzer.find_min())
print(analyzer.create_transpose())
print(analyzer.fetch_row(5))`,
    expectedStdout: `[4, 5, 6]
[3, 6]
6
1
[[1, 4], [2, 5], [3, 6]]
Некорректный индекс строки
None`,
  },
  'algorithms:1': {
    sampleCode: `# Пример запуска
print(next_greater_height([50, 60, 55, 70, 65, 45, 80, 40]))`,
    expectedStdout: `[1, 2, 1, 3, 2, 1, -1, -1]`,
  },
  'algorithms:2': {
    sampleCode: `# Пример запуска
print(max_freq_char_sum("a A b B c C d D D"))
print(max_freq_char_sum("abc123 ABC"))`,
    expectedStdout: `3
6`,
  },
  'algorithms:3': {
    sampleCode: `# Пример запуска
print(find_kth_element([1, 3, 5, 7], [2, 4, 6, 8], 5))
print(find_kth_element([10, 20, 30], [5, 15, 25, 35], 4))`,
    expectedStdout: `5
20`,
  },
  'algorithms:4': {
    sampleCode: `# Пример запуска
print(merge_sorted_times([10, 30, 50, 70], [20, 40, 60, 80]))
print(merge_sort_times([45, 12, 89, 23, 67, 34, 90, 11]))`,
    expectedStdout: `[10, 20, 30, 40, 50, 60, 70, 80]
[11, 12, 23, 34, 45, 67, 89, 90]`,
  },
  'algorithms:5': {
    sampleCode: `# Пример запуска
print(binary_search_first([2, 4, 6, 8, 8, 8, 10, 12], 8))
print(binary_search_first([1, 3, 5, 7], 4))
print(round(find_root(lambda x: x**3 - 2 * x - 5, 2, 3, 0.00001), 5))`,
    expectedStdout: `3
-1
2.09455`,
  },
  'algorithms:6': {
    sampleCode: `# Пример запуска
print(is_valid_tags("<div>text</div>"))
print(is_valid_tags("{b}bold{/b}"))
print(is_valid_tags("<div>{i}text</div>{/i}"))
print(is_valid_tags("just text no tags"))`,
    expectedStdout: `True
True
False
True`,
  },
}

export function getExamPythonSample(sectionId: string, taskNumber: number) {
  return examPythonSamples[`${sectionId}:${taskNumber}`]
}
