# Algorithms: task-by-task solutions

## Task 1. next_greater_height

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

## Task 2. max_freq_char_sum

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

## Task 3. find_kth_element

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

## Task 4. merge_sorted_times and merge_sort_times

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

## Task 5. binary_search_first and find_root

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

## Task 6. is_valid_tags

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
