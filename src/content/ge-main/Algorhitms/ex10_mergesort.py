def merge_sort(arr):
    if len(arr) > 1:
        #Находим середину массива
        mid = len(arr) // 2
        #Делим массив на две половины
        left_half = arr[:mid]
        right_half = arr[mid:]

        #Рекурсивно сортируем каждую половину
        merge_sort(left_half)
        merge_sort(right_half)

        #Слияние отсортированных половин
        i = j = k = 0

        while i < len(left_half) and j < len(right_half):
            if left_half[i] < right_half[j]:
                arr[k] = left_half[i]
                i += 1
            else:
                arr[k] = right_half[j]
                j += 1
            k += 1

        #Добавляем оставшиеся элементы из left_half
        while i < len(left_half):
            arr[k] = left_half[i]
            i += 1
            k += 1

        #Добавляем оставшиеся элементы из right_half
        while j < len(right_half):
            arr[k] = right_half[j]
            j += 1
            k += 1

    return arr

numbers = [38, 27, 43, 3, 9, 82, 10]
sorted_numbers = merge_sort(numbers.copy())  # Используем copy(), чтобы не изменять исходный массив
print("Исходный массив:", numbers)
print("Отсортированный массив:", sorted_numbers)