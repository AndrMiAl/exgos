def fibonacci_iterative(n): #итеративный метод; сложность - O(n); память - O(1)
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

def fibonacci_binet(n): #формула Бине - дает точный результат только для n < 70 из-за ошибок округления
    phi = (1 + 5**0.5) / 2
    return round(phi**n / 5**0.5)


from functools import lru_cache #мемоизация - оптимизированная рекурсия, сложность O(n) благодаря кешированию результатов
@lru_cache(maxsize=None)
def fibonacci_memo(n):
    if n <= 1:
        return n
    return fibonacci_memo(n-1) + fibonacci_memo(n-2)

def fibonacci_recursive(n): #классическая рекурсия - неэффективно для больших n, сложность O(2^n)
    if n <= 1:
        return n
    return fibonacci_recursive(n-1) + fibonacci_recursive(n-2)