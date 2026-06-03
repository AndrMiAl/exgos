<script setup lang="ts">
import { EditPen, House } from '@element-plus/icons-vue'
import { RouterLink } from 'vue-router'

type TaskItem = {
  id: number
  file: string
  title: string
  description: string[]
  exampleLabel?: string
  example?: string
  outputLabel: string
  output: string
  solution: string
}

const tasks: TaskItem[] = [
  {
    id: 1,
    file: 'ex2_intersect-arrays.py',
    title: 'Пересечение массивов',
    description: [
      'Написать функцию, которая находит пересечение двух массивов, причем порядок элементов должен сохраняться по первому массиву.',
      'Для быстрого поиска второй массив нужно привести к множеству.',
    ],
    exampleLabel: 'Дано',
    example: `X = [1, 5, 9, 0]
Y = [3, 0, 2, 9]`,
    outputLabel: 'Что должно получиться',
    output: `[9, 0]`,
    solution: `def find_intersection(arr1, arr2):
    set_arr2 = set(arr2)
    return [x for x in arr1 if x in set_arr2]

X = [1, 5, 9, 0]
Y = [3, 0, 2, 9]
print(find_intersection(X, Y))`,
  },
  {
    id: 2,
    file: 'ex3_remove-brackets.py',
    title: 'Удаление текста в скобках',
    description: [
      'Написать функцию, которая удаляет из строки весь текст внутри круглых скобок, включая вложенные скобки.',
      'Все символы вне скобок должны остаться.',
    ],
    exampleLabel: 'Для строки',
    example: `"Это (пример (вложенных) скобок) и еще (одни) скобки."`,
    outputLabel: 'Что должно получиться',
    output: `Это  и еще  скобки.`,
    solution: `def remove_text_in_brackets(text):
    result = []
    stack = []

    for char in text:
        if char == '(':
            stack.append(char)
        elif char == ')' and stack:
            stack.pop()
        elif not stack:
            result.append(char)

    return ''.join(result)

text = "Это (пример (вложенных) скобок) и еще (одни) скобки."
print(remove_text_in_brackets(text))`,
  },
  {
    id: 3,
    file: 'ex4_found-mod-77.py',
    title: 'Числа, кратные 77',
    description: [
      'Есть массив чисел.',
      'Нужно оставить только двузначные по модулю числа.',
      'Среди них оставить только те, которые делятся на 77.',
      'Каждое такое число возвести в квадрат и найти сумму квадратов.',
    ],
    outputLabel: 'Что должно получиться',
    output: `5929`,
    solution: `numbers = [77, 293, 28, 242, 213, 285, 71, 286, 144, 276, 61, 298, 280, 214,
156, 227, 228, 51, -4, 202, 58, 99, 270, 219, 94, 253, 53, 235, 9, 158, 49, 183, 166,
205, 183, 266, 180, 6, 279, 200, 208, 231, 178, 201, 260, -35, 152, 115, 79, 284, 181,
92, 286, 98, 271, 259, 258, 196, -8, 43, 2, 128, 143, 43, 297, 229, 60, 254, -9, 5, 187,
220, -8, 111, 285, 5, 263, 187, 192, -9, 268, -9, 23, 71, 135, 7, -161, 65, 135, 29, 148,
242, 33, 35, 211, 5, 161, 46, 159, 23, 169, 23, 172, 184, -7, 228, 129, 274, 73, 197,
272, 54, 278, 26, 280, 13, 171, 2, 79, -2, 183, 10, 236, 276, 4, 29, -10, 41, 269, 94,
279, 129, 39, 92, -63, 263, 219, 57, 18, 236, 291, 234, 10, 250, 0, 64, 172, 216, 30,
15, 229, 205, 123, -105]

filtered_numbers = filter(lambda x: (10 <= abs(x) <= 99) and (x % 77 == 0), numbers)
squared_numbers = map(lambda x: x ** 2, filtered_numbers)
result = sum(squared_numbers)

print(result)`,
  },
  {
    id: 4,
    file: 'ex5_clock.py',
    title: 'Часы, минуты, секунды',
    description: [
      'Считать целое число n — количество секунд — и перевести его в формат часы:минуты:секунды.',
      'Минуты и секунды должны печататься двузначно.',
    ],
    exampleLabel: 'Для входа',
    example: `3661`,
    outputLabel: 'Вывод',
    output: `1:01:01`,
    solution: `n = int(input())

hours = n // 3600
remaining_seconds = n % 3600
minutes = remaining_seconds // 60
seconds = remaining_seconds % 60

print(f"{hours}:{minutes:02d}:{seconds:02d}")`,
  },
  {
    id: 5,
    file: 'ex9_read-json.py',
    title: 'Чтение JSON из stdin',
    description: [
      'Считать JSON из stdin.',
      'Если это JSON-объект, вывести все пары ключ: значение.',
      'Если значение — список, вывести его через запятую.',
      'Если JSON некорректный, вывести сообщение об ошибке.',
    ],
    exampleLabel: 'Для входа',
    example: `{"name":"Ann","skills":["Python","SQL"]}`,
    outputLabel: 'Вывод',
    output: `name: Ann
skills: Python, SQL`,
    solution: `import json
import sys

def process_value(value):
    if isinstance(value, list):
        return ', '.join(map(str, value))
    return str(value)

def print_key_value_pairs(json_data):
    for key, value in json_data.items():
        print(f"{key}: {process_value(value)}")

input_data = ''.join(sys.stdin.readlines())

try:
    json_obj = json.loads(input_data)
    if isinstance(json_obj, dict):
        print_key_value_pairs(json_obj)
    else:
        print("Входные данные должны представлять JSON-объект (словарь)")
except json.JSONDecodeError:
    print("Ошибка: некорректный JSON")`,
  },
  {
    id: 6,
    file: 'ex10_permutations.py',
    title: 'Перестановки и медиана',
    description: [
      'Реализовать класс, который генерирует все перестановки массива через backtracking.',
      'Сохранять перестановки в список.',
      'Отдельно вычислять медиану первых элементов всех перестановок.',
    ],
    exampleLabel: 'Для массива',
    example: `[1, 2, 3]`,
    outputLabel: 'Что должно получиться',
    output: `Для массива [1, 2, 3] будут такие перестановки: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 2, 1], [3, 1, 2]]
2`,
    solution: `class Permutations:
    def __init__(self, nums):
        self.nums = list(nums)
        self.solution = []

    def permute(self):
        self.solution = []
        self._backtrack(0, self.nums.copy())
        return self.solution

    def _backtrack(self, start, current):
        if start == len(current) - 1:
            self.solution.append(current.copy())
            return

        for i in range(start, len(current)):
            current[start], current[i] = current[i], current[start]
            self._backtrack(start + 1, current)
            current[start], current[i] = current[i], current[start]

    def mediana(self):
        if not self.solution:
            self.permute()

        first_elements = [perm[0] for perm in self.solution]
        first_elements.sort()
        n = len(first_elements)

        if n % 2 == 1:
            return first_elements[n // 2]
        return first_elements[n // 2 - 1]

a = Permutations([1, 2, 3])
a.permute()
print(a.solution)
print(a.mediana())`,
  },
  {
    id: 7,
    file: 'ex12_count-and-say.py',
    title: 'Count and Say',
    description: [
      'Реализовать класс для последовательности count and say.',
      'Каждый следующий шаг строится как описание предыдущего.',
      'Например: 1 -> 11 -> 21 -> 1211.',
    ],
    outputLabel: 'Что должно получиться',
    output: `Выполнение операции 4 раз дает ответ 1211
Выполнение операции 7 раз дает ответ 13112221`,
    solution: `class CountAndSay:
    def __init__(self, num):
        self.num = num
        self.solution = ""

    def countAndSay(self):
        if self.num == 1:
            self.solution = "1"
            return self.solution

        current = "1"
        for _ in range(1, self.num):
            next_str = ""
            count = 1
            for i in range(1, len(current)):
                if current[i] == current[i - 1]:
                    count += 1
                else:
                    next_str += str(count) + current[i - 1]
                    count = 1
            next_str += str(count) + current[-1]
            current = next_str

        self.solution = current
        return self.solution`,
  },
  {
    id: 8,
    file: 'ex13_remove-duplicates-from-array.py',
    title: 'Удаление дублей из массива',
    description: [
      'Дан отсортированный массив.',
      'Нужно оставить только уникальные элементы в исходном порядке.',
      "Оставшиеся позиции заполнить символом '_' .",
      'Отдельным методом посчитать сумму элементов исходного массива.',
      'Сумма кэшируется через декоратор.',
    ],
    exampleLabel: 'Для массива',
    example: `[0, 0, 1, 1, 1, 2, 2, 3, 3, 4]`,
    outputLabel: 'Что должно получиться',
    output: `После преобразования массив [0, 0, 1, 1, 1, 2, 2, 3, 3, 4] будет выглядеть так: [0, 1, 2, 3, 4, '_', '_', '_', '_', '_']
17`,
    solution: `class Class:
    def __init__(self, nums):
        self.nums = nums[:]
        self.solution = []

    def removeDuplicates(self):
        if not self.nums:
            self.solution = []
            return

        unique = [self.nums[0]]
        for num in self.nums[1:]:
            if num != unique[-1]:
                unique.append(num)

        fill_count = len(self.nums) - len(unique)
        self.solution = unique + ['_'] * fill_count

    def all_sum(self):
        total = 0
        for num in self.nums:
            total += num
        return total`,
  },
]
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Практика по Python</p>
        <h1>Задачи из GE-main</h1>
        <p class="muted">
          Здесь уже не короткие заготовки, а более близкие к архиву задачи: с нормальной
          постановкой, ожидаемым результатом и раскрывающимся решением.
        </p>
      </div>
      <div class="button-row">
        <RouterLink to="/">
          <el-button :icon="House">В главное меню</el-button>
        </RouterLink>
        <RouterLink to="/practice">
          <el-button type="primary" :icon="EditPen">Перейти к решению</el-button>
        </RouterLink>
      </div>
    </div>

    <el-alert
      type="info"
      show-icon
      :closable="false"
      title="Как пользоваться"
      description="Сначала смотри условие и ожидаемый результат, а код решения открывай только после своей попытки."
    />

    <div class="section-stack tasks-stack">
      <el-card v-for="task in tasks" :key="task.id" shadow="never" class="task-card">
        <template #header>
          <div class="task-card__header">
            <div>
              <p class="task-card__index">Задача {{ task.id }}</p>
              <h2>{{ task.title }}</h2>
            </div>
            <el-tag effect="plain" type="primary">{{ task.file }}</el-tag>
          </div>
        </template>

        <div class="task-card__content">
          <div class="task-card__block">
            <h3>Что нужно сделать</h3>
            <ul class="task-list">
              <li v-for="item in task.description" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div v-if="task.example" class="task-card__block">
            <h3>{{ task.exampleLabel }}</h3>
            <pre class="task-code"><code>{{ task.example }}</code></pre>
          </div>

          <div class="task-card__block">
            <h3>{{ task.outputLabel }}</h3>
            <pre class="task-code"><code>{{ task.output }}</code></pre>
          </div>

          <el-collapse class="task-card__collapse">
            <el-collapse-item :name="`solution-${task.id}`">
              <template #title>
                <span class="task-card__collapse-title">Показать решение</span>
              </template>
              <pre class="task-code task-code--solution"><code>{{ task.solution }}</code></pre>
            </el-collapse-item>
          </el-collapse>
        </div>
      </el-card>
    </div>
  </section>
