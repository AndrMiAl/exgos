class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def delete_node(head: ListNode, index: int) -> ListNode:
    if index < 0:
        return head  #Индекс отрицательный — ничего не делаем

    if index == 0:
        return head.next if head else None  #Удаляем голову

    current = head
    prev = None
    count = 0

    #Ищем узел с нужным индексом
    while current and count < index:
        prev = current
        current = current.next
        count += 1

    if current:  #Если узел найден
        prev.next = current.next  #"Пропускаем" удаляемый узел

    return head

#Создаём список: 1 -> 2 -> 3 -> 4 -> 5
head = ListNode(1, ListNode(2, ListNode(3, ListNode(4, ListNode(5)))))

#Удаляем элемент с индексом 2 (значение 3)
new_head = delete_node(head, 2)

#Проверяем результат: 1 -> 2 -> 4 -> 5
current = new_head
while current:
    print(current.val, end=" -> ")
    current = current.next
#Вывод: 1 -> 2 -> 4 -> 5 ->