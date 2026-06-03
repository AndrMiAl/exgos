# Запрашиваем строку у пользователя
input_string = input("Введите строку: ")

# Определяем множество гласных букв
vowels = {'а', 'е', 'ё', 'и', 'о', 'у', 'ы', 'э', 'ю', 'я'}

# Считаем общее количество букв и количество гласных
total_letters = 0
vowel_count = 0

for char in input_string.lower():  # Приводим символ к нижнему регистру
    if char.isalpha():  # Проверяем, является ли символ буквой
        total_letters += 1
        if char in vowels:
            vowel_count += 1

# Вычисляем долю гласных
if total_letters > 0:
    vowel_ratio = vowel_count / total_letters
else:
    vowel_ratio = 0.0

# Выводим результат
print(f"Доля гласных букв в строке: {vowel_ratio:.2%}")  # Форматируем в проценты