</template>

<style scoped>
.tasks-stack {
  gap: 18px;
}

.task-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.task-card__index {
  margin-bottom: 8px;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 700;
}

.task-card__content {
  display: grid;
  gap: 18px;
}

.task-card__block {
  display: grid;
  gap: 10px;
}

.task-card__block h3 {
  margin: 0;
  color: var(--app-text-strong);
  font-size: 16px;
}

.task-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 20px;
  color: var(--app-text);
  line-height: 1.6;
}

.task-code {
  overflow-x: auto;
  margin: 0;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 14px 16px;
  background: var(--app-surface-soft);
  color: var(--app-text-strong);
  font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.task-code--solution {
  margin-top: 6px;
}

.task-card__collapse {
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 0 16px;
  background: var(--app-surface-soft);
}

.task-card__collapse :deep(.el-collapse-item__header),
.task-card__collapse :deep(.el-collapse-item__wrap),
.task-card__collapse :deep(.el-collapse-item__content) {
  border-color: transparent;
  background: transparent;
}

.task-card__collapse :deep(.el-collapse-item__header) {
  min-height: 56px;
  color: var(--app-text-strong);
  font-weight: 700;
}

.task-card__collapse-title {
  color: inherit;
}

@media (max-width: 860px) {
  .task-card__header {
    display: grid;
  }
}
</style>
