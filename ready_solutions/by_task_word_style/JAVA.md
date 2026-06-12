# Java

## Задание_1

**Условие:**

Задание № 1
Задание: Дан массив целых чисел arr. Замените каждый элемент массива на произведение всех элементов, которые находятся справа от него. Последний элемент замените на 1. Верните изменённый массив.
Входные данные: Файл test1_new.csv. Каждая строка --- один массив. Числа разделены запятыми.
Пример строки: 2,3,4,5
Реализовать: метод public int[] productOfRightElements(int[] arr)
Ограничения: 1 ≤ arr.length ≤ 10⁴, 1 ≤ arr[i] ≤ 10⁵

**Решение:**

```java
public int[] productOfRightElements(int[] arr) {
        int[] result = new int[arr.length];
        int product = 1;

        for (int i = arr.length - 1; i >= 0; i--) {
            result[i] = product;
            product = product * arr[i];
        }

        return result;
    }
```

## Задание_2

**Условие:**

Задание № 2
Задание: Даны два отсортированных по неубыванию массива целых чисел nums1 и nums2. Верните медиану всех элементов, которые встречаются в обоих массивах (пересечение). Если общих элементов нет, верните -1. Если чётное количество общих элементов, верните меньший из двух средних.
Входные данные: Файл test2_new.csv. Каждая строка содержит два массива. Первый массив, затем символ |, затем второй массив. Числа внутри массива разделены запятыми.
Пример строки: 1,2,3,4|2,3,4,5
Реализовать: метод public int getCommonMedian(int[] nums1, int[] nums2)
Ограничения: Массивы отсортированы, элементы могут повторяться.

**Решение:**

```java
public int getCommonMedian(int[] nums1, int[] nums2) {
        List<Integer> common = new ArrayList<>();

        int i = 0;
        int j = 0;

        while (i < nums1.length && j < nums2.length) {
            if (nums1[i] == nums2[j]) {
                common.add(nums1[i]);
                i++;
                j++;
            } else if (nums1[i] < nums2[j]) {
                i++;
            } else {
                j++;
            }
        }

        if (common.isEmpty()) {
            return -1;
        }

        int medianIndex = (common.size() - 1) / 2;
        return common.get(medianIndex);
    }
```

## Задание_3

**Условие:**

Задание № 3
Задание: Дан массив целых чисел. Преобразуйте его в строку, где соседние по числовому ряду значения объединены в диапазоны вида начало-конец, но только если длина диапазона не меньше 3. Диапазоны длины 2 записывайте как "a,b". Одиночные числа запишите отдельно. Повторы игнорируйте.
Входные данные: Файл test3_new.csv. Каждая строка --- один массив. Числа разделены запятыми.
Пример строки: 1,2,3,5,6,7,8,10,11,20
Пример вывода: "1-3,5-8,10,11,20"
Реализовать: метод public String compressWithMinRange(int[] rawData)
Ограничения: 0 ≤ rawData.length ≤ 10⁴, max(rawData) ≤ rawData.length × 2

**Решение:**

```java
public String compressWithMinRange(int[] rawData) {
        if (rawData.length == 0) {
            return "";
        }

        TreeSet<Integer> numbers = new TreeSet<>();

        for (int number : rawData) {
            numbers.add(number);
        }

        List<String> parts = new ArrayList<>();

        int start = numbers.first();
        int previous = numbers.first();

        for (int number : numbers.tailSet(numbers.first(), false)) {
            if (number == previous + 1) {
                previous = number;
            } else {
                addRange(parts, start, previous);
                start = number;
                previous = number;
            }
        }

        addRange(parts, start, previous);

        return String.join(",", parts);
    }

    private void addRange(List<String> parts, int start, int end) {
        int length = end - start + 1;

        if (length >= 3) {
            parts.add(start + "-" + end);
        } else {
            for (int number = start; number <= end; number++) {
                parts.add(String.valueOf(number));
            }
        }
    }
```

## Задание_4

**Условие:**

Задание № 4
Задание: Дан массив lists, содержащий k связных списков. Каждый список отсортирован по возрастанию. Объедините все списки в один отсортированный связный список, но удалите все дубликаты. Верните его голову.
Входные данные: Файл test4_new.csv. Каждая строка содержит несколько списков, разделённых символом ;. Каждый список --- числа через запятую. Пустая строка между ; означает пустой список.
Пример строки: 1,2,3;2,3,4;3,4,5
Реализовать: метод public ListNode mergeKListsUnique(ListNode[] lists)
Ограничения: 0 ≤ k ≤ 10⁴, общее число узлов ≤ 10⁴, списки отсортированы.

**Решение:**

```java
public ListNode mergeKListsUnique(ListNode[] lists) {
        PriorityQueue<ListNode> queue = new PriorityQueue<>(
            Comparator.comparingInt(node -> node.val)
        );

        for (ListNode node : lists) {
            if (node != null) {
                queue.add(node);
            }
        }

        ListNode dummy = new ListNode(0);
        ListNode tail = dummy;
        Integer lastValue = null;

        while (!queue.isEmpty()) {
            ListNode current = queue.poll();

            if (lastValue == null || current.val != lastValue) {
                tail.next = new ListNode(current.val);
                tail = tail.next;
                lastValue = current.val;
            }

            if (current.next != null) {
                queue.add(current.next);
            }
        }

        return dummy.next;
    }
```

## Задание_5

**Условие:**

Задание № 5
Задание: Дан двумерный массив nums. Каждый nums[i] --- непустой массив уникальных положительных чисел. Верните числа, которые присутствуют хотя бы в двух внутренних массивах.
Входные данные: Файл test5_new.csv. Каждая строка содержит несколько массивов, разделённых символом |. Каждый массив --- числа через запятую.
Пример строки: 1,2,3|2,3,4|3,4,5
Пример вывода: [2,3,4]
Реализовать: метод public List<Integer> intersectionAtLeastTwo(int[][] nums)
Ограничения: 1 ≤ nums.length ≤ 1000, сумма длин ≤ 1000, 1 ≤ nums[i][j] ≤ 1000

