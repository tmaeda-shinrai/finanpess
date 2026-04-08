// ═══════════════════════════════════════════════════════════════
//  FinanPess — Backend API (Google Apps Script)
// ═══════════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1XJAmuztZqxwmoLOeAzEuGQPjtq0YZbWclEFsydqZnww';
const GOOGLE_CLIENT_ID = '198043502728-ge0gbnol6muoir619bu1bg3vpnu8ns9a.apps.googleusercontent.com';
const MESES = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO',
               'JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];

// ═══════════════════════════════════════════
//  Autenticação e Autorização
// ═══════════════════════════════════════════

function verificarTokenGoogle(idToken) {
  if (!idToken) throw new Error('Token de autenticação ausente.');
  try {
    const response = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + idToken,
      { muteHttpExceptions: true }
    );
    if (response.getResponseCode() !== 200) throw new Error('Token inválido ou expirado.');
    const payload = JSON.parse(response.getContentText());
    if (payload.aud !== GOOGLE_CLIENT_ID) throw new Error('Token não foi emitido para esta aplicação.');
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && parseInt(payload.exp) < now) throw new Error('Token expirado. Faça login novamente.');
    return payload.email;
  } catch (error) {
    if (error.message.includes('Token')) throw error;
    throw new Error('Falha ao verificar autenticação: ' + error.message);
  }
}

function emailTemAcessoAPlanilha(email) {
  try {
    const file = DriveApp.getFileById(SPREADSHEET_ID);
    const emailLower = email.toLowerCase();
    const editors = file.getEditors();
    for (let i = 0; i < editors.length; i++) {
      if (editors[i].getEmail().toLowerCase() === emailLower) return true;
    }
    const viewers = file.getViewers();
    for (let i = 0; i < viewers.length; i++) {
      if (viewers[i].getEmail().toLowerCase() === emailLower) return true;
    }
    const owner = file.getOwner();
    if (owner && owner.getEmail().toLowerCase() === emailLower) return true;
    return false;
  } catch (error) {
    Logger.log('Erro ao verificar acesso: ' + error.message);
    return false;
  }
}

function autorizarPermissoes() {
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=test', { muteHttpExceptions: true });
  Logger.log('UrlFetchApp: OK (status ' + r.getResponseCode() + ')');
  var file = DriveApp.getFileById(SPREADSHEET_ID);
  Logger.log('DriveApp: OK (' + file.getName() + ')');
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('SpreadsheetApp: OK (' + ss.getName() + ')');
  Logger.log('✅ Todas as permissões autorizadas com sucesso!');
}

// ═══════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════

function autenticarRequest(idToken) {
  const email = verificarTokenGoogle(idToken);
  if (!emailTemAcessoAPlanilha(email)) {
    throw new Error('Acesso negado. Seu email (' + email + ') não tem permissão.');
  }
  return email;
}

function criarResposta(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function criarRespostaErro(msg) {
  return ContentService.createTextOutput(JSON.stringify({ error: msg })).setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════
//  Handlers
// ═══════════════════════════════════════════

function doGet(e) {
  var params = e.parameter;
  try { autenticarRequest(params.id_token); } catch (err) { return criarRespostaErro(err.message); }
  var action = params.action || 'getDashboardData';
  try {
    var result;
    switch (action) {
      case 'getDashboardData': result = getDashboardData(); break;
      case 'getMovimentacoes': result = getSheetData('MOVIMENTACOES'); break;
      case 'getModelo': result = getSheetData('MODELO'); break;
      default: result = { error: 'Ação não reconhecida: ' + action };
    }
    return criarResposta(result);
  } catch (err) { return criarRespostaErro(err.message); }
}

function doPost(e) {
  var data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return criarRespostaErro('Dados inválidos.'); }
  try { autenticarRequest(data.id_token); } catch (err) { return criarRespostaErro(err.message); }
  var action = data.action;
  try {
    var result;
    switch (action) {
      case 'addMovimentacao': result = addMovimentacao(data.movimentacao); break;
      case 'editMovimentacao': result = editMovimentacao(data.rowIndex, data.movimentacao); break;
      case 'deleteMovimentacao': result = deleteMovimentacao(data.rowIndex); break;
      case 'gerarMensais': result = gerarMensais(); break;
      default: result = { error: 'Ação não reconhecida: ' + action };
    }
    return criarResposta(result);
  } catch (err) { return criarRespostaErro(err.message); }
}

// ═══════════════════════════════════════════
//  Leitura
// ═══════════════════════════════════════════

function getSheetData(sheetName) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Aba não encontrada: ' + sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = { _rowIndex: i + 1 };
    var hasValue = false;
    for (var j = 0; j < headers.length; j++) {
      var value = data[i][j];
      if (value instanceof Date) {
        value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      }
      row[headers[j]] = value;
      if (value !== '' && value !== null && value !== undefined) hasValue = true;
    }
    if (hasValue) rows.push(row);
  }
  return rows;
}

function getDashboardData() {
  var movimentacoes = getSheetData('MOVIMENTACOES');
  var modelo = getSheetData('MODELO');
  var monthSet = {};
  movimentacoes.forEach(function(m) {
    if (m['Mês'] && m['Ano']) {
      var key = m['Mês'] + '|' + m['Ano'];
      monthSet[key] = true;
    }
  });
  var meses = Object.keys(monthSet).map(function(k) {
    var parts = k.split('|');
    return { mes: parts[0], ano: parseInt(parts[1]) };
  }).sort(function(a, b) {
    if (a.ano !== b.ano) return b.ano - a.ano;
    return MESES.indexOf(b.mes) - MESES.indexOf(a.mes);
  });
  return { movimentacoes: movimentacoes, modelo: modelo, meses: meses };
}

