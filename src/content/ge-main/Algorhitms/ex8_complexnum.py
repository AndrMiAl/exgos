def parse_complex_number(s):
    """Парсит строку вида 'a + i*b' и возвращает кортеж (a, b)."""
    s = s.replace(' ', '')  #удаляем пробелы
    parts = s.split('+') #разделяет строку по +
    a = float(parts[0]) #выделяем действительную часть
    b_part = parts[1].replace('i*', '')
    b = float(b_part) #удаляем i* из мнимой части и сохраняем
    return (a, b)

def complex_sum(z1, z2):
    """Сумма двух комплексных чисел (a1, b1) + (a2, b2) = (a1 + a2, b1 + b2)."""
    return (z1[0] + z2[0], z1[1] + z2[1])

def complex_diff(z1, z2):
    """Разность двух комплексных чисел (a1, b1) - (a2, b2) = (a1 - a2, b1 - b2)."""
    return (z1[0] - z2[0], z1[1] - z2[1])

def complex_mult(z1, z2):
    """Произведение двух комплексных чисел (a1, b1) * (a2, b2) = (a1*a2 - b1*b2, a1*b2 + a2*b1)."""
    a = z1[0] * z2[0] - z1[1] * z2[1]
    b = z1[0] * z2[1] + z2[0] * z1[1]
    return (a, b)

# Ввод данных
z1_str = input("Введите первое комплексное число (например, 2 + i*3): ")
z2_str = input("Введите второе комплексное число (например, -1 + i*4): ")

# Парсинг чисел
z1 = parse_complex_number(z1_str)
z2 = parse_complex_number(z2_str)

# Вычисления
sum_result = complex_sum(z1, z2)
diff_result = complex_diff(z1, z2)
mult_result = complex_mult(z1, z2)

# Вывод результата
print(f"Сумма: {sum_result}")
print(f"Разность: {diff_result}")
print(f"Произведение: {mult_result}")

# Или в виде кортежа
result_tuple = (sum_result, diff_result, mult_result)
print("\nРезультат в виде кортежа:")
print(result_tuple)