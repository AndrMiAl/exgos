def bubble_sort(arr):
    n = len(arr)
    # Проходим по массиву n-1 раз
    for i in range(n - 1):
        #Флаг для оптимизации (если массив уже отсортирован)
        swapped = False
        #Проходим по массиву от 0 до n-i-1
        for j in range(n - i - 1):
            #Если текущий элемент больше следующего, меняем их местами
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        #Если за проход не было перестановок, массив отсортирован
        if not swapped:
            break
    return arr

numbers = [64, 34, 25, 12, 22, 11, 90]
sorted_numbers = bubble_sort(numbers)
print(sorted_numbers)  # [11, 12, 22, 25, 34, 64, 90]