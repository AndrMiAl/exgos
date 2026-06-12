# ML

## Задание_1

**Условие:**

Задание №1
Данные: sales_data.csv
Считайте CSV-файл, выведите первые 5 строк и информацию о пропусках. Постройте гистограмму распределения revenue. Постройте boxplot распределения выручки по категории product_category. Из колонки date выделите месяц и добавьте как новый столбец month.

**Решение:**

```python
def task1():
    df = pd.read_csv(DATA_DIR / "sales_data.csv")

    print(df.head())
    print(df.isna().sum())

    df["revenue"].hist()
    plt.title("Распределение выручки")
    plt.show()

    df.boxplot(column="revenue", by="product_category")
    plt.title("Выручка по категориям")
    plt.show()

    df["date"] = pd.to_datetime(df["date"])
    df["month"] = df["date"].dt.month

    return df
```

## Задание_2

**Условие:**

Задание №2
Данные: customer_segmentation.csv
Выберите два числовых признака для кластеризации. Примените k-means (k=4). Добавьте метки кластеров в датафрейм. Постройте scatter plot точек, окрашенных по кластерам.

**Решение:**

```python
def task2():
    from sklearn.cluster import KMeans

    df = pd.read_csv(DATA_DIR / "customer_segmentation.csv")

    numeric_columns = df.select_dtypes(include="number").columns
    first_feature = numeric_columns[0]
    second_feature = numeric_columns[1]

    x = df[[first_feature, second_feature]]

    model = KMeans(n_clusters=4, random_state=42, n_init=10)
    df["cluster"] = model.fit_predict(x)

    plt.scatter(df[first_feature], df[second_feature], c=df["cluster"])
    plt.xlabel(first_feature)
    plt.ylabel(second_feature)
    plt.show()

    return df
```

## Задание_3

**Условие:**

Задание №3
Данные: electricity_anomalies.csv
Рассчитайте отклонение: deviation = actual_consumption - (temp * 0.5 + weekday_impact). Используя метод трёх сигм, найдите аномалии. Выведите количество и первые 5 аномальных записей.

**Решение:**

```python
def task3():
    df = pd.read_csv(DATA_DIR / "electricity_anomalies.csv")

    expected = df["temp"] * 0.5 + df["weekday_impact"]
    df["deviation"] = df["actual_consumption"] - expected

    mean = df["deviation"].mean()
    std = df["deviation"].std()

    left_border = mean - 3 * std
    right_border = mean + 3 * std

    anomalies = df[
        (df["deviation"] < left_border) |
        (df["deviation"] > right_border)
    ]

    print("Количество аномалий:", len(anomalies))
    print(anomalies.head())

    return anomalies
```

## Задание_4

**Условие:**

Задание №4
Данные: customer_churn_classification.csv
Целевая переменная: churn (1 — ушёл, 0 — остался). Разделите данные на train/test (70/30). Обучите логистическую регрессию. Выведите accuracy и confusion matrix.

**Решение:**

```python
def task4():
    df = pd.read_csv(DATA_DIR / "customer_churn_classification.csv")

    x = df.drop(columns=["churn"])
    x = pd.get_dummies(x, drop_first=True)
    y = df["churn"]

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.3,
        random_state=42,
    )

    model = LogisticRegression(max_iter=1000)
    model.fit(x_train, y_train)

    prediction = model.predict(x_test)

    print("accuracy:", accuracy_score(y_test, prediction))
    print(confusion_matrix(y_test, prediction))
```

## Задание_5

**Условие:**

Задание №5
Данные: house_price_regression.csv
Целевая переменная: price. Разделите данные (80/20). Обучите линейную регрессию. Вычислите MAE и RMSE. Постройте scatter plot реальных vs предсказанных цен.

**Решение:**

```python
def task5():
    df = pd.read_csv(DATA_DIR / "house_price_regression.csv")

    x = df.drop(columns=["price"])
    x = pd.get_dummies(x, drop_first=True)
    y = df["price"]

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=42,
    )

    model = LinearRegression()
    model.fit(x_train, y_train)

    prediction = model.predict(x_test)

    print("MAE:", mean_absolute_error(y_test, prediction))
    print("RMSE:", mean_squared_error(y_test, prediction, squared=False))

    plt.scatter(y_test, prediction)
    plt.xlabel("Реальные цены")
    plt.ylabel("Предсказанные цены")
    plt.show()
```

## Задание_6

**Условие:**

