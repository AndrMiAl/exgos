import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from scipy import stats


# Загрузка данных
df = pd.read_csv('/content/drive/MyDrive/loco_11_corr.tsv', sep='\t', header = 0, index_col = 'ID')

# Предварительный анализ
print(f"Всего записей: {len(df)}")
print("\nТипы данных:\n", df.dtypes)
print("\nОписательная статистика:\n", df.describe())

# 1. Предобработка данных
# Выбор числовых параметров бандажей
features = ['loco_11.tu17l1', 'loco_11.tu17r1', 'loco_11.tu17l2', 'loco_11.tu17r2',
            'loco_11.tu17l3', 'loco_11.tu17r3', 'loco_11.tu17l4', 'loco_11.tu17r4',
            'loco_11.tu17l5', 'loco_11.tu17r5']

# Удаление строк с пропусками
df_clean = df.dropna(subset=features).copy()

# Нормализация данных
scaler = StandardScaler()
X_scaled = scaler.fit_transform(df_clean[features])

# 2. Определение оптимального числа кластеров
inertia = []
k_range = range(2, 10)

for k in k_range:
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    kmeans.fit(X_scaled)
    inertia.append(kmeans.inertia_)

# Визуализация метода локтя
plt.figure(figsize=(12, 5))
plt.subplot(1, 2, 1)
plt.plot(k_range, inertia, 'bo-')
plt.xlabel('Количество кластеров')
plt.ylabel('Инерция')
plt.title('Метод локтя')


# Выбираем оптимальное число кластеров (например, 4)
optimal_k = 4

# 3. Кластеризация K-Means
kmeans = KMeans(n_clusters=optimal_k, random_state=42, n_init=10)
df_clean['cluster'] = kmeans.fit_predict(X_scaled)

# 4. Вычисление расстояний до центроидов для обнаружения аномалий
centroids = kmeans.cluster_centers_
distances = np.min([np.linalg.norm(X_scaled - centroid, axis=1) for centroid in centroids], axis=0)

# Определение аномалий как 5% точек с наибольшими расстояниями
anomaly_threshold = np.percentile(distances, 95)
df_clean['is_anomaly'] = distances > anomaly_threshold

# 5. Визуализация кластеров и аномалий (с PCA для уменьшения размерности)
pca = PCA(n_components=2)
X_pca = pca.fit_transform(X_scaled)

plt.figure(figsize=(12, 6))
sns.scatterplot(x=X_pca[:, 0], y=X_pca[:, 1],
                hue=df_clean['cluster'],
                style=df_clean['is_anomaly'],
                palette='viridis',
                size=df_clean['is_anomaly'],
                sizes={False: 30, True: 100})
plt.title('Кластеры и аномалии (PCA проекция)')
plt.xlabel('PCA Component 1')
plt.ylabel('PCA Component 2')
plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
plt.tight_layout()
plt.show()

# 6. Анализ аномалий статистическими методами
def detect_outliers_iqr(data, feature, threshold=1.5):
    Q1 = data[feature].quantile(0.25)
    Q3 = data[feature].quantile(0.75)
    IQR = Q3 - Q1
    lower = Q1 - threshold * IQR
    upper = Q3 + threshold * IQR
    return (data[feature] < lower) | (data[feature] > upper)

# Выявление выбросов по каждому параметру
for feature in features:
    df_clean[f'outlier_{feature}'] = detect_outliers_iqr(df_clean, feature)

# 7. Технические ограничения (примерные значения)
tech_limits = {
    'tu17l1': (0, 50),    # Прокат левого бандажа (мм)
    'tu17r1': (0, 50),    # Прокат правого бандажа (мм)
    'tu17l2': (20, 40),   # Толщина гребня левого (мм)
    'tu17r2': (20, 40),   # Толщина гребня правого (мм)
    'tu17l3': (0, 100),   # Крутизна гребня левого (мм)
    'tu17r3': (0, 100),   # Крутизна гребня правого (мм)
    'tu17l4': (1000, 1300), # Толщина левого бандажа (мм)
    'tu17r4': (1000, 1300), # Толщина правого бандажа (мм)
    'tu17l5': (900, 1300),  # Диаметр левого бандажа (мм)
    'tu17r5': (900, 1300)   # Диаметр правого бандажа (мм)
}

# Выявление технически невозможных значений
tech_anomalies = pd.DataFrame()
for param, (min_val, max_val) in tech_limits.items():
    anomalies = df_clean[(df_clean[param] < min_val) | (df_clean[param] > max_val)]
    if not anomalies.empty:
        tech_anomalies = pd.concat([tech_anomalies, anomalies])

# 8. Сводный анализ аномалий
print("\n=== Сводка по аномалиям ===")
print(f"Всего записей: {len(df_clean)}")
print(f"Аномалии по K-Means (расстояние до центроида): {df_clean['is_anomaly'].sum()}")
print(f"Технически невозможные значения: {len(tech_anomalies)}")

# Создаем общий флаг аномалий
df_clean['final_anomaly'] = df_clean['is_anomaly']
for feature in features:
    df_clean['final_anomaly'] = df_clean['final_anomaly'] | df_clean[f'outlier_{feature}']

# 9. Анализ кластеров
cluster_stats = df_clean.groupby('cluster')[features].mean()
print("\nСредние значения по кластерам:\n", cluster_stats)

# 10. Подготовка данных для машинного обучения
# Удаление аномалий
df_final = df_clean[~df_clean['final_anomaly']].copy()

# Разделение на обучающую и тестовую выборки (80/20)
from sklearn.model_selection import train_test_split
train_df, test_df = train_test_split(df_final, test_size=0.2, random_state=42)

print(f"\nРазмер обучающей выборки: {len(train_df)}")
print(f"Размер тестовой выборки: {len(test_df)}")

# Визуализация распределения параметров без аномалий
plt.figure(figsize=(15, 10))
for i, feature in enumerate(features, 1):
    plt.subplot(4, 3, i)
    sns.boxplot(data=df_final, y=feature)
    plt.title(feature)
plt.tight_layout()
plt.show()