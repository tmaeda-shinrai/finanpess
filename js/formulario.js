/**
 * formulario.js — Modal CRUD para movimentações
 */

let _deleteRowIndex = null;

function openAddForm() {
  document.getElementById('modal-title').textContent = 'Nova Movimentação';
  document.getElementById('btn-submit-form').textContent = 'Adicionar';
  document.getElementById('form-movimentacao').reset();
  document.getElementById('form-row-index').value = '';
  document.getElementById('form-ano').value = new Date().getFullYear();

  // Reset toggles
  setToggle('toggle-despesa', 'toggle-receita', 'toggle-despesa');
  setToggle('toggle-regular', 'toggle-paralelo', 'toggle-regular');

  // Populate suggestions
  populateSuggestions();

  document.getElementById('modal-form').style.display = 'flex';
}

function openEditForm(rowIndex) {
  const mov = _allMovimentacoes.find(m => m._rowIndex === rowIndex);
  if (!mov) return;

  document.getElementById('modal-title').textContent = 'Editar Movimentação';
  document.getElementById('btn-submit-form').textContent = 'Salvar Alterações';
  document.getElementById('form-row-index').value = rowIndex;

  document.getElementById('form-movimentacao-nome').value = mov['Movimentação'] || '';
  document.getElementById('form-mes').value = String(mov['Mês']).toUpperCase() || '';
  document.getElementById('form-ano').value = mov['Ano'] || new Date().getFullYear();

  const valor = typeof mov['Valor'] === 'number' ? mov['Valor'] : 0;
  document.getElementById('form-valor').value = Math.abs(valor);

  if (valor >= 0) {
    setToggle('toggle-despesa', 'toggle-receita', 'toggle-receita');
  } else {
    setToggle('toggle-despesa', 'toggle-receita', 'toggle-despesa');
  }

  // Date: convert dd/MM/yyyy to yyyy-MM-dd for input[type=date]
  const dataInput = document.getElementById('form-data');
  if (mov['Data']) {
    const parts = String(mov['Data']).split('/');
    if (parts.length === 3) {
      dataInput.value = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else {
      dataInput.value = '';
    }
  } else {
    dataInput.value = '';
  }

  document.getElementById('form-parcela').value = mov['Parcela'] || '';

  const tipoUpper = String(mov['Tipo']).toUpperCase();
  if (tipoUpper === 'PARALELO') {
    setToggle('toggle-regular', 'toggle-paralelo', 'toggle-paralelo');
  } else {
    setToggle('toggle-regular', 'toggle-paralelo', 'toggle-regular');
  }

  populateSuggestions();
  document.getElementById('modal-form').style.display = 'flex';
}

function closeForm() {
  document.getElementById('modal-form').style.display = 'none';
}

function setToggle(id1, id2, activeId) {
  document.getElementById(id1).classList.toggle('active', id1 === activeId);
  document.getElementById(id2).classList.toggle('active', id2 === activeId);
}

function populateSuggestions() {
  const dl = document.getElementById('sugestoes-movimentacao');
  if (!dl) return;
  const names = [...new Set(_allMovimentacoes.map(m => m['Movimentação']).filter(Boolean))];
  dl.innerHTML = names.map(n => `<option value="${n}">`).join('');
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const rowIndex = document.getElementById('form-row-index').value;
  const isEdit = !!rowIndex;

  const isDespesa = document.getElementById('toggle-despesa').classList.contains('active');
  const valorAbs = parseFloat(document.getElementById('form-valor').value) || 0;
  const valor = isDespesa ? -valorAbs : valorAbs;

  const isParalelo = document.getElementById('toggle-paralelo').classList.contains('active');

  // Convert date from yyyy-MM-dd to dd/MM/yyyy
  let dataStr = '';
  const dateVal = document.getElementById('form-data').value;
  if (dateVal) {
    const parts = dateVal.split('-');
    dataStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  const mov = {
    'Movimentação': document.getElementById('form-movimentacao-nome').value.trim(),
    'Mês': document.getElementById('form-mes').value,
    'Ano': parseInt(document.getElementById('form-ano').value),
    'Valor': valor,
    'Data': dataStr,
    'Parcela': document.getElementById('form-parcela').value.trim(),
    'Tipo': isParalelo ? 'PARALELO' : 'REGULAR'
  };

  const submitBtn = document.getElementById('btn-submit-form');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Salvando...';

  try {
    let result;
    if (isEdit) {
      result = await postToAPI('editMovimentacao', { rowIndex: parseInt(rowIndex), movimentacao: mov });
    } else {
      result = await postToAPI('addMovimentacao', { movimentacao: mov });
    }

    showToast(result.message || 'Salvo com sucesso!', 'success');
    closeForm();
    invalidateCache();
    await refreshData();
  } catch (err) {
    showToast('Erro: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = isEdit ? 'Salvar Alterações' : 'Adicionar';
  }
}

function confirmDelete(rowIndex, name) {
  _deleteRowIndex = rowIndex;
  document.getElementById('confirm-message').textContent =
    `Tem certeza que deseja excluir "${name}"?`;
  document.getElementById('modal-confirm').style.display = 'flex';
}

function closeConfirm() {
  document.getElementById('modal-confirm').style.display = 'none';
  _deleteRowIndex = null;
}

async function handleConfirmDelete() {
  if (!_deleteRowIndex) return;
  const btn = document.getElementById('confirm-ok');
  btn.disabled = true;
  btn.textContent = 'Excluindo...';

  try {
    const result = await postToAPI('deleteMovimentacao', { rowIndex: _deleteRowIndex });
    showToast(result.message || 'Excluído!', 'success');
    closeConfirm();
    invalidateCache();
    await refreshData();
  } catch (err) {
    showToast('Erro: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Excluir';
  }
}

function setupFormListeners() {
  document.getElementById('form-movimentacao')?.addEventListener('submit', handleFormSubmit);
  document.getElementById('btn-add-movimentacao')?.addEventListener('click', openAddForm);
  document.getElementById('modal-close')?.addEventListener('click', closeForm);
  document.getElementById('btn-cancel-form')?.addEventListener('click', closeForm);
  document.getElementById('confirm-close')?.addEventListener('click', closeConfirm);
  document.getElementById('confirm-cancel')?.addEventListener('click', closeConfirm);
  document.getElementById('confirm-ok')?.addEventListener('click', handleConfirmDelete);

  // Toggle buttons
  document.getElementById('toggle-despesa')?.addEventListener('click', () => setToggle('toggle-despesa', 'toggle-receita', 'toggle-despesa'));
  document.getElementById('toggle-receita')?.addEventListener('click', () => setToggle('toggle-despesa', 'toggle-receita', 'toggle-receita'));
  document.getElementById('toggle-regular')?.addEventListener('click', () => setToggle('toggle-regular', 'toggle-paralelo', 'toggle-regular'));
  document.getElementById('toggle-paralelo')?.addEventListener('click', () => setToggle('toggle-regular', 'toggle-paralelo', 'toggle-paralelo'));

  // Close modals on overlay click
  document.getElementById('modal-form')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeForm(); });
  document.getElementById('modal-confirm')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeConfirm(); });

  // Datalist binding
  const input = document.getElementById('form-movimentacao-nome');
  if (input) input.setAttribute('list', 'sugestoes-movimentacao');
}

// ═══ Toast ═══
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast ' + type;
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => toast.classList.remove('visible'), 3500);
}
