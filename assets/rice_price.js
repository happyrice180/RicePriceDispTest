(() => {
  const CONFIG = {
    jsonUrl: 'https://happyrice180.github.io/RicePriceDispTest/data/rice_price.json',

    chartCanvasId: 'ricePriceChart',
    metaElementId: 'ricePriceMeta',

    // 開発中は true 推奨。JSON更新が反映されないときのキャッシュ回避。
    // BASE本番では false でもよい。
    cacheBust: true
  };

  document.addEventListener('DOMContentLoaded', main);

  async function main() {
    const metaEl = document.getElementById(CONFIG.metaElementId);

    try {
      if (typeof Chart === 'undefined') {
        throw new Error('Chart.js が読み込まれていません。scriptタグの順番を確認してください。');
      }

      const json = await fetchRicePriceJson_();

      validateRicePriceJson_(json);

      renderRicePriceChart_(json);
      renderMeta_(json);
    } catch (error) {
      console.error(error);

      if (metaEl) {
        metaEl.classList.add('chart-error');
        metaEl.textContent =
          'グラフの読み込みに失敗しました。\n' +
          String(error && error.message ? error.message : error);
      }
    }
  }

  async function fetchRicePriceJson_() {
    const url = CONFIG.cacheBust
      ? `${CONFIG.jsonUrl}?v=${makeCacheBustKey_()}`
      : CONFIG.jsonUrl;

    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error(`JSON取得失敗: HTTP ${response.status}`);
    }

    return response.json();
  }

  function makeCacheBustKey_() {
    // 1時間単位でキャッシュ回避。
    // 毎回 Date.now() にすると閲覧ごとに完全別URLになるため、まずは時間単位で十分。
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    return `${y}${m}${d}${h}`;
  }

  function validateRicePriceJson_(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('JSONの形式が不正です。');
    }

    if (!Array.isArray(json.data)) {
      throw new Error('JSON内に data 配列がありません。');
    }

    if (json.data.length === 0) {
      throw new Error('data 配列が空です。');
    }

    json.data.forEach((row, index) => {
      if (!row.month) {
        throw new Error(`data[${index}].month がありません。`);
      }

      if (typeof row.price !== 'number') {
        throw new Error(`data[${index}].price が数値ではありません。`);
      }
    });
  }

  function renderRicePriceChart_(json) {
    const canvas = document.getElementById(CONFIG.chartCanvasId);

    if (!canvas) {
      throw new Error(`canvas が見つかりません: ${CONFIG.chartCanvasId}`);
    }

    const rows = [...json.data].sort((a, b) => String(a.month).localeCompare(String(b.month)));

    const labels = rows.map(row => formatMonthLabel_(row.month));
    const prices = rows.map(row => row.price);

    const unit = json.unit || rows[0]?.unit || '円';

    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: `米価（${unit}）`,
            data: prices,
            tension: 0.25,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,

        interaction: {
          mode: 'index',
          intersect: false
        },

        plugins: {
          legend: {
            display: true
          },
          tooltip: {
            callbacks: {
              label: context => {
                const value = context.parsed.y;
                return ` ${formatYen_(value)} / ${unit.replace(/^円\//, '')}`;
              }
            }
          }
        },

        scales: {
          x: {
            title: {
              display: true,
              text: '対象月'
            }
          },
          y: {
            title: {
              display: true,
              text: unit
            },
            ticks: {
              callback: value => formatYen_(value)
            }
          }
        }
      }
    });
  }

  function renderMeta_(json) {
    const metaEl = document.getElementById(CONFIG.metaElementId);
    if (!metaEl) return;

    const rows = [...json.data].sort((a, b) => String(a.month).localeCompare(String(b.month)));
    const latest = rows[rows.length - 1];

    const updatedAt = json.updated_at
      ? formatDateTime_(json.updated_at)
      : '不明';

    const latestText = latest
      ? `${formatMonthLabel_(latest.month)}：${formatYen_(latest.price)}`
      : '不明';

    metaEl.textContent =
      `最新データ：${latestText} ／ ` +
      `単位：${json.unit || latest?.unit || '不明'} ／ ` +
      `最終更新：${updatedAt} ／ ` +
      `出典：${json.source || '不明'}`;
  }

  function formatMonthLabel_(monthText) {
    const s = String(monthText);

    const match = s.match(/^(\d{4})-(\d{1,2})$/);
    if (!match) return s;

    return `${match[1]}年${Number(match[2])}月`;
  }

  function formatYen_(value) {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatDateTime_(isoText) {
    const date = new Date(isoText);

    if (isNaN(date.getTime())) {
      return String(isoText);
    }

    return new Intl.DateTimeFormat('ja-JP', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }
})();
