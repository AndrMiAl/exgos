import pandas as pd
from datetime import datetime

# Создаем DataFrame
data = {'Date': ['2021-01-18', '2021-01-20', '2021-01-23', '2021-01-25'],
        'event': ['fail', 'correct', 'fail', 'fail']}
df = pd.DataFrame(data)

# Преобразуем столбец 'Date' в datetime для корректного сравнения
df['Date'] = pd.to_datetime(df['Date'])

# Запрашиваем дату у пользователя
try:
    user_date = pd.to_datetime(input("Введите дату в формате 'YYYY-MM-DD': "))
except ValueError:
    print("Некорректный формат даты!")

user_date = pd.to_datetime(user_date)

# Проверяем наличие даты в DataFrame
if user_date in df['Date'].values:
    event = df.loc[df['Date'] == user_date, 'event'].values[0]
    print(f"Дата {user_date.strftime('%Y-%m-%d')} найдена. Событие: {event}")
else:
    print(f"Дата {user_date.strftime('%Y-%m-%d')} не найдена.")

    # Находим ближайшую дату
    df['diff'] = abs(df['Date'] - user_date)
    nearest_date = df.loc[df['diff'].idxmin(), 'Date']
    nearest_event = df.loc[df['diff'].idxmin(), 'event']

    print(f"Ближайшая дата: {nearest_date.strftime('%Y-%m-%d')}. Событие: {nearest_event}")