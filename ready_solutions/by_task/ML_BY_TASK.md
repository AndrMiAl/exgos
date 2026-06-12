# ML: task-by-task solutions

```python
from pathlib import Path
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.model_selection import train_test_split
DATA_DIR = Path("ml/??_????_csv")
```

## Task 1

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

## Task 2

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

## Task 3

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

## Task 4

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

## Task 5

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

## Task 6

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

## Task 7

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

## Task 8

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

## Task 9

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

## Task 10

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
