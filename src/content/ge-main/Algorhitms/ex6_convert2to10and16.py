binary_number = input("Введите двоичное число: ").strip()

#Проверка на корректность ввода (только 0 и 1)
if not all(char in '01' for char in binary_number):
    print("Ошибка: введено не двоичное число!")
else:
    #Преобразование в десятичную систему (int с основанием 2)
    decimal_number = int(binary_number, 2)

    #Преобразование в шестнадцатеричную систему (hex)
    hexadecimal_number = hex(decimal_number)

    print(f"Двоичное число: {binary_number}")
    print(f"Десятичное число: {decimal_number}")
    print(f"Шестнадцатеричное число: {hexadecimal_number}")

#ручная реализация
binary_number = input("Введите двоичное число: ").strip()

if not all(char in '01' for char in binary_number):
    print("Ошибка: введено не двоичное число!")
else:
    decimal = 0
    for i, bit in enumerate(reversed(binary_number)): #переворачивает строку с двоичным числом, чтобы обрабатывать биты от младшего разряда к старшему
        decimal += int(bit) * (2 ** i) #enumerate возвращает пары (индекс, бит) для каждого символа в перевернутой строке, затем каждый бит умножается на 2^i, где i - его позиция
        #результат добавляется в decimal


    hex_digits = []
    num = decimal
    if num == 0:
        hex_digits.append('0')
    else:
        while num > 0:
            remainder = num % 16
            if remainder < 10:
                hex_digits.append(str(remainder))
            else:
                hex_digits.append(chr(ord('A') + remainder - 10)) #Преобразуем остаток в букву, если больше 10 и делаем смещение
            num = num // 16
    hexadecimal = '0x' + ''.join(reversed(hex_digits)) #переворачиваем обратно, т.к. изначально оно было у нас перевернуто

    print(f"Десятичное число: {decimal}")
    print(f"Шестнадцатеричное число: {hexadecimal}")