/**
 * dashboard.js — Cards de resumo + Gráficos Chart.js
 */

let chartBarRegular = null, chartBarParalelo = null;
let chartDoughnutRegular = null, chartDoughnutParalelo = null;

const CHART_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316',
  '#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6',
  '#a855f7','#d946ef','#f59e0b','#10b981','#64748b'
];

function formatCurrency(value) {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (value < 0 ? '-' : '') + 'R$ ' + formatted;
}

function renderDashboard(movimentacoes, mesFiltro, anoFiltro) {
  let filtered = movimentacoes;
  if (mesFiltro && mesFiltro !== 'TODOS') {
    filtered = filtered.filter(m => String(m['Mês']).toUpperCase() === mesFiltro);
  }
  if (anoFiltro && anoFiltro !== 'TODOS') {
    filtered = filtered.filter(m => String(m['Ano']) === String(anoFiltro));
  }

  const regular = filtered.filter(m => String(m['Tipo']).toUpperCase() === 'REGULAR');
  const paralelo = filtered.filter(m => String(m['Tipo']).toUpperCase() === 'PARALELO');

  renderCards('cards-regular', regular);
  renderCards('cards-paralelo', paralelo);
  renderBarChart('chart-bar-regular', regular, chartBarRegular, c => chartBarRegular = c);
  renderBarChart('chart-bar-paralelo', paralelo, chartBarParalelo, c => chartBarParalelo = c);
  renderDoughnutChart('chart-doughnut-regular', regular, chartDoughnutRegular, c => chartDoughnutRegular = c);
  renderDoughnutChart('chart-doughnut-paralelo', paralelo, chartDoughnutParalelo, c => chartDoughnutParalelo = c);
}

function renderCards(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const receitasPagas = data.filter(m => m['Valor'] > 0 && m['Data']).reduce((s, m) => s + m['Valor'], 0);
  const receitasEst = data.filter(m => m['Valor'] > 0 && !m['Data']).reduce((s, m) => s + m['Valor'], 0);
  const despesasPagas = data.filter(m => m['Valor'] < 0 && m['Data']).reduce((s, m) => s + Math.abs(m['Valor']), 0);
  const despesasEst = data.filter(m => m['Valor'] < 0 && !m['Data']).reduce((s, m) => s + Math.abs(m['Valor']), 0);
  const saldoReal = data.filter(m => m['Data']).reduce((s, m) => s + m['Valor'], 0);
  const saldoProj = data.reduce((s, m) => s + m['Valor'], 0);

  container.innerHTML = `
    <div class="summary-card receita">
      <div class="card-label">Receitas</div>
      <div class="card-value positive">${formatCurrency(receitasPagas + receitasEst)}</div>
      <div class="card-sub">Recebido: <span>${formatCurrency(receitasPagas)}</span> · Estimado: <span>${formatCurrency(receitasEst)}</span></div>
    </div>
    <div class="summary-card despesa">
      <div class="card-label">Despesas</div>
      <div class="card-value negative">${formatCurrency(-(despesasPagas + despesasEst))}</div>
      <div class="card-sub">Pago: <span>${formatCurrency(despesasPagas)}</span> · Estimado: <span>${formatCurrency(despesasEst)}</span></div>
    </div>
    <div class="summary-card saldo-real">
      <div class="card-label">Saldo Realizado</div>
      <div class="card-value ${saldoReal >= 0 ? 'positive' : 'negative'}">${formatCurrency(saldoReal)}</div>
      <div class="card-sub">Valores já pagos/recebidos</div>
    </div>
    <div class="summary-card saldo-proj">
      <div class="card-label">Saldo Projetado</div>
      <div class="card-value ${saldoProj >= 0 ? 'positive' : 'negative'}">${formatCurrency(saldoProj)}</div>
      <div class="card-sub">Inclui estimados pendentes</div>
    </div>
  `;
}

function renderBarChart(canvasId, data, existingChart, setter) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (existingChart) existingChart.destroy();

  const groups = {};
  data.forEach(m => {
    const name = m['Movimentação'] || 'Outros';
    if (!groups[name]) groups[name] = { pago: 0, estimado: 0 };
    const abs = Math.abs(m['Valor'] || 0);
    if (m['Data']) groups[name].pago += abs;
    else groups[name].estimado += abs;
  });

  const labels = Object.keys(groups).sort((a, b) => (groups[b].pago + groups[b].estimado) - (groups[a].pago + groups[a].estimado));
  const pagoData = labels.map(l => groups[l].pago);
  const estData = labels.map(l => groups[l].estimado);

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels.map(l => l.length > 15 ? l.substring(0, 14) + '…' : l),
      datasets: [
        { label: 'Pago/Recebido', data: pagoData, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4, barPercentage: 0.7 },
        { label: 'Estimado', data: estData, backgroundColor: 'rgba(245,158,11,0.5)', borderRadius: 4, barPercentage: 0.7 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } } },
      scales: {
        x: { ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#64748b', font: { family: 'Inter', size: 10 }, callback: v => 'R$ ' + v.toLocaleString('pt-BR') }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
  canvas.parentElement.style.height = '280px';
  setter(chart);
}

function renderDoughnutChart(canvasId, data, existingChart, setter) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (existingChart) existingChart.destroy();

  const pago = data.filter(m => m['Data']).reduce((s, m) => s + Math.abs(m['Valor'] || 0), 0);
  const estimado = data.filter(m => !m['Data']).reduce((s, m) => s + Math.abs(m['Valor'] || 0), 0);

  if (pago === 0 && estimado === 0) {
    canvas.parentElement.style.height = '280px';
    setter(null);
    return;
  }

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Pago/Recebido', 'Estimado'],
      datasets: [{
        data: [pago, estimado],
        backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(245,158,11,0.6)'],
        borderColor: ['rgba(16,185,129,1)', 'rgba(245,158,11,1)'],
        borderWidth: 1, hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 16 } },
        tooltip: { callbacks: { label: ctx => ctx.label + ': R$ ' + ctx.parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) } }
      }
    }
  });
  canvas.parentElement.style.height = '280px';
  setter(chart);
}
