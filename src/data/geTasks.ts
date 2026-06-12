export type GeTaskMeta = {
  id: string
  path: string
  title: string
  description: string[]
  resultLabel: string
  result: string
  exampleLabel?: string
  example?: string
  sourceLabel?: string
}

export type GeTaskSectionMeta = {
  id: string
  title: string
  description: string
  tasks: GeTaskMeta[]
}

const codeResult = 'Готовый код решения из встроенного тренажёра.'
const sqlResult = 'Готовый SQL-запрос из встроенного тренажёра.'
const webResult = 'Готовая HTML/CSS-страница из встроенного тренажёра.'

export const geTaskSections: GeTaskSectionMeta[] = [
  {
    id: 'python',
    title: 'Python',
    description: 'Практика по коллекциям, строкам, классам, JSON и алгоритмическим задачам на Python.',
    tasks: [
      {
        id: 'python-1',
        path: 'Python/ex1_read-7gb-file.py',
        title: 'Чтение очень большого файла',
        description: [
          'Разобрать способ чтения большого файла по частям, не загружая его целиком в память.',
          'Посмотреть, как в архиве организована потоковая обработка данных.',
        ],
        resultLabel: 'Что внутри решения',
        result: codeResult,
      },
      {
        id: 'python-2',
        path: 'Python/ex2_intersect-arrays.py',
        title: 'Пересечение массивов',
        description: [
          'Найти пересечение двух массивов.',
          'Порядок элементов должен сохраняться по первому массиву.',
        ],
        exampleLabel: 'Дано',
        example: `X = [1, 5, 9, 0]
Y = [3, 0, 2, 9]`,
        resultLabel: 'Что должно получиться',
        result: '[9, 0]',
      },
      {
        id: 'python-3',
        path: 'Python/ex3_remove-brackets.py',
        title: 'Удаление текста в скобках',
        description: [
          'Удалить из строки весь текст внутри круглых скобок.',
          'Вложенные скобки тоже должны корректно обрабатываться.',
        ],
        exampleLabel: 'Для строки',
        example: `"Это (пример (вложенных) скобок) и еще (одни) скобки."`,
        resultLabel: 'Что должно получиться',
        result: 'Это  и еще  скобки.',
      },
      {
        id: 'python-4',
        path: 'Python/ex4_found-mod-77.py',
        title: 'Числа, кратные 77',
        description: [
          'Оставить только двузначные по модулю числа.',
          'Среди них выбрать числа, кратные 77, возвести их в квадрат и найти сумму.',
        ],
        resultLabel: 'Что должно получиться',
        result: '5929',
      },
      {
        id: 'python-5',
        path: 'Python/ex5_clock.py',
        title: 'Часы, минуты, секунды',
        description: [
          'Перевести число секунд в формат часы:минуты:секунды.',
          'Минуты и секунды должны печататься двузначно.',
        ],
        exampleLabel: 'Для входа',
        example: '3661',
        resultLabel: 'Вывод',
        result: '1:01:01',
      },
      {
        id: 'python-6',
        path: 'Python/ex6_class-train.py',
        title: 'Класс Train',
        description: [
          'Разобрать пример класса с полями и созданием экземпляра.',
          'Посмотреть, как из объекта получают данные о поезде.',
        ],
        exampleLabel: 'Пример',
        example: `class Train:
    def __init__(self, type, speed):
        # сохрани тип и скорость в полях объекта
        ...

my_train = Train(type="грузовой", speed=120)
print(my_train.speed)`,
        resultLabel: 'Что должно вывести',
        result: '120',
      },
      {
        id: 'python-7',
        path: 'Python/ex7_list-comprehension.py',
        title: 'List comprehension',
        description: [
          'Разобрать краткую запись для преобразования списка через list comprehension.',
          'Посмотреть, как меняется каждый элемент списка.',
        ],
        exampleLabel: 'Для списка',
        example: '[1, 2, 3, 4, 5]',
        resultLabel: 'Что должно вывести',
        result: '[2, 3, 4, 5, 6]',
      },
      {
        id: 'python-8',
        path: 'Python/ex8_check-date.py',
        title: 'Проверка даты',
        description: [
          'Разобрать задачу на проверку корректности даты.',
          'Посмотреть, как учитываются календарные ограничения и високосные годы.',
        ],
        exampleLabel: 'Пример',
        example: `Date: ['2021-01-18', '2021-01-20', '2021-01-23', '2021-01-25']
event: ['fail', 'correct', 'fail', 'fail']
Ввод: 2021-01-20`,
        resultLabel: 'Что должно получиться',
        result: 'Дата 2021-01-20 найдена. Событие: correct',
      },
      {
        id: 'python-9',
        path: 'Python/ex9_read-json.py',
        title: 'Чтение JSON из stdin',
        description: [
          'Считать JSON из stdin.',
          'Если это JSON-объект, вывести пары ключ: значение, а списки печатать через запятую.',
        ],
        exampleLabel: 'Для входа',
        example: `{"name":"Ann","skills":["Python","SQL"]}`,
        resultLabel: 'Вывод',
        result: `name: Ann
skills: Python, SQL`,
      },
      {
        id: 'python-10',
        path: 'Python/ex10_permutations.py',
        title: 'Перестановки и медиана',
        description: [
          'Сгенерировать все перестановки массива через backtracking.',
          'Отдельно вычислить медиану первых элементов всех перестановок.',
        ],
        exampleLabel: 'Для массива',
        example: '[1, 2, 3]',
        resultLabel: 'Что должно получиться',
        result: 'Список всех перестановок и значение медианы.',
      },
      {
        id: 'python-11',
        path: 'Python/ex11_roman-nums.py',
        title: 'Римские числа',
        description: [
          'Разобрать задачу на преобразование римских чисел.',
          'Посмотреть, как обрабатываются вычитающие комбинации вроде IV и IX.',
        ],
        exampleLabel: 'Пример',
        example: '495\n1949',
        resultLabel: 'Что должно получиться',
        result: '495 -> CDXCV\n1949 -> MCMXLIX',
      },
      {
        id: 'python-12',
        path: 'Python/ex12_count-and-say.py',
        title: 'Count and Say',
        description: [
          'Реализовать последовательность count and say.',
          'Каждый следующий шаг строится как описание предыдущего.',
        ],
        exampleLabel: 'Пример',
        example: '4\n7',
        resultLabel: 'Что должно получиться',
        result: '4 -> 1211\n7 -> 13112221',
      },
      {
        id: 'python-13',
        path: 'Python/ex13_remove-duplicates-from-array.py',
        title: 'Удаление дублей из массива',
        description: [
          'Оставить только уникальные элементы в отсортированном массиве.',
          "Остальные позиции заполнить символом '_' и отдельно посчитать сумму элементов.",
        ],
        exampleLabel: 'Для массива',
        example: '[0, 0, 1, 1, 1, 2, 2, 3, 3, 4]',
        resultLabel: 'Что должно получиться',
        result: "[0, 1, 2, 3, 4, '_', '_', '_', '_', '_']\n17",
      },
    ],
  },
  {
    id: 'algorithms',
    title: 'Алгоритмы',
    description: 'Практика по графам, сортировкам, числам, структурам данных и строковым задачам.',
    tasks: [
      {
        id: 'algorithms-1',
        path: 'Algorhitms/ex1_dejkstra.py',
        title: 'Алгоритм Дейкстры',
        description: [
          'Разобрать поиск кратчайших путей в графе.',
          'Посмотреть на структуру графа и итоговые расстояния от стартовой вершины.',
        ],
        resultLabel: 'Что внутри решения',
        result: codeResult,
      },
      {
        id: 'algorithms-2',
        path: 'Algorhitms/ex2_minnum.py',
        title: 'Минимальное число',
        description: [
          'Разобрать алгоритм поиска минимального числа.',
          'Посмотреть, как устроен обход элементов и выбор минимума.',
        ],
        resultLabel: 'Что внутри решения',
        result: codeResult,
      },
      {
        id: 'algorithms-3',
        path: 'Algorhitms/ex3_fibonacci.py',
        title: 'Числа Фибоначчи',
        description: [
          'Разобрать вычисление чисел Фибоначчи.',
          'Посмотреть, какой подход используется в архивном решении.',
        ],
        resultLabel: 'Что внутри решения',
        result: codeResult,
      },
      {
        id: 'algorithms-4',
        path: 'Algorhitms/ex4_binaryheap.py',
        title: 'Бинарная куча',
        description: [
          'Разобрать пример работы с бинарной кучей.',
          'Посмотреть базовые операции над структурой данных.',
        ],
        resultLabel: 'Что внутри решения',
        result: codeResult,
      },
      {
        id: 'algorithms-5',
        path: 'Algorhitms/ex5_listnode.py',
        title: 'ListNode и связный список',
        description: [
          'Разобрать задачу со структурой ListNode.',
          'Посмотреть, как связный список создается и обходится.',
        ],
        resultLabel: 'Что внутри решения',
        result: codeResult,
      },
      {
        id: 'algorithms-6',
        path: 'Algorhitms/ex6_convert2to10and16.py',
        title: 'Перевод из двоичной в 10 и 16',
        description: [
          'Разобрать преобразование числа из двоичной системы счисления.',
          'Посмотреть, как получается десятичная и шестнадцатеричная запись.',
        ],
        resultLabel: 'Что внутри решения',
        result: codeResult,
      },
      {
        id: 'algorithms-7',
        path: 'Algorhitms/ex7_percent-of-vowels.py',
        title: 'Процент гласных',
        description: [
          'Посчитать долю гласных в строке.',
          'Разобрать проход по символам и подсчет результата.',
        ],
        resultLabel: 'Что внутри решения',
        result: codeResult,
      },
      {
        id: 'algorithms-8',
        path: 'Algorhitms/ex8_complexnum.py',
        title: 'Комплексные числа',
        description: [
          'Разобрать задачу с комплексными числами.',
          'Посмотреть, какие операции выполняются над ними в решении.',
        ],
        resultLabel: 'Что внутри решения',
        result: codeResult,
      },
      {
        id: 'algorithms-9',
        path: 'Algorhitms/ex9_bubblesort.py',
        title: 'Пузырьковая сортировка',
        description: [
          'Разобрать реализацию bubble sort.',
          'Посмотреть порядок проходов и обменов.',
        ],
        resultLabel: 'Что внутри решения',
        result: codeResult,
      },
      {
        id: 'algorithms-10',
        path: 'Algorhitms/ex10_mergesort.py',
        title: 'Сортировка слиянием',
        description: [
          'Разобрать реализацию merge sort.',
          'Посмотреть рекурсивное деление и слияние частей массива.',
        ],
        resultLabel: 'Что внутри решения',
        result: codeResult,
      },
    ],
  },
  {
    id: 'ml',
    title: 'ML',
    description: 'Практика по анализу данных, аномалиям и кластеризации.',
    tasks: [
      {
        id: 'ml-1',
        path: 'ML/ex2_AnomalyDetection.py',
        title: 'Обнаружение аномалий',
        description: [
          'Разобрать пайплайн поиска аномалий в данных.',
          'Внутри есть предобработка, KMeans, PCA, IQR и итоговый анализ выбросов.',
        ],
        resultLabel: 'Что внутри решения',
        result: 'Полный ML-скрипт для поиска аномалий и анализа признаков.',
      },
      {
        id: 'ml-2',
        path: 'ML/ex3_clusterization.py',
        title: 'Кластеризация',
        description: [
          'Разобрать задачу по кластеризации данных.',
          'Посмотреть, как выбирается число кластеров и как анализируется результат.',
        ],
        resultLabel: 'Что внутри решения',
        result: 'Полный ML-скрипт по кластеризации данных.',
      },
    ],
  },
  {
    id: 'sql',
    title: 'SQL',
    description: 'Практические SQL-запросы по пассажирам, рейсам, самолетам и аэропортам.',
    tasks: [
      {
        id: 'sql-1',
        path: 'SQL/ex1_seatsAD.txt',
        title: 'Места A и D у пассажиров',
        description: [
          'Разобрать запрос по пассажирам и их местам.',
          'В запросе выбираются пассажиры с местами, оканчивающимися на A или D.',
        ],
        resultLabel: 'Что внутри решения',
        result: sqlResult,
      },
      {
        id: 'sql-2',
        path: 'SQL/ex2_dep+arr-in-airports.txt',
        title: 'Вылеты и прилеты по аэропортам',
        description: [
          'Разобрать сводку по вылетам и прилетам в аэропортах.',
          'Внутри запрос по рейсам за апрель 2025 с разделением на направления.',
        ],
        resultLabel: 'Что внутри решения',
        result: sqlResult,
      },
      {
        id: 'sql-3',
        path: 'SQL/ex3_cnt-psg-by-plane-type.txt',
        title: 'Пассажиры по типам самолетов',
        description: [
          'Посчитать число пассажиров по авиакомпаниям и типам самолетов.',
          'Разобрать GROUP BY и HAVING в итоговом запросе.',
        ],
        resultLabel: 'Что внутри решения',
        result: sqlResult,
      },
      {
        id: 'sql-4',
        path: 'SQL/ex4_cnt-trips-of-psg-by-plane-type.txt',
        title: 'Рейсы пассажиров по типам самолетов',
        description: [
          'Разобрать подсчет рейсов пассажиров по типу самолета.',
          'Посмотреть, как в архиве собрана агрегация по поездкам и plane.',
        ],
        resultLabel: 'Что внутри решения',
        result: sqlResult,
      },
      {
        id: 'sql-5',
        path: 'SQL/ex5_cnt-psg-by-airline.txt',
        title: 'Пассажиры по авиакомпаниям',
        description: [
          'Разобрать запрос, который считает пассажиров по авиакомпаниям.',
          'Посмотреть связи Company, Trip и Pass_in_trip.',
        ],
        resultLabel: 'Что внутри решения',
        result: sqlResult,
      },
      {
        id: 'sql-6',
        path: 'SQL/ex6_cnt-psg-even-odd.txt',
        title: 'Четные и нечетные пассажиры',
        description: [
          'Разобрать задачу с разделением пассажиров на четные и нечетные группы.',
          'Посмотреть, как это оформлено в SQL-запросе.',
        ],
        resultLabel: 'Что внутри решения',
        result: sqlResult,
      },
      {
        id: 'sql-7',
        path: 'SQL/ex7_cnt-psg+flights_for_tripno.txt',
        title: 'Пассажиры и рейсы по trip_no',
        description: [
          'Разобрать подсчет пассажиров и рейсов по номеру рейса.',
          'Посмотреть, как построена агрегация по trip_no.',
        ],
        resultLabel: 'Что внутри решения',
        result: sqlResult,
      },
    ],
  },
  {
    id: 'web',
    title: 'Web',
    description: 'Практика по HTML/CSS на списках, карточках и базовых стилевых задачах.',
    tasks: [
      {
        id: 'web-1',
        path: 'web_practice/task_1.html',
        title: 'Список с выделенными пунктами',
        description: [
          'Сделать так, чтобы выделенные пункты списка были красными.',
          'Добавить отступы между элементами и пунктирную рамку вокруг списка.',
        ],
        resultLabel: 'Что внутри решения',
        result: webResult,
      },
      {
        id: 'web-2',
        path: 'web_practice/task_2.html',
        title: 'Карточка товара',
        description: [
          'Оформить карточку товара рамкой, внутренними отступами и скруглением.',
          'Сделать кнопку сиреневого цвета с нужными отступами.',
        ],
        resultLabel: 'Что внутри решения',
        result: webResult,
      },
      {
        id: 'web-3',
        path: 'web_practice/task_3.html',
        title: 'Список месяцев',
        description: [
          'Выделить нужные месяцы зеленым цветом.',
          'Добавить отступы слева у элементов и оформить список точечной рамкой и фоном.',
        ],
        resultLabel: 'Что внутри решения',
        result: webResult,
      },
    ],
  },
]
