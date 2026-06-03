class CountAndSay:
    def __init__(self, num): #конструктор класса
        if not isinstance(num, int) or num <= 0:
            raise ValueError("num должно быть натуральным числом")
        self.num = num #сохраняем входное число
        self.solution = "" #инициализируем пустую строку для сохранения результата

    def countAndSay(self):
        if self.num == 1: #базовый случай
            self.solution = "1"
            return self.solution

        current = "1" #номер итерации
        for _ in range(1, self.num): #выполняем n-1 итерация, т.к. первая уже сделана
            next_str = "" #строка для следующей итерации
            count = 1 #счетчик повторяющихся цифр
            for i in range(1, len(current)): #прохождение по строке, начиная со второго символа
                if current[i] == current[i-1]:
                    count += 1 #если цифра совпадает с предыдущей - увеличиваем счетчик
                else:
                    next_str += str(count) + current[i-1] #если цифра поменялась - добавляем пару (количество цифра)
                    count = 1 #сбрасываем счетчик
            next_str += str(count) + current[-1] #добавляем последнюю накопленную пару
            current = next_str #обновляем для следующей итерации

        self.solution = current #сохраняем и возвращаем результат
        return self.solution

    def __str__(self):
        if not self.solution:
            return f"Операция ещё не выполнена"
        return f"Выполнение операции {self.num} раз дает ответ {self.solution}"


#Пример использования 1
a = CountAndSay(4)
a.countAndSay()
print(a)

#Пример использования 2
b = CountAndSay(7)
b.countAndSay()
print(b)