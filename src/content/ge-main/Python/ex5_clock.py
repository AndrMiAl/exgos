n = int(input())

hours = n // 3600
remaining_seconds = n % 3600
minutes = remaining_seconds // 60
seconds = remaining_seconds % 60

# Форматируем вывод, чтобы минуты и секунды были двузначными
print(f"{hours}:{minutes:02d}:{seconds:02d}")