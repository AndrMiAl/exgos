import json
import sys

def process_value(value):
    if isinstance(value, list):
        return ', '.join(map(str, value))
    return str(value)

def print_key_value_pairs(json_data):
    for key, value in json_data.items():
        processed_value = process_value(value)
        print(f"{key}: {processed_value}")

def main():
    # Считываем весь ввод из stdin
    input_data = ''.join(sys.stdin.readlines())

    try:
        # Парсим JSON
        json_obj = json.loads(input_data)

        # Проверяем, что это объект (словарь)
        if isinstance(json_obj, dict):
            print_key_value_pairs(json_obj)
        else:
            print("Входные данные должны представлять JSON-объект (словарь)")
    except json.JSONDecodeError:
        print("Ошибка: некорректный JSON")

if __name__ == "__main__":
    main()

