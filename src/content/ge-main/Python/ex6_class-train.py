class Train:
    def __init__(self, type, speed):
        self.type = type  # Тип поезда (например, "пассажирский", "грузовой")
        self.speed = speed  # Скорость поезда (число)

# Создаем экземпляр класса Train
my_train = Train(type="грузовой", speed=120)

# Возвращаем скорость поезда
print(my_train.speed)