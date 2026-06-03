def insert_into_heap(heap, new_element):
    heap.append(new_element)  #Добавляем новый элемент в конец кучи
    current_index = len(heap) - 1  #Индекс нового элемента

    #Просеивание вверх
    while current_index > 0:
        parent_index = (current_index - 1) // 2

        if heap[current_index] < heap[parent_index]: #Если текущий элемент меньше родителя, меняем их местами
            heap[current_index], heap[parent_index] = heap[parent_index], heap[current_index]
            current_index = parent_index
        else:
            break  #Если условие кучи выполнено, выходим

    return heap

heap = [1, 3, 6, 5, 9, 8]  #Исходная min-heap
new_element = 4
new_heap = insert_into_heap(heap, new_element)
print(new_heap)  #Выведет [1, 3, 4, 5, 9, 8, 6] или другую валидную перестановку