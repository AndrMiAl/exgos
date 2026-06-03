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

const defaultPythonStarter = '# Напиши решение здесь\n'
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
    starterCode: defaultPythonStarter,
  },
  'Python/ex2_intersect-arrays.py': {
    language: 'python',
    expectedStdout: '[9, 0]',
    starterCode: defaultPythonStarter,
  },
  'Python/ex3_remove-brackets.py': {
    language: 'python',
    expectedStdout: 'Это  и еще  скобки.',
    starterCode: defaultPythonStarter,
  },
  'Python/ex4_found-mod-77.py': {
    language: 'python',
    expectedStdout: '5929',
    starterCode: defaultPythonStarter,
  },
  'Python/ex5_clock.py': {
    language: 'python',
    stdin: '3661\n',
    expectedStdout: '1:01:01',
    starterCode: defaultPythonStarter,
  },
  'Python/ex6_class-train.py': {
    language: 'python',
    expectedStdout: '120',
    starterCode: defaultPythonStarter,
  },
  'Python/ex7_list-comprehension.py': {
    language: 'python',
    expectedStdout: '[2, 3, 4, 5, 6]',
    starterCode: defaultPythonStarter,
  },
  'Python/ex8_check-date.py': {
    language: 'python',
    stdin: '2021-01-20\n',
    note: 'Для проверки даты уже задан пример входа `2021-01-20`.',
    starterCode: defaultPythonStarter,
  },
  'Python/ex9_read-json.py': {
    language: 'python',
    stdin: '{"name":"Ann","skills":["Python","SQL"]}',
    expectedStdout: 'name: Ann\nskills: Python, SQL',
    starterCode: defaultPythonStarter,
  },
  'Python/ex10_permutations.py': {
    language: 'python',
    expectedStdout:
      'Для массива [1, 2, 3] будут такие перестановки: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 2, 1], [3, 1, 2]]\n2',
    starterCode: defaultPythonStarter,
  },
  'Python/ex11_roman-nums.py': {
    language: 'python',
    expectedStdout:
      'Вычисляем число...\nЧисло 495 в римской системе счисления равно CDXCV\nБерем число из кэша...\nЧисло 495 в римской системе счисления равно CDXCV\nВычисляем число...\nЧисло 1949 в римской системе счисления равно MCMXLIX\nБерем число из кэша...\nЧисло 1949 в римской системе счисления равно MCMXLIX',
    starterCode: defaultPythonStarter,
  },
  'Python/ex12_count-and-say.py': {
    language: 'python',
    expectedStdout: 'Выполнение операции 4 раз дает ответ 1211\nВыполнение операции 7 раз дает ответ 13112221',
    starterCode: defaultPythonStarter,
  },
  'Python/ex13_remove-duplicates-from-array.py': {
    language: 'python',
    expectedStdout:
      "После преобразования массив [0, 0, 1, 1, 1, 2, 2, 3, 3, 4] будет выглядеть так: [0, 1, 2, 3, 4, '_', '_', '_', '_', '_']\n17\nПосле преобразования массив [0, 1, 1, 3, 3, 4, 4, 4, 4, 5] будет выглядеть так: [0, 1, 3, 4, 5, '_', '_', '_', '_', '_']\n29",
    starterCode: defaultPythonStarter,
  },
  'Algorhitms/ex1_dejkstra.py': {
    language: 'python',
    starterCode: defaultPythonStarter,
  },
  'Algorhitms/ex2_minnum.py': {
    language: 'python',
    stdin: '10 23 43 13 7 3 18\n',
    expectedStdout: 'Минимальное число, оканчивающееся на 3: 3',
    starterCode: defaultPythonStarter,
  },
  'Algorhitms/ex3_fibonacci.py': {
    language: 'python',
    note: 'В архивном файле только функции. Добавь свои `print(...)`, чтобы увидеть результат.',
    starterCode: defaultPythonStarter,
  },
  'Algorhitms/ex4_binaryheap.py': {
    language: 'python',
    expectedStdout: '[1, 3, 4, 5, 9, 8, 6]',
    starterCode: defaultPythonStarter,
  },
  'Algorhitms/ex5_listnode.py': {
    language: 'python',
    expectedStdout: '1 -> 2 -> 4 -> 5 -> ',
    starterCode: defaultPythonStarter,
  },
  'Algorhitms/ex6_convert2to10and16.py': {
    language: 'python',
    stdin: '1010\n1010\n',
    expectedStdout:
      'Двоичное число: 1010\nДесятичное число: 10\nШестнадцатеричное число: 0xa\nДесятичное число: 10\nШестнадцатеричное число: 0xA',
    starterCode: defaultPythonStarter,
  },
  'Algorhitms/ex7_percent-of-vowels.py': {
    language: 'python',
    stdin: 'мама\n',
    note: 'В примере во вход подставлено слово `мама`, чтобы можно было быстро проверить долю гласных.',
    starterCode: defaultPythonStarter,
  },
  'Algorhitms/ex8_complexnum.py': {
    language: 'python',
    stdin: '2 + i*3\n-1 + i*4\n',
    note: 'Во вход уже подставлены два комплексных числа для тестового прогона.',
    starterCode: defaultPythonStarter,
  },
  'Algorhitms/ex9_bubblesort.py': {
    language: 'python',
    expectedStdout: '[11, 12, 22, 25, 34, 64, 90]',
    starterCode: defaultPythonStarter,
  },
  'Algorhitms/ex10_mergesort.py': {
    language: 'python',
    expectedStdout: 'Исходный массив: [38, 27, 43, 3, 9, 82, 10]\nОтсортированный массив: [3, 9, 10, 27, 38, 43, 82]',
    starterCode: defaultPythonStarter,
  },
  'ML/ex2_AnomalyDetection.py': {
    language: 'python',
    setupCode: anomalyDetectionSetupCode,
    note: 'Для запуска уже подложен учебный DataFrame вместо файла `loco_11_corr.tsv`, а графики заменены на текстовую отметку.',
    starterCode: defaultPythonStarter,
  },
  'ML/ex3_clusterization.py': {
    language: 'python',
    setupCode: clusterizationSetupCode,
    note: 'Для запуска уже подложен учебный Excel-набор пассажиров, а графики выводятся как отметка о построении.',
    starterCode: defaultPythonStarter,
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
