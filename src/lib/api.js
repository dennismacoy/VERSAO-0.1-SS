import {
  createPreVendaFirebase,
  createPedidoFirebase,
  getHistoryFirebase,
  updateStatusFirebase,
  updateRecordFirebase,
  deleteRecordFirebase,
  deleteMultipleFirebase,
} from './firebase';

// =============================================
// Google Apps Script (mantido APENAS para Login)
// =============================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbw0mQy3XLnfpf-EaKjScjG9PAam4p8Br7X0do9b6SrL_Cwdb7I_lXDd0lSaHtI0CpCxOw/exec";

const fetchGAS = async (payload) => {
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  } catch (error) {
    console.error(`[GAS] Erro (action: ${payload.action}):`, error);
    throw error;
  }
};

// =============================================
// API Pública (usada pelo resto do app)
// =============================================
export const api = {
  // Login continua no Google Apps Script (lê a aba "Usuarios")
  async login(username, password) {
    return await fetchGAS({ action: 'login', usuario: username, senha: password });
  },

  // --- FIREBASE: Pré-Vendas ---
  async createPreVenda(pedidoData) {
    return await createPreVendaFirebase(pedidoData);
  },

  async getPreVendas() {
    return await getHistoryFirebase('prevendas');
  },

  // --- FIREBASE: Pedidos B2B (Clientes) ---
  async createPedido(pedidoData) {
    return await createPedidoFirebase(pedidoData);
  },

  async getPedidos() {
    return await getHistoryFirebase('pedidos');
  },

  // --- FIREBASE: Histórico genérico ---
  async getHistory(nodeName) {
    // Mapeia nomes legados para nós do Firebase
    const nodeMap = {
      'Prevendas': 'prevendas',
      'prevendas': 'prevendas',
      'Pedidos': 'pedidos',
      'pedidos': 'pedidos',
    };
    const resolvedNode = nodeMap[nodeName] || nodeName;
    return await getHistoryFirebase(resolvedNode);
  },

  // --- FIREBASE: Atualização de Status ---
  async updateStatus(firebaseId, newStatus, nodeName = 'prevendas') {
    return await updateStatusFirebase(nodeName, firebaseId, newStatus);
  },

  // --- FIREBASE: Atualização de campos arbitrários ---
  async updateRecord(nodeName, firebaseId, fields) {
    return await updateRecordFirebase(nodeName, firebaseId, fields);
  },

  // --- FIREBASE: Exclusão ---
  async deleteRecord(nodeName, firebaseId) {
    return await deleteRecordFirebase(nodeName, firebaseId);
  },

  async deleteMultiple(nodeName, firebaseIds) {
    return await deleteMultipleFirebase(nodeName, firebaseIds);
  },

  // --- GAS: Upload de dados para planilha (relatórios/backoffice) ---
  async saveReport(reportData) {
    return await fetchGAS({ action: 'saveReport', data: reportData });
  },

  async uploadData(payload, targetBase) {
    return await fetchGAS({ action: 'uploadData', targetBase, data: payload });
  }
};

