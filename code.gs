/**
 * =============================================================================
 * SmartStock ERP — Google Apps Script (code.gs)
 * Arquitetura Multi-Filial (Filial 685 e Filial 948)
 * 
 * FUNÇÃO PRINCIPAL:
 * Receber dados em lote (JSON provenientes de arquivos .xlsx/.xls ou .csv)
 * e sincronizar com máxima performance nas abas 'smg13' e 'smg32'.
 * =============================================================================
 */

// IDs opcionais para scripts Standalone (se o script não estiver vinculado diretamente à planilha).
// Se o script estiver anexado à planilha (Extensões > Apps Script), ele usará getActiveSpreadsheet() automaticamente.
var CONFIG_SHEET_IDS = {
  'smg13': '', // Insira aqui se for uma planilha separada por ID
  'smg32': '', // Insira aqui se for uma planilha separada por ID
};

/**
 * Ponto de entrada para requisições POST do frontend
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var lockAcquired = false;

  try {
    // Tenta obter o lock por até 30 segundos para evitar concorrência simultânea de gravação
    lockAcquired = lock.tryLock(30000);
    if (!lockAcquired) {
      return createJsonResponse({
        success: false,
        message: 'O servidor do Google Sheets está ocupado processando outra sincronização. Tente novamente em alguns segundos.'
      });
    }

    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        success: false,
        message: 'Nenhum corpo de requisição (payload) foi recebido.'
      });
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({
        success: false,
        message: 'Payload inválido. Esperado JSON válido.'
      });
    }

    var action = payload.action;

    // Sincronização em lote das bases smg13 ou smg32
    if (action === 'syncMaster' || action === 'uploadData') {
      return handleSyncMaster(payload);
    }

    // Gatilho de recálculo mestre
    if (action === 'triggerUpdate') {
      return handleTriggerUpdate();
    }

    return createJsonResponse({
      success: false,
      message: 'Ação desconhecida: ' + action
    });

  } catch (err) {
    return createJsonResponse({
      success: false,
      message: 'Erro interno no Google Apps Script: ' + (err.message || err.toString())
    });
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

/**
 * Sincroniza dados na aba destino ('smg13' ou 'smg32')
 */
function handleSyncMaster(payload) {
  var targetBase = (payload.targetBase || 'smg13').toString().toLowerCase().trim();
  var data = payload.data;

  // 1. Validação de Payload
  if (!data || !Array.isArray(data) || data.length === 0) {
    return createJsonResponse({
      success: false,
      message: 'Nenhum registro válido fornecido para sincronização na base ' + targetBase.toUpperCase() + '.'
    });
  }

  // 2. Obter a Planilha (Spreadsheet)
  var sheet = resolveSheet(targetBase);
  if (!sheet) {
    return createJsonResponse({
      success: false,
      message: 'Não foi possível encontrar nem criar a aba "' + targetBase + '" na planilha da filial.'
    });
  }

  // 3. Extrair lista unificada de cabeçalhos
  var headersMap = {};
  var headers = [];

  // Começa com a ordem do primeiro objeto
  var firstRow = data[0] || {};
  Object.keys(firstRow).forEach(function(key) {
    headersMap[key] = true;
    headers.push(key);
  });

  // Garante que chaves adicionais de outros objetos também sejam mapeadas
  data.forEach(function(row) {
    if (row && typeof row === 'object') {
      Object.keys(row).forEach(function(k) {
        if (!headersMap[k]) {
          headersMap[k] = true;
          headers.push(k);
        }
      });
    }
  });

  if (headers.length === 0) {
    return createJsonResponse({
      success: false,
      message: 'Nenhuma coluna/cabeçalho identificada no arquivo enviado.'
    });
  }

  // 4. Limpar conteúdo anterior da planilha
  sheet.clearContents();

  // 5. Escrever Cabeçalho
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Formatação rápida do cabeçalho
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#e2e8f0');

  // 6. Preparar linhas para gravação performática em lote
  var rows = data.map(function(item) {
    return headers.map(function(h) {
      var val = item[h];
      return (val !== undefined && val !== null) ? val : '';
    });
  });

  // 7. Gravação em lotes (chunks) para tolerância a grandes volumes
  var BATCH_SIZE = 5000;
  for (var i = 0; i < rows.length; i += BATCH_SIZE) {
    var chunk = rows.slice(i, i + BATCH_SIZE);
    sheet.getRange(2 + i, 1, chunk.length, headers.length).setValues(chunk);
  }

  SpreadsheetApp.flush();

  // 8. Tenta disparar rotinas de atualização mestre se existirem no projeto GAS
  try {
    if (typeof processarPlanilha === 'function') {
      processarPlanilha();
    }
    if (typeof updateCacheTrigger === 'function') {
      updateCacheTrigger();
    }
  } catch (postSyncErr) {
    Logger.log('Aviso pós-sincronização: ' + postSyncErr.message);
  }

  return createJsonResponse({
    success: true,
    message: 'Base ' + targetBase.toUpperCase() + ' sincronizada com sucesso!',
    targetBase: targetBase,
    count: rows.length,
    columns: headers.length,
    timestamp: new Date().toISOString()
  });
}

