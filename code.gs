/**
 * SmartStock ERP — Google Apps Script (code.gs)
 * 
 * FUNÇÃO ÚNICA: Receber POST do portal e atualizar as planilhas smg13 e smg32.
 * Todas as demais operações (login, CRUD, etc.) foram migradas para o Firebase.
 */

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    if (action === 'syncMaster') {
      return handleSyncMaster(payload);
    }

    // Ação legada de login (manter compatibilidade temporária)
    if (action === 'login') {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: 'Login migrado para Firebase. Atualize o portal.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: 'Ação desconhecida: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: 'Erro interno: ' + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Sincronização Master — Recebe um array de objetos e grava na planilha destino.
 * Suporta as bases: smg13 e smg32.
 */
function handleSyncMaster(payload) {
  var targetBase = payload.targetBase || 'smg13';
  var data = payload.data;

  if (!data || !Array.isArray(data) || data.length === 0) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: 'Nenhum dado recebido.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // IDs das planilhas — SUBSTITUA PELOS IDs REAIS
  var SHEET_IDS = {
    'smg13': '1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // ID da planilha SMG 13
    'smg32': '1YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY', // ID da planilha SMG 32
  };

  var sheetId = SHEET_IDS[targetBase];
  if (!sheetId) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: 'Base destino inválida: ' + targetBase }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheets()[0]; // Usa a primeira aba

    // Extrai cabeçalhos do primeiro objeto
    var headers = Object.keys(data[0]);

    // Limpa a planilha
    sheet.clear();

    // Escreve cabeçalhos
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Escreve dados
    var rows = data.map(function(row) {
      return headers.map(function(h) {
        return row[h] !== undefined ? row[h] : '';
      });
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    // Formatação básica do cabeçalho
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f0f0f0');

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Sincronizado com sucesso! ' + rows.length + ' linhas gravadas em ' + targetBase + '.',
        count: rows.length
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: 'Erro ao gravar planilha: ' + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'SmartStock GAS v2 — Sync Only', timestamp: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}
