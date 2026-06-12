# Java: task-by-task solutions

```java
import java.util.*;

public class Solutions {
    public static class ListNode {
        int val;
        ListNode next;
        ListNode(int val) { this.val = val; }
    }
}
```

## Task 1. productOfRightElements

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

## Task 2. getCommonMedian

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

## Task 3. compressWithMinRange

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

## Task 4. mergeKListsUnique

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

## Task 5. intersectionAtLeastTwo

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

## Task 6. vowelDigitScore

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

## Task 7. removeDuplicatesAtMostTwo

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

## Task 8. canConstructTwice

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

## Task 9. sumOfSquaresSign

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

## Task 10. sumAfterAssignQueries

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
