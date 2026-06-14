export const largeFileSetupCode = `
from pathlib import Path

Path("your_large_file.txt").write_text("1\\n2\\n3\\n4\\n5\\n", encoding="utf-8")
`

export const mlPlotStdoutMarker = '__ML_PLOT__:'

export const mlCommonSetupCode = `
def display(obj):
    if hasattr(obj, "to_string"):
        try:
            print(obj.to_string())
            return
        except Exception:
            pass
    print(obj)

try:
    import base64
    from io import BytesIO
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    ML_PLOT_STDOUT_MARKER = "${mlPlotStdoutMarker}"

    def __emit_captured_plots():
        figure_numbers = list(plt.get_fignums())

        if not figure_numbers:
            return

        for figure_number in figure_numbers:
            figure = plt.figure(figure_number)
            buffer = BytesIO()
            figure.savefig(buffer, format="png", bbox_inches="tight")
            buffer.seek(0)
            encoded = base64.b64encode(buffer.read()).decode("ascii")
            print(f"{ML_PLOT_STDOUT_MARKER}{encoded}")
            buffer.close()

        plt.close("all")

    def _patched_show(*args, **kwargs):
        __emit_captured_plots()

    plt.show = _patched_show
except Exception:
    pass
`

export const mlxtendCompatSetupCode = `
try:
    import mlxtend  # type: ignore
except Exception:
    import sys
    import types
    from itertools import combinations

    import pandas as pd

    class TransactionEncoder:
        def fit(self, transactions):
            columns = []
            seen = set()

            for transaction in transactions:
                for item in transaction:
                    if item not in seen:
                        seen.add(item)
                        columns.append(item)

            self.columns_ = columns
            return self

        def transform(self, transactions):
            encoded = []

            for transaction in transactions:
                transaction_items = set(transaction)
                encoded.append([item in transaction_items for item in self.columns_])

            return encoded

    def apriori(df, min_support=0.5, use_colnames=False, max_len=None):
        working = df.astype(bool)

        if working.empty:
            return pd.DataFrame(columns=["support", "itemsets"])

        columns = list(working.columns)
        max_size = max_len or len(columns)
        support_map = {}
        results = []
        level = []

        for column in columns:
            support = float(working[column].mean())

            if support >= min_support:
                itemset = frozenset([column])
                support_map[itemset] = support
                level.append(itemset)

        size = 1

        while level and size <= max_size:
            results.extend(level)
            size += 1

            if size > max_size:
                break

            candidates = set()

            for left_index in range(len(level)):
                for right_index in range(left_index + 1, len(level)):
                    candidate = level[left_index] | level[right_index]

                    if len(candidate) != size:
                        continue

                    if any(frozenset(subset) not in support_map for subset in combinations(candidate, size - 1)):
                        continue

                    candidates.add(candidate)

            next_level = []

            for candidate in sorted(candidates, key=lambda itemset: tuple(sorted(itemset))):
                support = float(working[list(candidate)].all(axis=1).mean())

                if support >= min_support:
                    support_map[candidate] = support
                    next_level.append(candidate)

            level = next_level

        rows = []

        for itemset in results:
            value = itemset

            if not use_colnames:
                value = frozenset(columns.index(item) for item in itemset)

            rows.append({
                "support": support_map[itemset],
                "itemsets": value,
            })

        return pd.DataFrame(rows).sort_values("support", ascending=False).reset_index(drop=True)

    def association_rules(frequent_itemsets, metric="confidence", min_threshold=0):
        if frequent_itemsets.empty:
            return pd.DataFrame(
                columns=[
                    "antecedents",
                    "consequents",
                    "antecedent support",
                    "consequent support",
                    "support",
                    "confidence",
                    "lift",
                ]
            )

        support_lookup = {}

        for _, row in frequent_itemsets.iterrows():
            support_lookup[frozenset(row["itemsets"])] = float(row["support"])

        rows = []

        for itemset, support in support_lookup.items():
            if len(itemset) < 2:
                continue

            sorted_items = sorted(itemset)

            for subset_size in range(1, len(sorted_items)):
                for antecedent_tuple in combinations(sorted_items, subset_size):
                    antecedent = frozenset(antecedent_tuple)
                    consequent = frozenset(itemset - antecedent)
                    antecedent_support = support_lookup.get(antecedent)
                    consequent_support = support_lookup.get(consequent)

                    if not antecedent_support or not consequent_support:
                        continue

                    confidence = support / antecedent_support

                    if metric == "confidence" and confidence < min_threshold:
                        continue

                    lift = confidence / consequent_support if consequent_support else 0.0

                    rows.append(
                        {
                            "antecedents": antecedent,
                            "consequents": consequent,
                            "antecedent support": antecedent_support,
                            "consequent support": consequent_support,
                            "support": support,
                            "confidence": confidence,
                            "lift": lift,
                        }
                    )

        result = pd.DataFrame(rows)

        if result.empty:
            return pd.DataFrame(
                columns=[
                    "antecedents",
                    "consequents",
                    "antecedent support",
                    "consequent support",
                    "support",
                    "confidence",
                    "lift",
                ]
            )

        if metric in result.columns:
            result = result[result[metric] >= min_threshold]

        return result.reset_index(drop=True)

    mlxtend_module = types.ModuleType("mlxtend")
    preprocessing_module = types.ModuleType("mlxtend.preprocessing")
    frequent_patterns_module = types.ModuleType("mlxtend.frequent_patterns")

    preprocessing_module.TransactionEncoder = TransactionEncoder
    frequent_patterns_module.apriori = apriori
    frequent_patterns_module.association_rules = association_rules

    mlxtend_module.preprocessing = preprocessing_module
    mlxtend_module.frequent_patterns = frequent_patterns_module

    sys.modules["mlxtend"] = mlxtend_module
    sys.modules["mlxtend.preprocessing"] = preprocessing_module
    sys.modules["mlxtend.frequent_patterns"] = frequent_patterns_module
`

