from __future__ import annotations

import json
import sqlite3
import subprocess
import threading
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, Response, jsonify


app = Flask(__name__)

DB_CANDIDATES = [
    Path("/etc/x-ui/x-ui.db"),
    Path("/usr/local/x-ui/x-ui.db"),
    Path("/opt/x-ui/x-ui.db"),
]
NGINX_ACCESS_LOG = Path("/var/log/nginx/access.log")
SNAPSHOT_FILE = Path("/opt/traffic-dashboard/client_snapshots.json")
ONLINE_WINDOW_SECONDS = 300
SNAPSHOT_EVERY_SECONDS = 60
SNAPSHOT_RETENTION_SECONDS = 40 * 24 * 60 * 60
SNAPSHOT_LOCK = threading.Lock()
COLLECTOR_STARTED = False


HTML = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>3x-ui Traffic</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b1020;
      --panel: #121934;
      --line: #263462;
      --text: #ebf1ff;
      --muted: #99a9d4;
      --blue: #5ca6ff;
      --green: #46d39f;
      --orange: #ffb84d;
      --red: #ff6a88;
      --purple: #8b7cff;
      --shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Segoe UI, Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(92, 166, 255, 0.12), transparent 28%),
        radial-gradient(circle at top right, rgba(70, 211, 159, 0.10), transparent 22%),
        var(--bg);
    }
    .wrap {
      width: min(1540px, calc(100% - 28px));
      margin: 22px auto 38px;
    }
    .hero {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 16px;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0;
      font-size: 34px;
      line-height: 1.05;
      font-weight: 800;
    }
    .sub {
      margin-top: 8px;
      color: var(--muted);
      font-size: 15px;
      max-width: 840px;
    }
    .stamp {
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 16px;
    }
    .grid, .small-grid {
      display: grid;
      gap: 16px;
      margin-bottom: 16px;
    }
    .grid { grid-template-columns: 1fr 1fr; }
    .small-grid { grid-template-columns: 1fr 1fr; }
    .card, .stat, .signal {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01));
      border: 1px solid rgba(124, 152, 219, 0.18);
      border-radius: 16px;
      box-shadow: var(--shadow);
    }
    .card { padding: 18px; }
    .stat { padding: 16px 18px; }
    .stat .label {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 10px;
    }
    .stat .value {
      font-size: 24px;
      font-weight: 800;
      line-height: 1.1;
    }
    .stat .hint {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .stat.warn { border-color: rgba(255, 184, 77, 0.32); }
    .stat.ok { border-color: rgba(70, 211, 159, 0.32); }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }
    .title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
    }
    .note {
      margin: 0 0 14px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(124, 152, 219, 0.18);
      background: rgba(255, 255, 255, 0.03);
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .segmented {
      display: inline-flex;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(124, 152, 219, 0.18);
      border-radius: 999px;
      padding: 4px;
      gap: 4px;
      flex-shrink: 0;
    }
    .segmented button {
      border: 0;
      background: transparent;
      color: var(--muted);
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 12px;
      cursor: pointer;
    }
    .segmented button.active {
      background: rgba(92, 166, 255, 0.16);
      color: var(--text);
    }
    .signal-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 12px;
    }
    .signal {
      padding: 14px 15px;
    }
    .signal.warn { border-color: rgba(255, 184, 77, 0.32); }
    .signal.ok { border-color: rgba(70, 211, 159, 0.32); }
    .signal .label {
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 8px;
    }
    .signal .value {
      font-size: 22px;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 6px;
    }
    .signal .detail {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }
    .alert-list {
      display: grid;
      gap: 10px;
    }
    .alert {
      border-left: 3px solid var(--orange);
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      padding: 12px 14px;
    }
    .alert .title {
      font-size: 15px;
      margin-bottom: 6px;
    }
    .alert .detail {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .alert.kind-dominant { border-left-color: var(--red); }
    .alert.kind-multi { border-left-color: var(--blue); }
    .alert.kind-ok { border-left-color: var(--green); }
    .table-wrap { overflow: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      text-align: left;
      padding: 12px 10px;
      border-bottom: 1px solid rgba(124, 152, 219, 0.12);
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-weight: 600;
      position: sticky;
      top: 0;
      background: #121934;
      z-index: 1;
    }
    .client {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 180px;
    }
    .client .name {
      font-size: 15px;
      font-weight: 700;
    }
    .client .meta {
      color: var(--muted);
      font-size: 12px;
      font-family: Consolas, ui-monospace, monospace;
      word-break: break-all;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    .online .dot {
      background: var(--green);
      box-shadow: 0 0 18px rgba(70, 211, 159, 0.5);
    }
    .offline .dot { background: #6f7ea8; }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-width: 340px;
    }
    .chip {
      border: 1px solid rgba(92, 166, 255, 0.18);
      background: rgba(92, 166, 255, 0.10);
      color: #cfe1ff;
      padding: 5px 9px;
      border-radius: 999px;
      font-size: 12px;
      white-space: nowrap;
    }
    .share {
      display: inline-flex;
      align-items: center;
      padding: 5px 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      font-weight: 700;
      font-size: 12px;
    }
    .share.warn {
      background: rgba(255, 184, 77, 0.16);
      color: #ffdca0;
    }
    .muted { color: var(--muted); }
    .mono {
      font-family: Consolas, ui-monospace, monospace;
      word-break: break-word;
    }
    .right { text-align: right; }
    canvas {
      width: 100% !important;
      height: 320px !important;
    }
    @media (max-width: 1200px) {
      .grid, .small-grid { grid-template-columns: 1fr; }
      .signal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .wrap { width: min(100% - 18px, 1540px); }
      .hero { flex-direction: column; align-items: start; }
      .card-head { flex-direction: column; align-items: start; }
      .signal-grid { grid-template-columns: 1fr; }
      h1 { font-size: 28px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div>
        <h1>Трафик 3x-ui и сервера</h1>
        <div class="sub">Здесь сразу видно кто льет больше всех, где пики по времени и насколько прирост по клиентам сходится с тем, что сервер реально гоняет через <span class="mono">eth0</span>.</div>
      </div>
      <div class="stamp" id="updatedAt">Загрузка...</div>
    </div>

    <div class="stats" id="stats"></div>

    <div class="grid">
      <div class="card">
        <div class="card-head">
          <h2 class="title">Что видно сразу</h2>
          <span class="pill">Диагностика</span>
        </div>
        <p class="note">Если тут большая разница между <span class="mono">eth0 / 2</span> и 3x-ui, то смотри ниже график сравнения по дням и список подозреваемых клиентов.</p>
        <div class="signal-grid" id="signalsGrid"></div>
        <div class="alert-list" id="alertsList"></div>
      </div>
      <div class="card">
        <div class="card-head">
          <h2 class="title">Кого проверять первым</h2>
          <span class="pill">Top suspects</span>
        </div>
        <p class="note">Сверху клиенты с несколькими inbound, потом те, кто дал наибольшую долю сегодняшнего трафика.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Сегодня</th>
                <th>Доля</th>
                <th>Inbounds</th>
                <th>Всего</th>
                <th>Почему</th>
              </tr>
            </thead>
            <tbody id="suspectsBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head">
          <h2 class="title">Клиенты за сегодня</h2>
          <div class="segmented" data-chart-switch="today">
            <button class="active" data-mode="clients">По клиентам</button>
            <button data-mode="timeline">По часам</button>
          </div>
        </div>
        <div class="note" id="todayChartNote">Показывает прирост трафика по клиентам за текущий день с начала локальной истории snapshots.</div>
        <canvas id="todayClientsChart"></canvas>
      </div>
      <div class="card">
        <div class="card-head">
          <h2 class="title">Клиенты за месяц</h2>
          <div class="segmented" data-chart-switch="month">
            <button class="active" data-mode="clients">По клиентам</button>
            <button data-mode="timeline">По дням</button>
          </div>
        </div>
        <div class="note" id="monthChartNote">Показывает прирост трафика по клиентам за текущий месяц с начала локальной истории snapshots.</div>
        <canvas id="monthClientsChart"></canvas>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head">
          <h2 class="title">Общий трафик по клиентам</h2>
          <span class="pill">Накопленный total</span>
        </div>
        <div class="note">Это уже общий накопленный трафик из базы 3x-ui. Полезно, чтобы отделить старых тяжелых клиентов от тех, кто просто резко выстрелил сегодня.</div>
        <canvas id="totalClientsChart"></canvas>
      </div>
      <div class="card">
        <div class="card-head">
          <h2 class="title">Сервер vs 3x-ui по дням</h2>
          <span class="pill">eth0 / 2 vs clients</span>
        </div>
        <div class="note">Тут главное сравнение: <span class="mono">eth0 total</span>, оценка полезного трафика <span class="mono">eth0 / 2</span>, прирост по клиентам 3x-ui, плюс при наличии <span class="mono">wg0</span> и <span class="mono">awg0</span>.</div>
        <canvas id="serverDailyChart"></canvas>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="card-head">
        <h2 class="title">Клиенты 3x-ui</h2>
        <span class="pill">Доли и inbounds</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Статус</th>
              <th>Сегодня</th>
              <th>Доля дня</th>
              <th>Месяц</th>
              <th>Inbounds</th>
              <th>Всего</th>
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
        <div class="card-head">
          <h2 class="title">Кто стучится на сайт</h2>
          <span class="pill">nginx access</span>
        </div>
        <div class="note">Эти таблицы важны в основном если после остановки <span class="mono">x-ui</span> трафик все равно остается. Тогда уже ищем не VPN, а сайт, панель или другой сервис.</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>IP</th><th>Запросов</th></tr></thead>
            <tbody id="ipsBody"></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <h2 class="title">Что дергают на сайте</h2>
          <span class="pill">Top URLs</span>
        </div>
        <div class="note">Помогает понять, не идет ли лишний шум в админку, API или на статику.</div>
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
    let todayClientsChart;
    let monthClientsChart;
    let totalClientsChart;
    let serverDailyChart;
    let lastPayload = null;
    const chartModes = { today: "clients", month: "clients" };
    const clientPalette = ["#46d39f", "#5ca6ff", "#ffb84d", "#ff6a88", "#8b7cff", "#55d0ff", "#ffd166", "#7bd88f"];

    function fmtBytes(num) {
      const units = ["B", "KB", "MB", "GB", "TB"];
      let n = Math.abs(Number(num || 0));
      let i = 0;
      while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
      }
      return `${n.toFixed(n >= 100 || i === 0 ? 0 : n >= 10 ? 1 : 2)} ${units[i]}`;
    }

    function fmtSignedBytes(num) {
      const value = Number(num || 0);
      const sign = value > 0 ? "+" : value < 0 ? "-" : "";
      return `${sign}${fmtBytes(value)}`;
    }

    function fmtPct(num) {
      return `${Number(num || 0).toFixed(1)}%`;
    }

    function esc(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    function hasTraffic(values) {
      return Array.isArray(values) && values.some((value) => Number(value || 0) > 0);
    }

    function renderEmptyRow(colspan, text) {
      return `<tr><td colspan="${colspan}" class="muted">${esc(text)}</td></tr>`;
    }

    function statCard(label, value, hint = "", tone = "") {
      return `
        <div class="stat ${tone}">
          <div class="label">${esc(label)}</div>
          <div class="value">${esc(value)}</div>
          <div class="hint">${esc(hint)}</div>
        </div>
      `;
    }

    function signalCard(label, value, detail, tone = "") {
      return `
        <div class="signal ${tone}">
          <div class="label">${esc(label)}</div>
          <div class="value">${esc(value)}</div>
          <div class="detail">${esc(detail)}</div>
        </div>
      `;
    }

    function renderStats(data) {
      const diagnostics = data.diagnostics || {};
      const gap = Number(diagnostics.traffic_gap_today || 0);
      document.getElementById("stats").innerHTML = [
        statCard("Клиентов всего", data.summary.clients_total, "в базе 3x-ui"),
        statCard("Сейчас онлайн", data.summary.clients_online, "за последние 5 минут"),
        statCard("3x-ui за сегодня", fmtBytes(data.summary.clients_today_total), "сумма по клиентам"),
        statCard("3x-ui за месяц", fmtBytes(data.summary.clients_month_total), "сумма по клиентам"),
        statCard("eth0 за сегодня", fmtBytes(data.summary.eth0_today), "rx + tx сервера"),
        statCard("eth0 / 2 оценка", fmtBytes(diagnostics.estimated_user_traffic_today), "примерный полезный трафик"),
        statCard("Разница к 3x-ui", fmtSignedBytes(gap), "eth0 / 2 минус clients", gap > 0 ? "warn" : "ok"),
        statCard("Multi-inbound", String(diagnostics.multi_inbound_clients || 0), "клиентов с несколькими inbound", diagnostics.multi_inbound_clients ? "warn" : ""),
      ].join("");
    }

    function renderDiagnostics(data) {
      const diagnostics = data.diagnostics || {};
      const topTalker = diagnostics.top_talker || {};
      const proxyMultiplier = diagnostics.proxy_multiplier ? `x${diagnostics.proxy_multiplier}` : "нет оценки";
      const gap = Number(diagnostics.traffic_gap_today || 0);

      document.getElementById("signalsGrid").innerHTML = [
        signalCard(
          "Топ за сегодня",
          topTalker.name || "нет данных",
          `${fmtBytes(topTalker.today_used)} · ${fmtPct(topTalker.share_pct)}`,
          Number(topTalker.share_pct || 0) >= 60 ? "warn" : ""
        ),
        signalCard(
          "Полезный трафик",
          fmtBytes(diagnostics.estimated_user_traffic_today),
          "оценка как eth0 / 2"
        ),
        signalCard(
          "Разница",
          fmtSignedBytes(gap),
          "eth0 / 2 минус 3x-ui",
          gap > 0 ? "warn" : "ok"
        ),
        signalCard(
          "Прокси-множитель",
          proxyMultiplier,
          "насколько eth0 больше клиентской суммы",
          diagnostics.proxy_multiplier && diagnostics.proxy_multiplier > 2 ? "warn" : ""
        ),
      ].join("");

      const alerts = diagnostics.alerts || [];
      document.getElementById("alertsList").innerHTML = alerts.length
        ? alerts.map((alert) => `
            <div class="alert kind-${esc(alert.kind)}">
              <div class="title">${esc(alert.title)}</div>
              <div class="detail">${esc(alert.detail)}</div>
            </div>
          `).join("")
        : `
            <div class="alert kind-ok">
              <div class="title">Явных красных флагов нет</div>
              <div class="detail">Сейчас картина выглядит относительно ровной. Для деталей смотри почасовые и подневные линии ниже.</div>
            </div>
          `;
    }

    function suspectReason(client) {
      const reasons = [];
      if (Number(client.inbounds_count || 0) > 1) {
        reasons.push(`${client.inbounds_count} inbounds`);
      }
      if (Number(client.today_share_pct || 0) >= 40) {
        reasons.push("большая доля дня");
      }
      if (Number(client.today_used || 0) === 0 && Number(client.used || 0) > 0) {
        reasons.push("старый heavy user");
      }
      return reasons.join(", ") || "смотреть линию по времени";
    }

    function renderSuspects(rows) {
      const body = document.getElementById("suspectsBody");
      if (!rows || !rows.length) {
        body.innerHTML = renderEmptyRow(6, "Нет подозреваемых клиентов");
        return;
      }
      body.innerHTML = rows.map((client) => `
        <tr>
          <td>
            <div class="client">
              <div class="name">${esc(client.name)}</div>
              <div class="meta">${esc(client.email)}</div>
            </div>
          </td>
          <td>${esc(fmtBytes(client.today_used))}</td>
          <td><span class="share ${Number(client.today_share_pct || 0) >= 40 ? "warn" : ""}">${esc(fmtPct(client.today_share_pct))}</span></td>
          <td>${esc(client.inbounds_count || 0)}</td>
          <td>${esc(fmtBytes(client.used))}</td>
          <td class="muted">${esc(suspectReason(client))}</td>
        </tr>
      `).join("");
    }

    function renderClients(clients) {
      const body = document.getElementById("clientsBody");
      if (!clients || !clients.length) {
        body.innerHTML = renderEmptyRow(9, "Клиенты не найдены");
        return;
      }

      body.innerHTML = clients.map((client) => {
        const inbounds = Array.isArray(client.inbounds) ? client.inbounds : [];
        const chips = inbounds.map((name) => `<span class="chip">${esc(name)}</span>`).join("");
        const shareClass = Number(client.today_share_pct || 0) >= 40 ? "warn" : "";
        return `
          <tr>
            <td>
              <div class="client">
                <div class="name">${esc(client.name)}</div>
                <div class="meta">${esc(client.email)}</div>
              </div>
            </td>
            <td><span class="status ${client.online ? "online" : "offline"}"><span class="dot"></span>${client.online ? "Онлайн" : "Не в сети"}</span></td>
            <td>${esc(fmtBytes(client.today_used))}</td>
            <td><span class="share ${shareClass}">${esc(fmtPct(client.today_share_pct))}</span></td>
            <td>${esc(fmtBytes(client.month_used))}</td>
            <td>${esc(client.inbounds_count || 0)}</td>
            <td>${esc(fmtBytes(client.used))}</td>
            <td>${esc(client.last_online_text)}</td>
            <td><div class="chips">${chips || '<span class="muted">нет данных</span>'}</div></td>
          </tr>
        `;
      }).join("");
    }

    function renderTable(id, rows, leftKey, rightKey, emptyLabel) {
      const body = document.getElementById(id);
      if (!rows || !rows.length) {
        body.innerHTML = renderEmptyRow(2, emptyLabel);
        return;
      }
      body.innerHTML = rows.map((row) => `
        <tr>
          <td class="${leftKey === "url" ? "mono" : ""}">${esc(row[leftKey])}</td>
          <td>${esc(row[rightKey])}</td>
        </tr>
      `).join("");
    }

    function drawBarChart(current, canvasId, labels, values, label, color) {
      const ctx = document.getElementById(canvasId).getContext("2d");
      if (current) current.destroy();
      return new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label,
            data: values,
            backgroundColor: color,
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: "#cfd8f4" } },
            tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtBytes(ctx.raw)}` } }
          },
          scales: {
            x: { ticks: { color: "#99a9d4" }, grid: { display: false } },
            y: { ticks: { color: "#99a9d4", callback: (value) => fmtBytes(value) }, grid: { color: "rgba(124, 152, 219, 0.15)" } }
          }
        }
      });
    }

    function drawLineChart(current, canvasId, labels, datasets) {
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
          elements: {
            line: { tension: 0.25, borderWidth: 2.5 },
            point: { radius: 2, hoverRadius: 4 }
          },
          scales: {
            x: { ticks: { color: "#99a9d4" }, grid: { color: "rgba(124, 152, 219, 0.15)" } },
            y: { ticks: { color: "#99a9d4", callback: (value) => fmtBytes(value) }, grid: { color: "rgba(124, 152, 219, 0.15)" } }
          }
        }
      });
    }

    function timelineDatasets(items) {
      const rows = Array.isArray(items) ? items : [];
      if (!rows.length) {
        return [{
          label: "нет данных",
          data: [],
          borderColor: "#6f7ea8",
          backgroundColor: "#6f7ea8"
        }];
      }
      return rows.map((item, index) => ({
        label: item.label,
        data: item.values,
        borderColor: clientPalette[index % clientPalette.length],
        backgroundColor: clientPalette[index % clientPalette.length],
      }));
    }

    function buildServerDatasets(data) {
      const datasets = [
        {
          label: "eth0 total",
          data: data.server_daily.eth0_total,
          borderColor: "#5ca6ff",
          backgroundColor: "#5ca6ff",
        },
        {
          label: "eth0 / 2 estimate",
          data: data.server_daily.estimated_user_total,
          borderColor: "#46d39f",
          backgroundColor: "#46d39f",
        },
        {
          label: "3x-ui clients",
          data: data.server_daily.clients_total,
          borderColor: "#ffb84d",
          backgroundColor: "#ffb84d",
        },
      ];

      if (hasTraffic(data.server_daily.wg0_total)) {
        datasets.push({
          label: "wg0 total",
          data: data.server_daily.wg0_total,
          borderColor: "#8b7cff",
          backgroundColor: "#8b7cff",
        });
      }
      if (hasTraffic(data.server_daily.awg0_total)) {
        datasets.push({
          label: "awg0 total",
          data: data.server_daily.awg0_total,
          borderColor: "#ff6a88",
          backgroundColor: "#ff6a88",
        });
      }

      return datasets;
    }

    function setActiveSwitch(group, mode) {
      document.querySelectorAll(`[data-chart-switch="${group}"] button`).forEach((button) => {
        button.classList.toggle("active", button.dataset.mode === mode);
      });
    }

    function saveChartMode(group, mode) {
      try {
        localStorage.setItem(`traffic-chart-${group}`, mode);
      } catch (_error) {}
    }

    function restoreChartModes() {
      Object.keys(chartModes).forEach((group) => {
        try {
          const stored = localStorage.getItem(`traffic-chart-${group}`);
          if (stored === "clients" || stored === "timeline") {
            chartModes[group] = stored;
          }
        } catch (_error) {}
        setActiveSwitch(group, chartModes[group]);
      });
    }

    function renderCharts(data) {
      if (chartModes.today === "clients") {
        document.getElementById("todayChartNote").textContent = "Показывает прирост трафика по клиентам за текущий день с начала локальной истории snapshots.";
        todayClientsChart = drawBarChart(
          todayClientsChart,
          "todayClientsChart",
          data.client_charts.today.labels,
          data.client_charts.today.values,
          "За сегодня",
          "#46d39f"
        );
      } else {
        document.getElementById("todayChartNote").textContent = "Каждая линия — отдельный клиент. Так легче увидеть, кто именно разгонял трафик по часам.";
        todayClientsChart = drawLineChart(
          todayClientsChart,
          "todayClientsChart",
          data.client_timeline.today.labels,
          timelineDatasets(data.client_timeline.today.datasets)
        );
      }

      if (chartModes.month === "clients") {
        document.getElementById("monthChartNote").textContent = "Показывает прирост трафика по клиентам за текущий месяц с начала локальной истории snapshots.";
        monthClientsChart = drawBarChart(
          monthClientsChart,
          "monthClientsChart",
          data.client_charts.month.labels,
          data.client_charts.month.values,
          "За месяц",
          "#ffb84d"
        );
      } else {
        document.getElementById("monthChartNote").textContent = "Каждая линия — отдельный клиент. Так видно, кто именно создавал пики по дням внутри месяца.";
        monthClientsChart = drawLineChart(
          monthClientsChart,
          "monthClientsChart",
          data.client_timeline.month.labels,
          timelineDatasets(data.client_timeline.month.datasets)
        );
      }

      totalClientsChart = drawBarChart(
        totalClientsChart,
        "totalClientsChart",
        data.client_charts.total.labels,
        data.client_charts.total.values,
        "Всего",
        "#5ca6ff"
      );

      serverDailyChart = drawLineChart(
        serverDailyChart,
        "serverDailyChart",
        data.server_daily.labels,
        buildServerDatasets(data)
      );
    }

    function bindSwitches() {
      document.querySelectorAll("[data-chart-switch]").forEach((group) => {
        group.querySelectorAll("button").forEach((button) => {
          button.addEventListener("click", () => {
            const chart = group.dataset.chartSwitch;
            chartModes[chart] = button.dataset.mode;
            setActiveSwitch(chart, button.dataset.mode);
            saveChartMode(chart, button.dataset.mode);
            if (lastPayload) {
              renderCharts(lastPayload);
            }
          });
        });
      });
    }

    async function load() {
      try {
        const response = await fetch("/api/traffic");
        const data = await response.json();
        lastPayload = data;
        document.getElementById("updatedAt").textContent = `Обновлено: ${data.generated_at}`;
        renderStats(data);
        renderDiagnostics(data);
        renderSuspects(data.diagnostics.suspects || []);
        renderClients(data.clients);
        renderTable("ipsBody", data.top_ips, "ip", "requests", "Нет запросов в nginx access.log");
        renderTable("urlsBody", data.top_urls, "url", "hits", "Нет запросов в nginx access.log");
        renderCharts(data);
      } catch (error) {
        document.getElementById("updatedAt").textContent = `Ошибка загрузки: ${error.message}`;
        console.error(error);
      }
    }

    restoreChartModes();
    bindSwitches();
    load();
    setInterval(load, 30000);
  </script>
</body>
</html>
"""


def run_json_command(command: list[str]) -> dict:
    result = subprocess.run(command, capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "command failed")
    return json.loads(result.stdout)


def format_last_online(ts_ms: int) -> str:
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


def detect_xui_db() -> Path | None:
    for path in DB_CANDIDATES:
        if path.exists():
            return path
    return None


def connect_xui_db() -> sqlite3.Connection | None:
    db_path = detect_xui_db()
    if not db_path:
        return None
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def load_clients_from_xui() -> list[dict]:
    conn = connect_xui_db()
    if not conn:
        return []
    try:
        inbound_map: dict[str, list[str]] = defaultdict(list)
        for row in conn.execute("SELECT remark, protocol, port, settings FROM inbounds"):
            label = f"{row['remark'] or row['protocol']} ({row['protocol']}:{row['port']})"
            try:
                payload = json.loads(row["settings"] or "{}")
            except json.JSONDecodeError:
                continue
            for client in payload.get("clients", []):
                email = client.get("email")
                if email:
                    inbound_map[email].append(label)

        rows = conn.execute(
            "SELECT email, up, down, total, last_online FROM client_traffics ORDER BY (up + down) DESC"
        ).fetchall()

        now = time.time()
        clients = []
        for row in rows:
            used = int(row["up"] or 0) + int(row["down"] or 0)
            last_online = int(row["last_online"] or 0)
            clients.append(
                {
                    "name": row["email"],
                    "email": row["email"],
                    "used": used,
                    "online": bool(last_online and now - last_online / 1000 <= ONLINE_WINDOW_SECONDS),
                    "last_online": last_online,
                    "last_online_text": format_last_online(last_online),
                    "inbounds": inbound_map.get(row["email"], []),
                }
            )
        return clients
    finally:
        conn.close()


def load_snapshots() -> list[dict]:
    with SNAPSHOT_LOCK:
        if not SNAPSHOT_FILE.exists():
            return []
        try:
            data = json.loads(SNAPSHOT_FILE.read_text(encoding="utf-8"))
        except Exception:
            return []
        if not isinstance(data, list):
            return []
        rows = [item for item in data if isinstance(item, dict) and "ts" in item and "clients" in item]
        return sorted(rows, key=lambda item: int(item.get("ts", 0)))


def save_snapshots(snapshots: list[dict]) -> None:
    with SNAPSHOT_LOCK:
        SNAPSHOT_FILE.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT_FILE.write_text(json.dumps(snapshots, ensure_ascii=False), encoding="utf-8")


def update_snapshots(clients: list[dict]) -> list[dict]:
    now = int(time.time())
    snapshots = load_snapshots()
    snapshots = [snap for snap in snapshots if now - int(snap.get("ts", 0)) <= SNAPSHOT_RETENTION_SECONDS]

    latest_ts = int(snapshots[-1]["ts"]) if snapshots else 0
    if not snapshots or now - latest_ts >= SNAPSHOT_EVERY_SECONDS:
        snapshots.append(
            {
                "ts": now,
                "clients": {client["email"]: int(client["used"]) for client in clients},
            }
        )
        save_snapshots(snapshots)
    return snapshots


def collect_snapshots_forever() -> None:
    while True:
        try:
            clients = load_clients_from_xui()
            if clients:
                update_snapshots(clients)
        except Exception:
            pass
        time.sleep(SNAPSHOT_EVERY_SECONDS)


def start_snapshot_collector() -> None:
    global COLLECTOR_STARTED
    if COLLECTOR_STARTED:
        return
    COLLECTOR_STARTED = True
    thread = threading.Thread(target=collect_snapshots_forever, daemon=True, name="traffic-snapshot-collector")
    thread.start()


def period_start_ts(period: str) -> int:
    now = datetime.now().astimezone()
    if period == "day":
        return int(now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
    if period == "month":
        return int(now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).timestamp())
    return 0


def normalize_datetime(value: datetime | None = None) -> datetime:
    if value is None:
        return datetime.now().astimezone()
    if value.tzinfo is None:
        return value.astimezone()
    return value.astimezone()


def baseline_used(snapshots: list[dict], email: str, start_ts: int, current_used: int) -> int:
    for snapshot in snapshots:
        ts = int(snapshot.get("ts", 0))
        if ts >= start_ts:
            clients = snapshot.get("clients") or {}
            if email in clients:
                return int(clients[email])
    return current_used


def enrich_with_period_usage(clients: list[dict], snapshots: list[dict]) -> list[dict]:
    start_day = period_start_ts("day")
    start_month = period_start_ts("month")
    out = []
    for client in clients:
        today_base = baseline_used(snapshots, client["email"], start_day, client["used"])
        month_base = baseline_used(snapshots, client["email"], start_month, client["used"])
        item = dict(client)
        item["today_used"] = max(0, int(client["used"]) - today_base)
        item["month_used"] = max(0, int(client["used"]) - month_base)
        item["inbounds_count"] = len(item.get("inbounds") or [])
        out.append(item)
    return out


def annotate_client_shares(clients: list[dict]) -> list[dict]:
    total_today = sum(int(client.get("today_used", 0)) for client in clients)
    total_month = sum(int(client.get("month_used", 0)) for client in clients)
    total_used = sum(int(client.get("used", 0)) for client in clients)
    out = []
    for client in clients:
        item = dict(client)
        today_used = int(item.get("today_used", 0))
        month_used = int(item.get("month_used", 0))
        used = int(item.get("used", 0))
        item["today_share_pct"] = round(today_used * 100 / total_today, 1) if total_today else 0.0
        item["month_share_pct"] = round(month_used * 100 / total_month, 1) if total_month else 0.0
        item["total_share_pct"] = round(used * 100 / total_used, 1) if total_used else 0.0
        out.append(item)
    return out


def top_chart_rows(clients: list[dict], key: str, limit: int = 8) -> dict:
    rows = sorted(clients, key=lambda item: int(item.get(key, 0)), reverse=True)[:limit]
    return {
        "labels": [row["name"] for row in rows],
        "values": [int(row.get(key, 0)) for row in rows],
    }


def snapshots_timeline(snapshots: list[dict], clients: list[dict], period: str, key: str, limit: int = 6) -> dict:
    now = normalize_datetime()
    if period == "day":
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        bucket_count = now.hour + 1
        labels = [f"{hour:02d}" for hour in range(bucket_count)]

        def bucket_index(dt: datetime) -> int:
            return dt.hour

    else:
        start_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        bucket_count = now.day
        labels = [f"{day:02d}" for day in range(1, bucket_count + 1)]

        def bucket_index(dt: datetime) -> int:
            return dt.day - 1

    start_ts = int(start_dt.timestamp())
    top_clients = sorted(clients, key=lambda item: int(item.get(key, 0)), reverse=True)[:limit]
    tracked = [client["email"] for client in top_clients if int(client.get(key, 0)) > 0]
    series = {email: [0] * bucket_count for email in tracked}
    prev_snapshot = None

    for snapshot in snapshots:
        ts = int(snapshot.get("ts", 0))
        if prev_snapshot is None:
            prev_snapshot = snapshot
            continue
        if ts < start_ts:
            prev_snapshot = snapshot
            continue

        dt = datetime.fromtimestamp(ts).astimezone()
        idx = bucket_index(dt)
        if 0 <= idx < bucket_count:
            prev_clients = prev_snapshot.get("clients") or {}
            curr_clients = snapshot.get("clients") or {}
            for email in tracked:
                current_used = int(curr_clients.get(email, prev_clients.get(email, 0)))
                previous_used = int(prev_clients.get(email, current_used))
                series[email][idx] += max(0, current_used - previous_used)
        prev_snapshot = snapshot

    label_map = {client["email"]: client["name"] for client in top_clients}
    datasets = [{"label": label_map[email], "values": values} for email, values in series.items()]
    return {"labels": labels, "datasets": datasets}


def aggregate_client_totals_timeline(
    snapshots: list[dict],
    period: str,
    now: datetime | None = None,
) -> dict:
    now_dt = normalize_datetime(now)
    if period == "day":
        start_dt = now_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        bucket_count = now_dt.hour + 1
        labels = [f"{hour:02d}:00" for hour in range(bucket_count)]

        def bucket_index(dt: datetime) -> int:
            return dt.hour

    else:
        start_dt = now_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        bucket_count = now_dt.day
        labels = [f"{day:02d}/{now_dt.month:02d}" for day in range(1, bucket_count + 1)]

        def bucket_index(dt: datetime) -> int:
            return dt.day - 1

    start_ts = int(start_dt.timestamp())
    values = [0] * bucket_count
    prev_snapshot = None

    for snapshot in snapshots:
        ts = int(snapshot.get("ts", 0))
        if prev_snapshot is None:
            prev_snapshot = snapshot
            continue
        if ts < start_ts:
            prev_snapshot = snapshot
            continue

        dt = datetime.fromtimestamp(ts).astimezone()
        idx = bucket_index(dt)
        if 0 <= idx < bucket_count:
            prev_clients = prev_snapshot.get("clients") or {}
            curr_clients = snapshot.get("clients") or {}
            all_emails = set(prev_clients) | set(curr_clients)
            bucket_total = 0
            for email in all_emails:
                current_used = int(curr_clients.get(email, prev_clients.get(email, 0)))
                previous_used = int(prev_clients.get(email, current_used))
                bucket_total += max(0, current_used - previous_used)
            values[idx] += bucket_total
        prev_snapshot = snapshot

    return {"labels": labels, "values": values}


def parse_vnstat_interface(interface: str) -> dict:
    try:
        data = run_json_command(["vnstat", "--json", "-i", interface])
    except Exception:
        return {"day": []}
    iface = (data.get("interfaces") or [{}])[0]
    traffic = iface.get("traffic") or {}
    return {"day": traffic.get("day") or []}


def server_daily_series(snapshots: list[dict]) -> dict:
    def rows(name: str) -> list[dict]:
        return parse_vnstat_interface(name)["day"][-14:]

    eth = rows("eth0")
    wg = rows("wg0")
    awg = rows("awg0")
    clients_month = aggregate_client_totals_timeline(snapshots, "month")
    client_values_by_label = dict(zip(clients_month["labels"], clients_month["values"]))
    labels = []
    clients_total = []
    estimated_user_total = []
    for row in eth:
        date = row.get("date") or {}
        label = f"{int(date.get('day', 0)):02d}/{int(date.get('month', 0)):02d}"
        labels.append(label)
        eth_total = int(row.get("rx", 0)) + int(row.get("tx", 0))
        clients_total.append(int(client_values_by_label.get(label, 0)))
        estimated_user_total.append(eth_total // 2)
    return {
        "labels": labels,
        "eth0_total": [int(row.get("rx", 0)) + int(row.get("tx", 0)) for row in eth],
        "wg0_total": [int(row.get("rx", 0)) + int(row.get("tx", 0)) for row in wg],
        "awg0_total": [int(row.get("rx", 0)) + int(row.get("tx", 0)) for row in awg],
        "clients_total": clients_total,
        "estimated_user_total": estimated_user_total,
    }


def today_total(interface: str) -> int:
    rows = parse_vnstat_interface(interface)["day"]
    if not rows:
        return 0
    row = rows[-1]
    return int(row.get("rx", 0)) + int(row.get("tx", 0))


def build_diagnostics(summary: dict, clients: list[dict]) -> dict:
    def inbound_count(client: dict) -> int:
        if "inbounds_count" in client:
            return int(client.get("inbounds_count", 0))
        return len(client.get("inbounds") or [])

    today_total_clients = sum(int(item.get("today_used", 0)) for item in clients)

    clients_sorted_today = sorted(
        clients,
        key=lambda item: (int(item.get("today_used", 0)), int(item.get("month_used", 0)), int(item.get("used", 0))),
        reverse=True,
    )
    top_talker = clients_sorted_today[0] if clients_sorted_today else None
    top_talker_share = (
        float(top_talker.get("today_share_pct", 0.0))
        if top_talker and "today_share_pct" in top_talker
        else round(int(top_talker.get("today_used", 0)) * 100 / today_total_clients, 1)
        if top_talker and today_total_clients
        else 0.0
    )

    eth0_today = int(summary.get("eth0_today", 0))
    clients_today_total = int(summary.get("clients_today_total", 0))
    estimated_user_traffic_today = eth0_today // 2
    traffic_gap_today = estimated_user_traffic_today - clients_today_total
    proxy_multiplier = round(eth0_today / clients_today_total, 2) if clients_today_total else None

    multi_inbound_clients = [client for client in clients if inbound_count(client) > 1]
    suspects = sorted(
        clients,
        key=lambda item: (
            inbound_count(item),
            int(item.get("today_used", 0)),
            int(item.get("month_used", 0)),
            int(item.get("used", 0)),
        ),
        reverse=True,
    )[:8]

    alerts: list[dict] = []
    if clients_today_total == 0 and eth0_today > 0:
        alerts.append(
            {
                "kind": "gap",
                "title": "eth0 живее, чем 3x-ui",
                "detail": "На интерфейсе есть трафик, а клиентский счетчик за сегодня пустой. Это похоже на сбитую локальную историю snapshots или трафик мимо учета 3x-ui.",
            }
        )
    elif clients_today_total > 0 and estimated_user_traffic_today > int(clients_today_total * 1.5):
        alerts.append(
            {
                "kind": "gap",
                "title": "3x-ui заметно меньше eth0 / 2",
                "detail": "Полезный трафик по оценке сервера выше, чем прирост по клиентам. Обычно это значит, что snapshots начались недавно, часть потока идет через другой интерфейс или 3x-ui недосчитывает.",
            }
        )

    if top_talker and top_talker_share >= 60:
        alerts.append(
            {
                "kind": "dominant",
                "title": "Один клиент доминирует",
                "detail": f"{top_talker['name']} дает {top_talker_share:.1f}% сегодняшнего клиентского трафика. Его стоит проверить первым.",
            }
        )

    if multi_inbound_clients:
        alerts.append(
            {
                "kind": "multi",
                "title": "Есть multi-inbound клиенты",
                "detail": f"{len(multi_inbound_clients)} клиентов привязаны больше чем к одному inbound. Для них totals в 3x-ui и визуальные выводы читать сложнее.",
            }
        )

    return {
        "estimated_user_traffic_today": estimated_user_traffic_today,
        "traffic_gap_today": traffic_gap_today,
        "proxy_multiplier": proxy_multiplier,
        "multi_inbound_clients": len(multi_inbound_clients),
        "top_talker": {
            "name": top_talker["name"] if top_talker else "нет данных",
            "today_used": int(top_talker.get("today_used", 0)) if top_talker else 0,
            "share_pct": top_talker_share,
        },
        "alerts": alerts,
        "suspects": suspects,
    }


def parse_nginx_access() -> tuple[list[dict], list[dict]]:
    if not NGINX_ACCESS_LOG.exists():
        return [], []

    ip_counter: Counter[str] = Counter()
    url_counter: Counter[str] = Counter()
    with NGINX_ACCESS_LOG.open("r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            parts = line.split()
            if len(parts) < 7:
                continue
            ip = parts[0]
            url = parts[6]
            if ip == "127.0.0.1":
                continue
            ip_counter[ip] += 1
            url_counter[url] += 1

    top_ips = [{"ip": ip, "requests": count} for ip, count in ip_counter.most_common(12)]
    top_urls = [{"url": url, "hits": count} for url, count in url_counter.most_common(12)]
    return top_ips, top_urls


def build_payload() -> dict:
    clients = load_clients_from_xui()
    snapshots = update_snapshots(clients)
    clients = annotate_client_shares(enrich_with_period_usage(clients, snapshots))
    top_ips, top_urls = parse_nginx_access()
    summary = {
        "clients_total": len(clients),
        "clients_online": sum(1 for client in clients if client["online"]),
        "clients_today_total": sum(int(client["today_used"]) for client in clients),
        "clients_month_total": sum(int(client["month_used"]) for client in clients),
        "eth0_today": today_total("eth0"),
        "wg0_today": today_total("wg0"),
        "awg0_today": today_total("awg0"),
    }
    diagnostics = build_diagnostics(summary, clients)

    return {
        "generated_at": datetime.now(timezone.utc).astimezone().strftime("%d.%m.%Y %H:%M:%S"),
        "summary": summary,
        "diagnostics": diagnostics,
        "clients": sorted(clients, key=lambda item: (int(item["today_used"]), int(item["used"])), reverse=True),
        "client_charts": {
            "today": top_chart_rows(clients, "today_used"),
            "month": top_chart_rows(clients, "month_used"),
            "total": top_chart_rows(clients, "used"),
        },
        "client_timeline": {
            "today": snapshots_timeline(snapshots, clients, "day", "today_used"),
            "month": snapshots_timeline(snapshots, clients, "month", "month_used"),
        },
        "server_daily": server_daily_series(snapshots),
        "top_ips": top_ips,
        "top_urls": top_urls,
    }


@app.get("/traffic")
def traffic_page() -> Response:
    return Response(HTML, mimetype="text/html")


@app.get("/api/traffic")
def api_traffic():
    return jsonify(build_payload())


if __name__ == "__main__":
    start_snapshot_collector()
    app.run(host="127.0.0.1", port=8790)
