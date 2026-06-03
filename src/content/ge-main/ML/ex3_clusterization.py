import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from sklearn.decomposition import PCA
from pandas.plotting import parallel_coordinates
from mpl_toolkits.mplot3d import Axes3D

# 1. Загрузка данных (используем встроенный датасет для примера)
df = pd.read_excel("/content/drive/MyDrive/Информация о пассажирах.xlsx", index_col = "ID")
print("Первые 5 строк данных:")
display(df.head())

df["Пол"] = df["Пол"].replace("М", 0)
df["Пол"] = df["Пол"].replace("Ж", 1)

display(df.head())
# 2. Выбор переменных для кластеризации (5 числовых признаков)
features = df.columns[:5] if len(df.columns) >=5 else df.columns
print(f"\nВыбранные переменные для кластеризации: {list(features)}")

# 3. Масштабирование данных
scaler = StandardScaler()
X_scaled = scaler.fit_transform(df[features])

# 4. K-means с elbow method
print("\nK-means кластеризация:")
wcss = []
for i in range(1, 11):
    kmeans = KMeans(n_clusters=i, init='k-means++', random_state=42)
    kmeans.fit(X_scaled)
    wcss.append(kmeans.inertia_)

# График elbow method
plt.figure(figsize=(10, 5))
plt.plot(range(1, 11), wcss, marker='o')
plt.title('Elbow Method')
plt.xlabel('Number of clusters')
plt.ylabel('Расстояние между элементами')
plt.show()

# Выбираем оптимальное число кластеров
n_clusters = 6  # По графику выбираем точку изгиба
kmeans = KMeans(n_clusters=n_clusters, random_state=42)
kmeans_labels = kmeans.fit_predict(X_scaled)
df['kmeans_cluster'] = kmeans_labels

# 5. DBSCAN кластеризация
print("\nDBSCAN кластеризация:")
dbscan = DBSCAN(eps=0.5, min_samples=5)
dbscan_labels = dbscan.fit_predict(X_scaled)
df['dbscan_cluster'] = dbscan_labels

# Оценка числа кластеров DBSCAN
n_clusters_dbscan = len(set(dbscan_labels)) - (1 if -1 in dbscan_labels else 0)
print(f"DBSCAN обнаружил {n_clusters_dbscan} кластеров")

# 6. Визуализация в параллельных координатах
plt.figure(figsize=(15, 6))
plt.subplot(1, 2, 1)
parallel_coordinates(df, 'kmeans_cluster', cols=features)
plt.title('K-means кластеризация')

plt.subplot(1, 2, 2)
parallel_coordinates(df, 'dbscan_cluster', cols=features)
plt.title('DBSCAN кластеризация')
plt.show()

# 7. 2D визуализация кластеров
# Используем PCA для уменьшения размерности
pca = PCA(n_components=3)
X_pca = pca.fit_transform(X_scaled)

# 2D графика (первые две компоненты)
plt.figure(figsize=(15, 5))

plt.subplot(1, 2, 1)
plt.scatter(X_pca[:, 0], X_pca[:, 1], c=kmeans_labels, cmap='viridis')
plt.title('K-means (2D)')
plt.xlabel('PCA 1')
plt.ylabel('PCA 2')

plt.subplot(1, 2, 2)
plt.scatter(X_pca[:, 0], X_pca[:, 1], c=dbscan_labels, cmap='viridis')
plt.title('DBSCAN (2D)')
plt.xlabel('PCA 1')
plt.ylabel('PCA 2')
plt.show()


# 8. Вывод результатов кластеризации
print("\nРезультаты кластеризации:")
print(f"K-means (n_clusters={n_clusters}):")
print(df['kmeans_cluster'].value_counts())

print("\nDBSCAN:")
print(df['dbscan_cluster'].value_counts())