/**
 * Executa o recálculo / atualização mestre
 */
function handleTriggerUpdate() {
  try {
    var messages = [];
    if (typeof processarPlanilha === 'function') {
      processarPlanilha();
      messages.push('processarPlanilha()');
    }
    if (typeof updateCacheTrigger === 'function') {
      updateCacheTrigger();
      messages.push('updateCacheTrigger()');
    }

    return createJsonResponse({
      success: true,
      message: 'Atualização mestre executada com sucesso!' + (messages.length > 0 ? ' (' + messages.join(', ') + ')' : ''),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: 'Erro ao executar rotina de atualização: ' + (err.message || err.toString())
    });
  }
}

/**
 * Localiza a aba (Sheet) pelo nome na planilha ativa ou por ID configurado
 */
function resolveSheet(targetBase) {
  var ss = null;

  // 1. Tenta obter a planilha ativa (quando o script está anexado à planilha)
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    ss = null;
  }

  // 2. Se não houver planilha ativa, tenta abrir pelo ID configurado
  if (!ss) {
    var sheetId = CONFIG_SHEET_IDS[targetBase];
    if (sheetId && sheetId.indexOf('1X') === -1 && sheetId.indexOf('1Y') === -1) {
      try {
        ss = SpreadsheetApp.openById(sheetId);
      } catch (openErr) {
        Logger.log('Erro ao abrir planilha por ID: ' + openErr.message);
      }
    }
  }

  if (!ss) return null;

  // 3. Procura a aba pelo nome (case-insensitive)
  var sheets = ss.getSheets();
  var matchedSheet = null;
  for (var i = 0; i < sheets.length; i++) {
    var currentName = sheets[i].getName().toLowerCase().replace(/\s+/g, '');
    var searchName = targetBase.toLowerCase().replace(/\s+/g, '');
    if (currentName === searchName) {
      matchedSheet = sheets[i];
      break;
    }
  }

  // 4. Se não encontrar, tenta criar a aba com o nome do target
  if (!matchedSheet) {
    try {
      matchedSheet = ss.insertSheet(targetBase.toLowerCase());
    } catch (insertErr) {
      // Se não conseguiu criar, utiliza a primeira aba como fallback
      matchedSheet = sheets[0];
    }
  }

  return matchedSheet;
}

/**
 * Retorna resposta formatada em JSON com cabeçalhos CORS
 */
function createJsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Healthcheck via GET para verificação no navegador
 */
function doGet(e) {
  return createJsonResponse({
    status: 'online',
    service: 'SmartStock ERP — GAS Sync Master v2',
    timestamp: new Date().toISOString()
  });
}