export const anomalyDetectionSetupCode = `
${mlCommonSetupCode}

import numpy as np
import pandas as pd

np.random.seed(42)
rows = 40

_anomaly_df = pd.DataFrame({
    "ID": range(1, rows + 1),
    "loco_11.tu17l1": np.random.normal(25, 2.5, rows),
    "loco_11.tu17r1": np.random.normal(25, 2.0, rows),
    "loco_11.tu17l2": np.random.normal(30, 1.8, rows),
    "loco_11.tu17r2": np.random.normal(30, 1.6, rows),
    "loco_11.tu17l3": np.random.normal(55, 8, rows),
    "loco_11.tu17r3": np.random.normal(56, 7, rows),
    "loco_11.tu17l4": np.random.normal(1180, 40, rows),
    "loco_11.tu17r4": np.random.normal(1185, 38, rows),
    "loco_11.tu17l5": np.random.normal(1080, 35, rows),
    "loco_11.tu17r5": np.random.normal(1085, 30, rows),
}).set_index("ID")

_anomaly_df.loc[5, "loco_11.tu17l4"] = 1415
_anomaly_df.loc[17, "loco_11.tu17r2"] = 48
_anomaly_df.loc[26, "loco_11.tu17l1"] = -3
_anomaly_df.loc[34, "loco_11.tu17r5"] = 1348

_original_read_csv = pd.read_csv

def _fake_read_csv(path, *args, **kwargs):
    if isinstance(path, str) and "loco_11_corr.tsv" in path:
        return _anomaly_df.copy()
    return _original_read_csv(path, *args, **kwargs)

pd.read_csv = _fake_read_csv
`

export const clusterizationSetupCode = `
${mlCommonSetupCode}

import numpy as np
import pandas as pd

np.random.seed(7)
rows = 36

_cluster_df = pd.DataFrame({
    "ID": range(1, rows + 1),
    "Возраст": np.random.randint(19, 62, rows),
    "Доход": np.random.randint(35000, 150000, rows),
    "Поездки_в_год": np.random.randint(1, 18, rows),
    "Средний_чек": np.random.randint(5000, 70000, rows),
    "Багаж_кг": np.random.randint(0, 40, rows),
    "Пол": np.where(np.arange(rows) % 2 == 0, "М", "Ж"),
    "Лояльность": np.random.randint(1, 10, rows),
}).set_index("ID")

_original_read_excel = pd.read_excel

def _fake_read_excel(path, *args, **kwargs):
    if isinstance(path, str) and "Информация о пассажирах" in path:
        return _cluster_df.copy()
    return _original_read_excel(path, *args, **kwargs)

pd.read_excel = _fake_read_excel
`
