from __future__ import annotations

import importlib.util
import sys
import types
import unittest
from datetime import datetime, timedelta
from pathlib import Path


def load_dashboard_module():
    flask_stub = types.ModuleType("flask")

    class _Flask:
        def __init__(self, name: str) -> None:
            self.name = name

        def get(self, _path: str):
            def decorator(fn):
                return fn

            return decorator

    flask_stub.Flask = _Flask
    flask_stub.Response = str
    flask_stub.jsonify = lambda payload: payload
    sys.modules.setdefault("flask", flask_stub)

    module_path = Path(__file__).resolve().parents[1] / "traffic_dashboard_server.py"
    spec = importlib.util.spec_from_file_location("traffic_dashboard_server", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


dashboard = load_dashboard_module()


class DiagnosticsTests(unittest.TestCase):
    def test_build_diagnostics_flags_large_gap_and_multi_inbound_clients(self) -> None:
        summary = {
            "clients_today_total": 100 * 1024**2,
            "clients_month_total": 800 * 1024**2,
            "eth0_today": 5 * 1024**3,
            "wg0_today": 2 * 1024**3,
            "awg0_today": 0,
        }
        clients = [
            {
                "name": "my_pc",
                "today_used": 90 * 1024**2,
                "month_used": 600 * 1024**2,
                "used": 900 * 1024**2,
                "inbounds": ["a", "b", "c"],
            },
            {
                "name": "ann",
                "today_used": 10 * 1024**2,
                "month_used": 200 * 1024**2,
                "used": 300 * 1024**2,
                "inbounds": ["trojan"],
            },
        ]

        diagnostics = dashboard.build_diagnostics(summary, clients)

        self.assertEqual(diagnostics["top_talker"]["name"], "my_pc")
        self.assertEqual(diagnostics["top_talker"]["share_pct"], 90.0)
        self.assertEqual(diagnostics["multi_inbound_clients"], 1)
        self.assertGreater(diagnostics["estimated_user_traffic_today"], summary["clients_today_total"])
        self.assertTrue(any(alert["kind"] == "gap" for alert in diagnostics["alerts"]))
        self.assertEqual(diagnostics["suspects"][0]["name"], "my_pc")


class TimelineTests(unittest.TestCase):
    def test_aggregate_client_totals_timeline_sums_cumulative_snapshots_by_day(self) -> None:
        now = datetime(2026, 6, 20, 14, 0, 0)
        snapshots = [
            {
                "ts": int(datetime(2026, 6, 18, 23, 55, 0).timestamp()),
                "clients": {"a": 100, "b": 50},
            },
            {
                "ts": int(datetime(2026, 6, 19, 9, 0, 0).timestamp()),
                "clients": {"a": 160, "b": 80},
            },
            {
                "ts": int(datetime(2026, 6, 19, 22, 0, 0).timestamp()),
                "clients": {"a": 220, "b": 100},
            },
            {
                "ts": int(datetime(2026, 6, 20, 8, 0, 0).timestamp()),
                "clients": {"a": 260, "b": 150},
            },
        ]

        series = dashboard.aggregate_client_totals_timeline(snapshots, "month", now)

        self.assertEqual(series["labels"][-2:], ["19/06", "20/06"])
        self.assertEqual(series["values"][-2], 170)
        self.assertEqual(series["values"][-1], 90)


class HtmlTemplateTests(unittest.TestCase):
    def test_html_template_exposes_diagnostics_and_comparison_views(self) -> None:
        html = dashboard.HTML

        self.assertIn('id="signalsGrid"', html)
        self.assertIn('id="suspectsBody"', html)
        self.assertIn("data.diagnostics.suspects", html)
        self.assertIn("data.server_daily.estimated_user_total", html)
        self.assertIn("data.server_daily.clients_total", html)
        self.assertIn("today_share_pct", html)
        self.assertIn("inbounds_count", html)


if __name__ == "__main__":
    unittest.main()
