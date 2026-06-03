def cache_result(func):
    # Декоратор для кэширования результата метода перевода числа в римскую систему счисления.
    def wrapper(self, *args, **kwargs):
        # Если результат уже вычислен (solution не пуст), возвращаем его из кэша.
        if self.solution:
            print("Берем число из кэша...")
            return self.solution
        # Если результат ещё не вычислен, вычисляем и кэшируем его.
        print("Вычисляем число...")
        result = func(self, *args, **kwargs)
        self.solution = result  # Сохраняем результат для дальнейшего использования
        return result
    return wrapper

class Class:
    def __init__(self, num):
        # Инициализация экземпляра с натуральным числом num
        # solution - строка (результат перевода в римскую систему счисления)
        self.num = num
        self.solution = ""  # Изначально результат отсутствует

    @cache_result
    def intToRoman(self):
        # Метод перевода числа в римскую систему счисления.
        # Используем словарь соответствия значений римским числам.
        roman_map = [
            (1000, "M"), (900, "CM"),
            (500, "D"), (400, "CD"),
            (100, "C"), (90, "XC"),
            (50, "L"), (40, "XL"),
            (10, "X"), (9, "IX"),
            (5, "V"), (4, "IV"),
            (1, "I")
        ]
        num = self.num  # Копия исходного числа для обработки
        result = ""  # Строка для накопления римского представления

        # Проходим по парам значение-символ в порядке убывания
        for value, numeral in roman_map:
            # Определяем, сколько раз данное римское число укладывается в num
            count = num // value
            if count:
                # Добавляем соответствующее количество римских символов
                result += numeral * count
                # Уменьшаем число на вычтенное значение
                num -= value * count
        return result

    def __str__(self):
        # Метод печати объекта в заданном формате.
        # Выводит сообщение с исходным числом и его римским представлением.
        return f"Число {self.num} в римской системе счисления равно {self.solution}"


#Пример реализации 1
a = Class(495)
a.intToRoman()
print(a)
a.intToRoman()
print(a)

#Пример реализации 2
b = Class(1949)
b.intToRoman()
print(b)
b.intToRoman()
print(b)