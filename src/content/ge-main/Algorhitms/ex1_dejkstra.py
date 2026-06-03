import heapq

class Graph:
    def __init__(self):
        self.nodes = set() #множество всех узлов графа
        self.edges = {} #словарь смежности (какие узлы с какими соединены)
        self.distances = {} #веса ребер

    def add_node(self, value): #добавление узла
        self.nodes.add(value)
        self.edges[value] = []

    def add_edge(self, from_node, to_node, distance): #добавление ребра
        self.edges[from_node].append(to_node)
        self.edges[to_node].append(from_node)  #Для неориентированного графа
        self.distances[(from_node, to_node)] = distance
        self.distances[(to_node, from_node)] = distance  #Для неориентированного графа

def dijkstra(graph, initial):
    visited = {initial: 0} #словарь с кратчайшими известными расстояниями - начальное значение для стартового узла, соответственно, 0
    path = {} #словарь для восстановления путей
    nodes = set(graph.nodes) #множество непосещенных узлов

    while nodes:
        min_node = None
        for node in nodes: #находим узел с минимальным расстоянием из непосещенных
            if node in visited:
                if min_node is None:
                    min_node = node
                elif visited[node] < visited[min_node]:
                    min_node = node

        if min_node is None:
            break  #если такого нет - завершаем работу

        nodes.remove(min_node)#удаляем узел из числа непосещенных
        current_weight = visited[min_node]

        for edge in graph.edges[min_node]: #для каждого соседа этого узла находим новое расстояние
            weight = current_weight + graph.distances[(min_node, edge)]
            if edge not in visited or weight < visited[edge]:
                visited[edge] = weight #если оно меньше известного - обновляем значения
                path[edge] = min_node

    return visited, path

g = Graph()
g.add_node("A")
g.add_node("B")
g.add_node("C")
g.add_node("D")
g.add_node("E")

g.add_edge("A", "B", 6)
g.add_edge("A", "D", 1)
g.add_edge("D", "B", 2)
g.add_edge("D", "E", 1)
g.add_edge("B", "E", 2)
g.add_edge("B", "C", 5)
g.add_edge("E", "C", 5)

print("Кратчайшие расстояния от точки A:")
distances, paths = dijkstra(g, "A")
print(distances)

print("\nПути:")
print(paths)