export type GeTaskRunner = {
  language: 'python'
  stdin?: string
  expectedStdout?: string
  starterCode?: string
}

const defaultStarter = '# Напиши решение здесь\n'

export const geTaskRunners: Record<string, GeTaskRunner> = {
  'Python/ex2_intersect-arrays.py': {
    language: 'python',
    expectedStdout: '[9, 0]',
    starterCode: defaultStarter,
  },
  'Python/ex3_remove-brackets.py': {
    language: 'python',
    expectedStdout: 'Это  и еще  скобки.',
    starterCode: defaultStarter,
  },
  'Python/ex4_found-mod-77.py': {
    language: 'python',
    expectedStdout: '5929',
    starterCode: defaultStarter,
  },
  'Python/ex5_clock.py': {
    language: 'python',
    stdin: '3661\n',
    expectedStdout: '1:01:01',
    starterCode: defaultStarter,
  },
  'Python/ex6_class-train.py': {
    language: 'python',
    expectedStdout: '120',
    starterCode: defaultStarter,
  },
  'Python/ex7_list-comprehension.py': {
    language: 'python',
    expectedStdout: '[2, 3, 4, 5, 6]',
    starterCode: defaultStarter,
  },
  'Python/ex9_read-json.py': {
    language: 'python',
    stdin: '{"name":"Ann","skills":["Python","SQL"]}',
    expectedStdout: 'name: Ann\nskills: Python, SQL',
    starterCode: defaultStarter,
  },
  'Python/ex10_permutations.py': {
    language: 'python',
    expectedStdout:
      'Для массива [1, 2, 3] будут такие перестановки: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 2, 1], [3, 1, 2]]\n2',
    starterCode: defaultStarter,
  },
  'Python/ex11_roman-nums.py': {
    language: 'python',
    expectedStdout:
      'Вычисляем число...\nЧисло 495 в римской системе счисления равно CDXCV\nБерем число из кэша...\nЧисло 495 в римской системе счисления равно CDXCV\nВычисляем число...\nЧисло 1949 в римской системе счисления равно MCMXLIX\nБерем число из кэша...\nЧисло 1949 в римской системе счисления равно MCMXLIX',
    starterCode: defaultStarter,
  },
  'Python/ex12_count-and-say.py': {
    language: 'python',
    expectedStdout: 'Выполнение операции 4 раз дает ответ 1211\nВыполнение операции 7 раз дает ответ 13112221',
    starterCode: defaultStarter,
  },
  'Python/ex13_remove-duplicates-from-array.py': {
    language: 'python',
    expectedStdout:
      "После преобразования массив [0, 0, 1, 1, 1, 2, 2, 3, 3, 4] будет выглядеть так: [0, 1, 2, 3, 4, '_', '_', '_', '_', '_']\n17\nПосле преобразования массив [0, 1, 1, 3, 3, 4, 4, 4, 4, 5] будет выглядеть так: [0, 1, 3, 4, 5, '_', '_', '_', '_', '_']\n29",
    starterCode: defaultStarter,
  },
  'Algorhitms/ex1_dejkstra.py': {
    language: 'python',
    starterCode: defaultStarter,
  },
  'Algorhitms/ex2_minnum.py': {
    language: 'python',
    stdin: '10 23 43 13 7 3 18\n',
    expectedStdout: 'Минимальное число, оканчивающееся на 3: 3',
    starterCode: defaultStarter,
  },
  'Algorhitms/ex4_binaryheap.py': {
    language: 'python',
    expectedStdout: '[1, 3, 4, 5, 9, 8, 6]',
    starterCode: defaultStarter,
  },
  'Algorhitms/ex6_convert2to10and16.py': {
    language: 'python',
    stdin: '1010\n1010\n',
    expectedStdout:
      'Двоичное число: 1010\nДесятичное число: 10\nШестнадцатеричное число: 0xa\nДесятичное число: 10\nШестнадцатеричное число: 0xA',
    starterCode: defaultStarter,
  },
  'Algorhitms/ex9_bubblesort.py': {
    language: 'python',
    expectedStdout: '[11, 12, 22, 25, 34, 64, 90]',
    starterCode: defaultStarter,
  },
  'Algorhitms/ex10_mergesort.py': {
    language: 'python',
    expectedStdout:
      'Исходный массив: [38, 27, 43, 3, 9, 82, 10]\nОтсортированный массив: [3, 9, 10, 27, 38, 43, 82]',
    starterCode: defaultStarter,
  },
}
