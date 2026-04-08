/**
 * movimentacoes.js — Tabela interativa com filtros
 */

let _allMovimentacoes = [];

function renderMovimentacoesTable(movimentacoes) {
  _allMovimentacoes = movimentacoes;
  applyTableFilters();
}

function applyTableFilters() {
  const search = (document.getElementById('search-movimentacao')?.value || '').toUpperCase();
  const tipo = document.getElementById('filter-tipo')?.value || '';
  const status = document.getElementById('filter-status')?.value || '';
  const mesFiltro = document.getElementById('filter-mes')?.value || 'TODOS';
  const anoFiltro = document.getElementById('filter-ano')?.value || 'TODOS';

  let filtered = _allMovimentacoes;

  if (search) filtered = filtered.filter(m => String(m['Movimentação']).toUpperCase().includes(search));
  if (tipo) filtered = filtered.filter(m => String(m['Tipo']).toUpperCase() === tipo);
  if (status === 'pago') filtered = filtered.filter(m => m['Data']);
  if (status === 'estimado') filtered = filtered.filter(m => !m['Data']);
  if (mesFiltro && mesFiltro !== 'TODOS') filtered = filtered.filter(m => String(m['Mês']).toUpperCase() === mesFiltro);
  if (anoFiltro && anoFiltro !== 'TODOS') filtered = filtered.filter(m => String(m['Ano']) === String(anoFiltro));

  const tbody = document.querySelector('#table-movimentacoes tbody');
  const empty = document.getElementById('table-empty');
  const wrapper = document.querySelector('.table-wrapper');

  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (wrapper) wrapper.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (wrapper) wrapper.style.display = '';
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = filtered.map(m => {
    const valor = typeof m['Valor'] === 'number' ? m['Valor'] : 0;
    const valorClass = valor >= 0 ? 'valor-positivo' : 'valor-negativo';
    const valorStr = formatCurrency(valor);
    const dataStr = m['Data'] ? `<span class="badge badge-pago">Pago</span> ${m['Data']}` : '<span class="badge badge-estimado">Estimado</span>';
    const tipoClass = String(m['Tipo']).toUpperCase() === 'REGULAR' ? 'badge-regular' : 'badge-paralelo';
    const parcela = m['Parcela'] || '—';

    return `<tr>
      <td><strong>${m['Movimentação'] || ''}</strong></td>
      <td>${m['Mês'] || ''}</td>
      <td>${m['Ano'] || ''}</td>
      <td class="${valorClass}">${valorStr}</td>
      <td>${dataStr}</td>
      <td>${parcela}</td>
      <td><span class="badge ${tipoClass}">${m['Tipo'] || ''}</span></td>
      <td class="cell-actions">
        <button class="btn-icon edit" title="Editar" onclick="openEditForm(${m._rowIndex})">✏️</button>
        <button class="btn-icon delete" title="Excluir" onclick="confirmDelete(${m._rowIndex}, '${(m['Movimentação'] || '').replace(/'/g, "\\'")}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function setupTableFilterListeners() {
  ['search-movimentacao', 'filter-tipo', 'filter-status'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', applyTableFilters);
  });
}