// ═══════════════════════════════════════════
//  Escrita
// ═══════════════════════════════════════════

function addMovimentacao(mov) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('MOVIMENTACOES');
  if (!sheet) throw new Error('Aba MOVIMENTACOES não encontrada.');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newRow = headers.map(function(header) {
    var key = String(header).trim();
    var value = mov[key];
    if (key === 'Data' && value) {
      var parts = value.split('/');
      if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    if (key === 'Valor' && typeof value === 'number') return value;
    if (key === 'Valor' && typeof value === 'string') {
      return parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.'));
    }
    return value !== undefined && value !== null ? value : '';
  });
  sheet.appendRow(newRow);
  return { success: true, message: 'Movimentação adicionada com sucesso!' };
}

function editMovimentacao(rowIndex, mov) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('MOVIMENTACOES');
  if (!sheet) throw new Error('Aba MOVIMENTACOES não encontrada.');
  if (!rowIndex || rowIndex < 2) throw new Error('Índice de linha inválido.');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var updatedRow = headers.map(function(header) {
    var key = String(header).trim();
    var value = mov[key];
    if (key === 'Data' && value) {
      var parts = value.split('/');
      if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    if (key === 'Data' && !value) return '';
    if (key === 'Valor' && typeof value === 'number') return value;
    if (key === 'Valor' && typeof value === 'string') {
      return parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.'));
    }
    return value !== undefined && value !== null ? value : '';
  });
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);
  return { success: true, message: 'Movimentação atualizada com sucesso!' };
}

function deleteMovimentacao(rowIndex) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('MOVIMENTACOES');
  if (!sheet) throw new Error('Aba MOVIMENTACOES não encontrada.');
  if (!rowIndex || rowIndex < 2) throw new Error('Índice de linha inválido.');
  sheet.deleteRow(rowIndex);
  return { success: true, message: 'Movimentação excluída com sucesso!' };
}

// ═══════════════════════════════════════════
//  Geração Mensal (MODELO → MOVIMENTACOES)
// ═══════════════════════════════════════════

function gerarMensais() {
  var now = new Date();
  var mesNome = MESES[now.getMonth()];
  var ano = now.getFullYear();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheetMov = ss.getSheetByName('MOVIMENTACOES');
  var sheetModelo = ss.getSheetByName('MODELO');
  if (!sheetMov) throw new Error('Aba MOVIMENTACOES não encontrada.');
  if (!sheetModelo) throw new Error('Aba MODELO não encontrada.');

  // Check existing entries for this month
  var movData = sheetMov.getDataRange().getValues();
  var headers = movData[0].map(function(h) { return String(h).trim(); });
  var mesCol = headers.indexOf('Mês');
  var anoCol = headers.indexOf('Ano');
  var existingCount = 0;
  for (var i = 1; i < movData.length; i++) {
    if (String(movData[i][mesCol]).toUpperCase() === mesNome && parseInt(movData[i][anoCol]) === ano) existingCount++;
  }

  // Read MODELO
  var modeloData = sheetModelo.getDataRange().getValues();
  var modeloHeaders = modeloData[0].map(function(h) { return String(h).trim(); });
  var parcelaCol = modeloHeaders.indexOf('Parcela');
  var newRows = [];
  var parcelaUpdates = [];

  for (var i = 1; i < modeloData.length; i++) {
    var hasValue = false;
    for (var j = 0; j < modeloData[i].length; j++) {
      if (modeloData[i][j] !== '' && modeloData[i][j] !== null) hasValue = true;
    }
    if (!hasValue) continue;

    var newRow = headers.map(function(header) {
      var mci = modeloHeaders.indexOf(header);
      if (mci === -1) return '';
      if (header === 'Mês') return mesNome;
      if (header === 'Ano') return ano;
      if (header === 'Data') return '';
      return modeloData[i][mci];
    });
    newRows.push(newRow);

    // Parcela increment
    if (parcelaCol >= 0) {
      var parcela = String(modeloData[i][parcelaCol]);
      if (parcela && parcela.includes('/')) {
        var parts = parcela.split('/');
        var next = (parseInt(parts[0]) + 1) + '/' + parts[1];
        parcelaUpdates.push({ row: i + 1, col: parcelaCol + 1, value: next });
      }
    }
  }

  if (newRows.length === 0) return { success: false, message: 'Nenhum modelo encontrado.' };

  // Append rows
  var lastRow = sheetMov.getLastRow();
  sheetMov.getRange(lastRow + 1, 1, newRows.length, headers.length).setValues(newRows);

  // Update parcelas in MODELO
  for (var u = 0; u < parcelaUpdates.length; u++) {
    sheetModelo.getRange(parcelaUpdates[u].row, parcelaUpdates[u].col).setValue(parcelaUpdates[u].value);
  }

  var msg = newRows.length + ' movimentações geradas para ' + mesNome + '/' + ano + '.';
  if (existingCount > 0) msg += ' (Atenção: já existiam ' + existingCount + ' entradas para este mês)';
  return { success: true, message: msg, count: newRows.length, mes: mesNome, ano: ano };
}
