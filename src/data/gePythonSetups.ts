export const largeFileSetupCode = `
from pathlib import Path

Path("your_large_file.txt").write_text("1\\n2\\n3\\n4\\n5\\n", encoding="utf-8")
`

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
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.show = lambda *args, **kwargs: print("[График построен]")
except Exception:
    pass
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