Задание №6
Данные: stock_time_series.csv
Установите date как индекс. Постройте линейный график close_price. Создайте признак lag_1 — цена за предыдущий день. Обучите линейную регрессию, предсказывающую цену по лагу. Сделайте прогноз на последние 30 дней, вычислите MAE.

**Решение:**

```python
def task6():
    df = pd.read_csv(DATA_DIR / "stock_time_series.csv")
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date")

    df["close_price"].plot()
    plt.title("Цена закрытия")
    plt.show()

    df["lag_1"] = df["close_price"].shift(1)
    df = df.dropna()

    train = df.iloc[:-30]
    test = df.iloc[-30:]

    model = LinearRegression()
    model.fit(train[["lag_1"]], train["close_price"])

    prediction = model.predict(test[["lag_1"]])

    print("MAE за последние 30 дней:", mean_absolute_error(test["close_price"], prediction))
```

## Задание_7

**Условие:**

Задание №7
Данные: employee_attrition.csv
Целевая переменная: attrition. Разделите данные (70/30, random_state=42). Обучите Random Forest. Извлеките важность признаков и постройте barplot. Назовите три самых важных признака.

**Решение:**

```python
def task7():
    df = pd.read_csv(DATA_DIR / "employee_attrition.csv")

    x = df.drop(columns=["attrition"])
    x = pd.get_dummies(x, drop_first=True)
    y = df["attrition"]

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.3,
        random_state=42,
    )

    model = RandomForestClassifier(random_state=42)
    model.fit(x_train, y_train)

    importances = pd.Series(model.feature_importances_, index=x.columns)
    importances = importances.sort_values(ascending=False)

    print("Три самых важных признака:")
    print(importances.head(3))

    importances.head(15).plot(kind="bar")
    plt.title("Важность признаков")
    plt.show()
```

## Задание_8

**Условие:**

Задание №8
Данные: product_reviews.csv
Создайте целевую переменную: rating >= 4 → положительный (1), иначе 0. Разделите данные (70/30). Примените TfidfVectorizer к review_text. Обучите логистическую регрессию. Выведите accuracy.

**Решение:**

```python
def task8():
    df = pd.read_csv(DATA_DIR / "product_reviews.csv")

    x = df["review_text"].fillna("")
    y = (df["rating"] >= 4).astype(int)

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.3,
        random_state=42,
    )

    model = Pipeline([
        ("tfidf", TfidfVectorizer()),
        ("logreg", LogisticRegression(max_iter=1000)),
    ])

    model.fit(x_train, y_train)
    prediction = model.predict(x_test)

    print("accuracy:", accuracy_score(y_test, prediction))
```

## Задание_9

**Условие:**

Задание №9
Данные: market_basket.csv
Каждая строка — список товаров, разделённых запятыми. Преобразуйте в one-hot через mlxtend. Примените Apriori (support ≥ 0.05). Сгенерируйте правила и выведите 5 правил с наибольшим confidence.

**Решение:**

```python
def task9():
    from mlxtend.frequent_patterns import apriori, association_rules
    from mlxtend.preprocessing import TransactionEncoder

    df = pd.read_csv(DATA_DIR / "market_basket.csv", header=None)

    transactions = []

    for text in df[0]:
        products = []

        for product in text.split(","):
            products.append(product.strip())

        transactions.append(products)

    encoder = TransactionEncoder()
    encoded = encoder.fit(transactions).transform(transactions)
    one_hot = pd.DataFrame(encoded, columns=encoder.columns_)

    frequent_items = apriori(one_hot, min_support=0.05, use_colnames=True)
    rules = association_rules(frequent_items, metric="confidence", min_threshold=0)

    rules = rules.sort_values("confidence", ascending=False)
    print(rules.head(5))
```

## Задание_10

**Условие:**

Задание №10
Данные: full_employee_data.csv
Целевая переменная: salary. Выберите только числовые признаки. Разделите данные (80/20, random_state=42). Постройте Pipeline: StandardScaler → LinearRegression. Обучите на train, вычислите RMSE на test.

**Решение:**

```python
def task10():
    df = pd.read_csv(DATA_DIR / "full_employee_data.csv")

    numeric_data = df.select_dtypes(include="number")

    x = numeric_data.drop(columns=["salary"])
    y = numeric_data["salary"]

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=42,
    )

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("linear_regression", LinearRegression()),
    ])

    model.fit(x_train, y_train)
    prediction = model.predict(x_test)

    rmse = mean_squared_error(y_test, prediction, squared=False)
    print("RMSE:", rmse)
```
