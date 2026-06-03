def read_large_file(file_path):
    data = []
    with open(file_path, 'r', encoding='utf-8') as file:
        for line in file:  # Чтение файла построчно (ленивое)
            # Обработка строки (например, удаление пробелов)
            processed_line = line.strip()
            if processed_line:  # Если строка не пустая
                data.append(processed_line)
    return data

# Пример использования
file_path = 'your_large_file.txt'
data_array = read_large_file(file_path)
print(f"Прочитано {len(data_array)} строк.")

#многопоточность
from concurrent.futures import ThreadPoolExecutor

def read_file_chunk(start, end, file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        file.seek(start)
        chunk = file.read(end - start)
    return chunk.splitlines()

def parallel_read(file_path, chunk_size=1024*1024*64):  # 64MB чанки
    from os import path
    file_size = path.getsize(file_path)
    chunks = [(i, min(i + chunk_size, file_size)) for i in range(0, file_size, chunk_size)]

    with ThreadPoolExecutor() as executor:
        results = list(executor.map(lambda x: read_file_chunk(*x, file_path), chunks))
    return [line for chunk in results for line in chunk]

#юзаем numpy для числовых данных
import numpy as np
data = np.loadtxt(file_path, dtype=np.float32)  # Для чисел

#и pandas для структурированных
import pandas as pd
chunks = pd.read_csv(file_path, chunksize=100000)
data = pd.concat(chunks)