/**
 * app.js — Orquestração geral da aplicação
 */

let _dashboardData = null;

async function initApp() {
  showLoading(true);
  try {
    _dashboardData = await fetchDashboardData(true);
    populateFilters(_dashboardData.meses);
    applyDashboardFilters();
    renderMovimentacoesTable(_dashboardData.movimentacoes);
  } catch (err) {
    showToast('Erro ao carregar dados: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function refreshData() {
  showLoading(true);
  try {
    _dashboardData = await fetchDashboardData(true);
    populateFilters(_dashboardData.meses);
    applyDashboardFilters();
    renderMovimentacoesTable(_dashboardData.movimentacoes);
  } catch (err) {
    showToast('Erro ao atualizar: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

function populateFilters(meses) {
  const mesSelect = document.getElementById('filter-mes');
  const anoSelect = document.getElementById('filter-ano');
  if (!mesSelect || !anoSelect) return;

  const currentMes = mesSelect.value;
  const currentAno = anoSelect.value;

  const uniqueMeses = [...new Set(meses.map(m => m.mes))];
  const uniqueAnos = [...new Set(meses.map(m => m.ano))].sort((a, b) => b - a);

  mesSelect.innerHTML = '<option value="TODOS">Todos</option>' +
    uniqueMeses.map(m => `<option value="${m}">${m.charAt(0) + m.slice(1).toLowerCase()}</option>`).join('');

  anoSelect.innerHTML = '<option value="TODOS">Todos</option>' +
    uniqueAnos.map(a => `<option value="${a}">${a}</option>`).join('');

  // Restore or select most recent
  if (currentMes && [...mesSelect.options].some(o => o.value === currentMes)) {
    mesSelect.value = currentMes;
  } else if (meses.length > 0) {
    mesSelect.value = meses[0].mes;
  }

  if (currentAno && [...anoSelect.options].some(o => o.value === currentAno)) {
    anoSelect.value = currentAno;
  } else if (meses.length > 0) {
    anoSelect.value = String(meses[0].ano);
  }
}

function applyDashboardFilters() {
  if (!_dashboardData) return;
  const mes = document.getElementById('filter-mes')?.value || 'TODOS';
  const ano = document.getElementById('filter-ano')?.value || 'TODOS';
  renderDashboard(_dashboardData.movimentacoes, mes, ano);
}

function showLoading(visible) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.toggle('visible', visible);
}

// ═══ Tab Navigation ═══
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tab = document.getElementById('tab-' + btn.dataset.tab);
      if (tab) tab.classList.add('active');
      // Re-apply table filters when switching to movimentacoes
      if (btn.dataset.tab === 'movimentacoes') applyTableFilters();
    });
  });
}

// ═══ Gerar Mensais ═══
async function handleGerarMensais() {
  if (!confirm('Gerar movimentações do mês atual a partir do modelo?\n\nIsso copiará todas as entradas do MODELO para MOVIMENTACOES com o mês e ano atuais.')) return;

  const btn = document.getElementById('btn-gerar-mensais');
  btn.disabled = true;
  btn.textContent = '⏳ Gerando...';

  try {
    const result = await postToAPI('gerarMensais');
    if (result.success) {
      showToast(result.message, 'success');
      invalidateCache();
      await refreshData();
    } else {
      showToast(result.message || 'Falha ao gerar.', 'error');
    }
  } catch (err) {
    showToast('Erro: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Gerar Mensais';
  }
}

// ═══ Init ═══
window.addEventListener('load', () => {
  setupTabs();
  setupFormListeners();
  setupTableFilterListeners();

  document.getElementById('filter-mes')?.addEventListener('change', () => { applyDashboardFilters(); applyTableFilters(); });
  document.getElementById('filter-ano')?.addEventListener('change', () => { applyDashboardFilters(); applyTableFilters(); });
  document.getElementById('btn-gerar-mensais')?.addEventListener('click', handleGerarMensais);
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  // Init Google auth
  const waitForGIS = setInterval(() => {
    if (typeof google !== 'undefined' && google.accounts) {
      clearInterval(waitForGIS);
      initGoogleAuth();
      triggerGoogleLogin();
    }
  }, 100);
  setTimeout(() => clearInterval(waitForGIS), 10000);
});
