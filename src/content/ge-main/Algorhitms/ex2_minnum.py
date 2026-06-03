numbers = [int(x) for x in input("Введите последовательность натуральных чисел через пробел: ").split()]

# Фильтруем числа, оканчивающиеся на 3, и находим минимальное
numbers_ending_with_3 = [num for num in numbers if num % 10 == 3]

if numbers_ending_with_3:
    min_number = min(numbers_ending_with_3)
    print(f"Минимальное число, оканчивающееся на 3: {min_number}")
else:
    print("В последовательности нет чисел, оканчивающихся на 3")