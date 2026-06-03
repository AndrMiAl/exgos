def remove_text_in_brackets(text):
    result = []
    stack = []

    for char in text:
        if char == '(':
            stack.append(char)  # Начало скобки
        elif char == ')' and stack:
            stack.pop()  # Конец скобки
        elif not stack:
            result.append(char)  # Добавляем символ, если не внутри скобок

    return ''.join(result)

# Пример использования
text = "Это (пример (вложенных) скобок) и еще (одни) скобки."
clean_text = remove_text_in_brackets(text)
print(clean_text)  # Вывод: "Это  и еще  скобки."