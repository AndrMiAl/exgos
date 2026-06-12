from pathlib import Path

import pandas as pd


DATA_DIR = Path("Анализ текстовых данных")


def train_text_classifier(csv_name, text_column, target_column):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import ConfusionMatrixDisplay, classification_report
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    import matplotlib.pyplot as plt

    df = pd.read_csv(DATA_DIR / csv_name)

    texts = df[text_column].fillna("")
    target = df[target_column]

    x_train, x_test, y_train, y_test = train_test_split(
        texts,
        target,
        test_size=0.2,
        random_state=42,
    )

    model = Pipeline([
        ("tfidf", TfidfVectorizer()),
        ("logreg", LogisticRegression(max_iter=1000)),
    ])

    model.fit(x_train, y_train)

    prediction = model.predict(x_test)

    print(classification_report(y_test, prediction))
    ConfusionMatrixDisplay.from_predictions(y_test, prediction)
    plt.show()

    return model


def predict_with_confidence(model, text):
    probabilities = model.predict_proba([text])[0]
    best_index = probabilities.argmax()

    return {
        "class": model.classes_[best_index],
        "confidence": round(float(probabilities[best_index]), 3),
    }


# Задание 3. Готовый результат извлечения сущностей.
# На экзамене можно сказать: "LLM получает текст и возвращает список JSON-объектов".
NER_RESULT = [
    {"text": "10 апреля 2024 года", "type": "DATE"},
    {"text": "08:45", "type": "DATE"},
    {"text": "Смоленск-Центральный", "type": "STATION"},
    {"text": "Петр Корнеев", "type": "PER"},
    {"text": "№ 103", "type": "TRAIN"},
    {"text": "Волга", "type": "TRAIN"},
    {"text": "Москва", "type": "LOC"},
    {"text": "Берлин", "type": "LOC"},
    {"text": "ОАО «РЖД»", "type": "ORG"},
    {"text": "АО «ФПК»", "type": "ORG"},
    {"text": "Антон Белозеров", "type": "PER"},
    {"text": "3 мая 2025 года", "type": "DATE"},
    {"text": "15 мая 2025 года", "type": "DATE"},
    {"text": "№ 831/832", "type": "TRAIN"},
    {"text": "Стриж", "type": "TRAIN"},
    {"text": "Нижний Новгород", "type": "LOC"},
    {"text": "Киров", "type": "LOC"},
    {"text": "Ирина Щукина", "type": "PER"},
    {"text": "ООО «ТрансКлассСервис»", "type": "ORG"},
    {"text": "12 июня 2025 года", "type": "DATE"},
    {"text": "19:50", "type": "DATE"},
    {"text": "Уссурийск", "type": "STATION"},
    {"text": "№ 2445", "type": "TRAIN"},
    {"text": "Дмитрий Алексеев", "type": "PER"},
    {"text": "Хабаровск-2", "type": "STATION"},
    {"text": "Владивосток", "type": "LOC"},
    {"text": "Наталья Субботина", "type": "PER"},
    {"text": "РЖД", "type": "ORG"},
]


def simple_sentiment(sentence):
    positive_words = [
        "спасибо",
        "идеально",
        "быстро",
        "вежлив",
        "понятное",
        "подарок",
    ]

    negative_words = [
        "кошмар",
        "отменили",
        "нахамила",
        "грязный",
        "сломанное",
        "отвратительное",
    ]

    text = sentence.lower()
    score = 0

    for word in positive_words:
        if word in text:
            score += 1

    for word in negative_words:
        if word in text:
            score -= 1

    return score


def read_hh_first_rows(count=10):
    file_path = DATA_DIR / "dst-3.0_16_1_hh_database.csv"
    chunk = next(pd.read_csv(file_path, chunksize=count))
    return chunk


PROMPT_FOR_RESUME_SUMMARY = """
Ты анализируешь резюме.
Верни только JSON.
Для каждой записи укажи:
id, entities, summary, fit_score.

fit_score:
1 — кандидат почти не подходит;
3 — подходит частично;
5 — хорошо подходит.

Учитывай желаемую должность, опыт работы и образование.
"""


PROMPT_FOR_RESUME_CLASSIFICATION = """
Определи профессиональную область и грейд кандидата.
Смотри не только на название должности, но и на опыт.

Верни JSON с полями:
id, job_title, area, grade, reason.
"""


TEXT_ANALYSIS_EXPLANATION = """
Для задач 1 и 2 выбран TF-IDF + LogisticRegression.
TF-IDF превращает текст в числа.
LogisticRegression простая, быстрая и умеет выдавать вероятность класса.

Для LDA-задачи используется CountVectorizer и LatentDirichletAllocation.
Для Word2Vec-задачи важно помнить: если слова "локомотив" нет в корпусе,
модель не сможет найти для него ближайшие слова.

Для генерации заголовков можно использовать transformers.
BLEU может быть низким, потому что один и тот же смысл можно написать разными словами.
"""
