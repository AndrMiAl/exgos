mkdir -p /opt/traffic-web

cat > /opt/traffic-web/app.py <<'PY'
from __future__ import annotations

import json
import sqlite3
import subprocess
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, Response


app = Flask(__name__)

DB_CANDIDATES = [
    Path("/etc/x-ui/x-ui.db"),
    Path("/usr/local/x-ui/x-ui.db"),
    Path("/opt/x-ui/x-ui.db"),
]
NGINX_ACCESS_LOG = Path("/var/log/nginx/access.log")
ONLINE_WINDOW_SECONDS = 300


HTML = r"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Traffic Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b1020;
      --panel: #121934;
      --line: #263462;
      --text: #ebf1ff;
      --muted: #99a9d4;
      --accent: #5ca6ff;
      --accent2: #46d39f;
      --warn: #ffb84d;
      --danger: #ff6a88;
      --shadow: 0 18px 40px rgba(0, 0, 0, .28);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Segoe UI, Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(92,166,255,.12), transparent 28%),
        radial-gradient(circle at top right, rgba(70,211,159,.10), transparent 22%),
        var(--bg);
    }
    .wrap { width: min(1480px, calc(100% - 32px)); margin: 24px auto 40px; }
    .hero { display: flex; justify-content: space-between; gap: 16px; align-items: flex-end; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 34px; line-height: 1.1; font-weight: 800; }
    .sub { margin-top: 8px; color: var(--muted); font-size: 15px; }
    .stamp { color: var(--muted); font-size: 13px; white-space: nowrap; }
    .stats { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
    .card, .stat {
      background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.01));
      border: 1px solid rgba(124, 152, 219, .18);
      border-radius: 18px;
      box-shadow: var(--shadow);
    }
    .stat { padding: 16px 18px; }
    .stat .label { color: var(--muted); font-size: 13px; margin-bottom: 10px; }
    .stat .value { font-size: 26px; font-weight: 800; }
    .grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; margin-bottom: 16px; }
    .small-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { padding: 18px; }
    .title { margin: 0 0 14px; font-size: 20px; font-weight: 700; }
    .table-wrap { overflow: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 13px 10px; border-bottom: 1px solid rgba(124,152,219,.12); vertical-align: top; }
    th { color: var(--muted); font-weight: 600; position: sticky; top: 0; background: #121934; z-index: 1; }
    .client { display: flex; flex-direction: column; gap: 4px; }
    .client .name { font-weight: 700; font-size: 15px; }
    .client .meta { color: var(--muted); font-size: 12px; font-family: Consolas, ui-monospace, monospace; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      border: 1px solid rgba(92,166,255,.18);
      background: rgba(92,166,255,.10);
      color: #cfe1ff;
      padding: 5px 9px;
      border-radius: 999px;
      font-size: 12px;
      white-space: nowrap;
    }
    .status { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .online .dot { background: #46d39f; box-shadow: 0 0 18px rgba(70,211,159,.55); }
    .offline .dot { background: #6f7ea8; }
    .muted { color: var(--muted); }
    .mono { font-family: Consolas, ui-monospace, monospace; }
    canvas { width: 100% !important; height: 320px !important; }
    @media (max-width: 1200px) {
      .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .grid, .small-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .wrap { width: min(100% - 20px, 1480px); }
      .hero { flex-direction: column; align-items: flex-start; }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      h1 { font-size: 28px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div>
        <h1>Трафик и клиенты 3x-ui</h1>
        <div class="sub">Понятная сводка по серверу, VPN и клиентам из 3x-ui.</div>
      </div>
      <div class="stamp" id="updatedAt">Загрузка...</div>
    </div>
    <div class="stats" id="stats"></div>
    <div class="grid">
      <div class="card">
        <h2 class="title">Трафик по часам</h2>
        <canvas id="hourlyChart"></canvas>
      </div>
      <div class="card">
        <h2 class="title">Трафик по дням</h2>
        <canvas id="dailyChart"></canvas>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px;">
      <h2 class="title">Клиенты 3x-ui</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Статус</th>
              <th>Использовано</th>
              <th>Лимит</th>
              <th>Последний онлайн</th>
              <th>Подключения</th>
            </tr>
          </thead>
          <tbody id="clientsBody"></tbody>
        </table>
      </div>
    </div>
    <div class="small-grid">
      <div class="card">
        <h2 class="title">Кто стучится на сайт</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>IP</th><th>Запросов</th></tr></thead>
            <tbody id="ipsBody"></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <h2 class="title">Что запрашивают</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>URL</th><th>Хитов</th></tr></thead>
            <tbody id="urlsBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  <script>
    let hourlyChart;
    let dailyChart;
    function fmtBytes(num) {
      const units = ["B", "KB", "MB", "GB", "TB"];
      let n = Number(num || 0), i = 0;
      while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
      return `${n.toFixed(n >= 100 || i === 0 ? 0 : n >= 10 ? 1 : 2)} ${units[i]}`;
    }
    function esc(s) {
      return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }
    function renderStats(data) {
      const stats = [
        ["Клиентов всего", data.summary.clients_total],
        ["Сейчас онлайн", data.summary.clients_online],
        ["Трафик клиентов 3x-ui", fmtBytes(data.summary.clients_used_total)],
        ["Сегодня eth0", fmtBytes(data.summary.eth0_today)],
        ["Сегодня wg0", fmtBytes(data.summary.wg0_today)],
        ["Внешних IP в access.log", data.summary.external_ip_count],
      ];
      document.getElementById("stats").innerHTML = stats.map(([label, value]) =>
        `<div class="stat"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`
      ).join("");
    }
    function renderClients(clients) {
      document.getElementById("clientsBody").innerHTML = clients.map((c) => {
        const chips = c.inbounds.map((name) => `<span class="chip">${esc(name)}</span>`).join("");
        const onlineCls = c.online ? "online" : "offline";
        const onlineText = c.online ? "Онлайн" : "Не в сети";
        return `
          <tr>
            <td><div class="client"><div class="name">${esc(c.name)}</div><div class="meta">${esc(c.email)}</div></div></td>
            <td><span class="status ${onlineCls}"><span class="dot"></span>${onlineText}</span></td>
            <td>${esc(fmtBytes(c.used))}</td>
            <td>${esc(c.limit_text)}</td>
            <td>${esc(c.last_online_text)}</td>
            <td><div class="chips">${chips || '<span class="muted">нет данных</span>'}</div></td>
          </tr>`;
      }).join("");
    }
    function renderTable(id, rows, leftKey, rightKey) {
      document.getElementById(id).innerHTML = rows.map((row) =>
        `<tr><td class="${leftKey === 'url' ? 'mono' : ''}">${esc(row[leftKey])}</td><td>${esc(row[rightKey])}</td></tr>`
      ).join("");
    }
    function drawChart(current, canvasId, labels, datasets) {
      const ctx = document.getElementById(canvasId).getContext("2d");
      if (current) current.destroy();
      return new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { labels: { color: "#cfd8f4" } },
            tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtBytes(ctx.raw)}` } }
          },
          scales: {
            x: { ticks: { color: "#99a9d4" }, grid: { color: "rgba(124,152,219,.15)" } },
            y: { ticks: { color: "#99a9d4", callback: (v) => fmtBytes(v) }, grid: { color: "rgba(124,152,219,.15)" } }
          }
        }
      });
    }
    function renderCharts(data) {
      hourlyChart = drawChart(hourlyChart, "hourlyChart", data.hourly.labels, [
        { label: "Сервер rx", data: data.hourly.eth0_rx, borderColor: "#5ca6ff", backgroundColor: "#5ca6ff", tension: 0.3 },
        { label: "Сервер tx", data: data.hourly.eth0_tx, borderColor: "#46d39f", backgroundColor: "#46d39f", tension: 0.3 },
        { label: "WireGuard total", data: data.hourly.wg0_total, borderColor: "#ffb84d", backgroundColor: "#ffb84d", tension: 0.3 },
        { label: "Amnezia total", data: data.hourly.awg0_total, borderColor: "#ff6a88", backgroundColor: "#ff6a88", tension: 0.3 },
      ]);
      dailyChart = drawChart(dailyChart, "dailyChart", data.daily.labels, [
        { label: "Сервер total", data: data.daily.eth0_total, borderColor: "#5ca6ff", backgroundColor: "#5ca6ff", tension: 0.25 },
        { label: "WireGuard total", data: data.daily.wg0_total, borderColor: "#ffb84d", backgroundColor: "#ffb84d", tension: 0.25 },
        { label: "Amnezia total", data: data.daily.awg0_total, borderColor: "#ff6a88", backgroundColor: "#ff6a88", tension: 0.25 },
      ]);
    }
    async function load() {
      const res = await fetch("/api/traffic");
      const data = await res.json();
      document.getElementById("updatedAt").textContent = `Обновлено: ${data.generated_at}`;
      renderStats(data);
      renderClients(data.clients);
      renderTable("ipsBody", data.top_ips, "ip", "requests");
      renderTable("urlsBody", data.top_urls, "url", "hits");
      renderCharts(data);
    }
    load();
    setInterval(load, 30000);
  </script>
</body>
</html>
"""


def run_json(command):
    result = subprocess.run(command, capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "command failed")
    return json.loads(result.stdout)


def format_bytes(num):
    units = ["B", "KB", "MB", "GB", "TB"]
    value = float(num or 0)
    idx = 0
    while value >= 1024 and idx < len(units) - 1:
        value /= 1024
        idx += 1
    if idx == 0:
        return f"{int(value)} {units[idx]}"
    if value >= 100:
        return f"{value:.0f} {units[idx]}"
    if value >= 10:
        return f"{value:.1f} {units[idx]}"
    return f"{value:.2f} {units[idx]}"


def format_last_online(ts_ms):
    if not ts_ms:
        return "никогда"
    delta = max(0, int(time.time() - ts_ms / 1000))
    if delta < 60:
        return "только что"
    if delta < 3600:
        return f"{delta // 60} мин назад"
    if delta < 86400:
        return f"{delta // 3600} ч назад"
    return f"{delta // 86400} дн назад"


def detect_db():
    for path in DB_CANDIDATES:
        if path.exists():
            return path
    return None


def load_clients():
    db_path = detect_db()
    if not db_path:
        return []
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        inbound_map = defaultdict(list)
        for row in conn.execute("SELECT remark, protocol, port, settings FROM inbounds"):
            label = f"{row['remark'] or row['protocol']} ({row['protocol']}:{row['port']})"
            try:
                payload = json.loads(row["settings"] or "{}")
            except Exception:
                continue
            for client in payload.get("clients", []):
                email = client.get("email")
                if email:
                    inbound_map[email].append(label)

        rows = conn.execute(
            "SELECT email, up, down, total, last_online FROM client_traffics ORDER BY (up + down) DESC"
        ).fetchall()

        out = []
        now = time.time()
        for row in rows:
            used = int(row["up"] or 0) + int(row["down"] or 0)
            total = int(row["total"] or 0)
            last_online = int(row["last_online"] or 0)
            out.append({
                "name": row["email"],
                "email": row["email"],
                "used": used,
                "limit_text": "∞" if total <= 0 else format_bytes(total),
                "last_online_text": format_last_online(last_online),
                "online": bool(last_online and now - last_online / 1000 <= ONLINE_WINDOW_SECONDS),
                "inbounds": inbound_map.get(row["email"], []),
            })
        return out
    finally:
        conn.close()


def vnstat_rows(interface, bucket):
    try:
        data = run_json(["vnstat", "--json", "-i", interface])
    except Exception:
        return []
    iface = (data.get("interfaces") or [{}])[0]
    return ((iface.get("traffic") or {}).get(bucket) or [])


def today_total(interface):
    rows = vnstat_rows(interface, "day")
    if not rows:
        return 0
    row = rows[-1]
    return int(row.get("rx", 0)) + int(row.get("tx", 0))


def build_hourly():
    eth = vnstat_rows("eth0", "hour")[-12:]
    wg = vnstat_rows("wg0", "hour")[-12:]
    awg = vnstat_rows("awg0", "hour")[-12:]
    labels = [f"{(row.get('time') or {}).get('hour', 0):02d}" for row in eth]
    return {
        "labels": labels,
        "eth0_rx": [int(row.get("rx", 0)) for row in eth],
        "eth0_tx": [int(row.get("tx", 0)) for row in eth],
        "wg0_total": [int(row.get("rx", 0)) + int(row.get("tx", 0)) for row in wg],
        "awg0_total": [int(row.get("rx", 0)) + int(row.get("tx", 0)) for row in awg],
    }


def build_daily():
    def rows(name):
        return vnstat_rows(name, "day")[-14:]
    eth = rows("eth0")
    wg = rows("wg0")
    awg = rows("awg0")
    labels = [f"{(row.get('date') or {}).get('day', 0):02d}/{(row.get('date') or {}).get('month', 0):02d}" for row in eth]
    return {
        "labels": labels,
        "eth0_total": [int(row.get("rx", 0)) + int(row.get("tx", 0)) for row in eth],
        "wg0_total": [int(row.get("rx", 0)) + int(row.get("tx", 0)) for row in wg],
        "awg0_total": [int(row.get("rx", 0)) + int(row.get("tx", 0)) for row in awg],
    }


def parse_nginx():
    ip_counter = Counter()
    url_counter = Counter()
    ips = set()
    if not NGINX_ACCESS_LOG.exists():
        return [], [], 0
    with NGINX_ACCESS_LOG.open("r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            parts = line.split()
            if len(parts) < 7:
                continue
            ip = parts[0]
            url = parts[6]
            if ip == "127.0.0.1":
                continue
            ips.add(ip)
            ip_counter[ip] += 1
            url_counter[url] += 1
    top_ips = [{"ip": ip, "requests": count} for ip, count in ip_counter.most_common(12)]
    top_urls = [{"url": url, "hits": count} for url, count in url_counter.most_common(12)]
    return top_ips, top_urls, len(ips)


def payload():
    clients = load_clients()
    top_ips, top_urls, external_ip_count = parse_nginx()
    return {
        "generated_at": datetime.now(timezone.utc).astimezone().strftime("%d.%m.%Y %H:%M:%S"),
        "summary": {
            "clients_total": len(clients),
            "clients_online": sum(1 for x in clients if x["online"]),
            "clients_used_total": sum(x["used"] for x in clients),
            "eth0_today": today_total("eth0"),
            "wg0_today": today_total("wg0"),
            "external_ip_count": external_ip_count,
        },
        "clients": clients,
        "top_ips": top_ips,
        "top_urls": top_urls,
        "hourly": build_hourly(),
        "daily": build_daily(),
    }


@app.get("/traffic")
def traffic_page():
    return Response(HTML, mimetype="text/html")


@app.get("/api/traffic")
def api_traffic():
    return jsonify(payload())


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8790)
PY

apt update
apt install -y python3-flask

cat > /etc/systemd/system/traffic-web.service <<'EOF'
[Unit]
Description=Traffic dashboard
After=network.target

[Service]
WorkingDirectory=/opt/traffic-web
ExecStart=/usr/bin/python3 /opt/traffic-web/app.py
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now traffic-web
systemctl restart traffic-web
systemctl status traffic-web --no-pager