**Решение:**

```java
public List<Integer> intersectionAtLeastTwo(int[][] nums) {
        int[] count = new int[1001];

        for (int[] row : nums) {
            for (int number : row) {
                count[number]++;
            }
        }

        List<Integer> result = new ArrayList<>();

        for (int number = 1; number < count.length; number++) {
            if (count[number] >= 2) {
                result.add(number);
            }
        }

        return result;
    }
```

## Задание_6

**Условие:**

Задание № 6
Задание: Дана строка s из строчных английских букв, пробелов и цифр. Посчитайте гласные (a,e,i,o,u) и цифры. Верните floor(гласные / цифры), если цифры > 0, иначе 0.
Входные данные: Файл test6_new.csv. Каждая строка --- одна строка s.
Пример строки: hello123
Реализовать: метод public int vowelDigitScore(String s)
Ограничения: 1 ≤ s.length() ≤ 100, только строчные буквы, пробелы и цифры.

**Решение:**

```java
public int vowelDigitScore(String s) {
        int vowels = 0;
        int digits = 0;

        for (char ch : s.toCharArray()) {
            if ("aeiou".indexOf(ch) != -1) {
                vowels++;
            }

            if (Character.isDigit(ch)) {
                digits++;
            }
        }

        if (digits == 0) {
            return 0;
        }

        return vowels / digits;
    }
```

## Задание_7

**Условие:**

Задание № 7
Задание: Дан отсортированный по неубыванию массив nums. Удалите дубликаты на месте так, чтобы каждый уникальный элемент встречался не более двух раз. Верните количество уникальных элементов в новом массиве.
Входные данные: Файл test7_new.csv. Каждая строка --- один массив. Числа разделены запятыми.
Пример строки: 1,1,1,2,2,2,3,3,4
Пример вывода: 7 (массив станет: 1,1,2,2,3,3,4)
Реализовать: метод public int removeDuplicatesAtMostTwo(int[] nums)
Ограничения: 1 ≤ nums.length ≤ 3×10⁴, -100 ≤ nums[i] ≤ 100, массив отсортирован.

**Решение:**

```java
public int removeDuplicatesAtMostTwo(int[] nums) {
        int writeIndex = 0;

        for (int number : nums) {
            if (writeIndex < 2 || number != nums[writeIndex - 2]) {
                nums[writeIndex] = number;
                writeIndex++;
            }
        }

        return writeIndex;
    }
```

## Задание_8

**Условие:**

Задание № 8
Задание: Даны строки ransomNote и magazine. Определите, можно ли составить ransomNote из букв magazine. Каждую букву можно использовать не более двух раз.
Входные данные: Файл test8_new.csv. Каждая строка содержит ransomNote, затем символ |, затем magazine.
Пример строки: aaa|aabb
Реализовать: метод public boolean canConstructTwice(String ransomNote, String magazine)
Ограничения: 1 ≤ длины строк ≤ 10⁵, только строчные буквы.

**Решение:**

```java
public boolean canConstructTwice(String ransomNote, String magazine) {
        int[] letters = new int[26];

        for (char ch : magazine.toCharArray()) {
            int index = ch - 'a';

            if (letters[index] < 2) {
                letters[index]++;
            }
        }

        for (char ch : ransomNote.toCharArray()) {
            int index = ch - 'a';
            letters[index]--;

            if (letters[index] < 0) {
                return false;
            }
        }

        return true;
    }
```

## Задание_9

**Условие:**

Задание № 9
Задание: Дан целочисленный массив nums. Определите знак суммы квадратов всех элементов: 1 --- положительная, -1 --- отрицательная, 0 --- равна нулю.
Входные данные: Файл test9_new.csv. Каждая строка --- один массив. Числа разделены запятыми.
Пример строки: -2,-1,0,1,2
Реализовать: метод public int sumOfSquaresSign(int[] nums)
Ограничения: 1 ≤ nums.length ≤ 1000, -100 ≤ nums[i] ≤ 100

**Решение:**

```java
public int sumOfSquaresSign(int[] nums) {
        for (int number : nums) {
            if (number != 0) {
                return 1;
            }
        }

        return 0;
    }
```

## Задание_10

**Условие:**

Задание № 10
Задание: Дан массив nums и массив queries. Каждый запрос [l,r,k,v]. Для каждого запроса пройдите по индексам l, l+k, l+2k, ... ≤ r и замените nums[idx] = v (присвоить значение v). После всех запросов верните сумму всех элементов.
Входные данные: Файл test10_new.csv. Первая строка --- массив nums (числа через запятые). Остальные строки --- запросы, каждая строка содержит l,r,k,v через запятые.
Пример файла:
1,2,3,4,5
0,4,1,10
1,3,2,99
Реализовать: метод public int sumAfterAssignQueries(int[] nums, int[][] queries)
Ограничения: 1 ≤ n ≤ 1000, 1 ≤ q ≤ 1000, 0 ≤ l ≤ r < n, 1 ≤ k ≤ n, 1 ≤ v ≤ 10⁵

**Решение:**

```java
public int sumAfterAssignQueries(int[] nums, int[][] queries) {
        for (int[] query : queries) {
            int left = query[0];
            int right = query[1];
            int step = query[2];
            int value = query[3];

            for (int index = left; index <= right; index += step) {
                nums[index] = value;
            }
        }

        int sum = 0;

        for (int number : nums) {
            sum += number;
        }

        return sum;
    }
```
