import {
  loginFirebase,
  createPreVendaFirebase,
  createPedidoFirebase,
  getHistoryFirebase,
  updateStatusFirebase,
  updateRecordFirebase,
  deleteRecordFirebase,
  deleteMultipleFirebase,
  saveReportFirebase,
  changePasswordFirebase,
} from './firebase';

// =============================================
// Google Apps Script — SOMENTE para Sincronização Master (smg13/smg32)
// =============================================
const GAS_SYNC_URL = "https://script.google.com/macros/s/AKfycbwGj3Zc_EnS2nCetZonIroEquK9kyl-k8uDwae7if6Ctpw2TSZIiVCXuZu2JdI6YqSE/exec";

const fetchGAS = async (payload) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const response = await fetch(GAS_SYNC_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Timeout: A requisição demorou mais de 20 segundos.');
    }
    console.error(`[GAS] Erro (action: ${payload.action}):`, error);
    throw error;
  }
};

// =============================================
// API Pública (usada pelo resto do app)
// =============================================
export const api = {
  // ---- Login via Firebase (sem GAS) ----
  async login(username, password) {
    return await loginFirebase(username, password);
  },

  // ---- Trocar senha do usuário ----
  async changePassword(firebaseId, newPassword) {
    return await changePasswordFirebase(firebaseId, newPassword);
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
      'Relatorios_Hist': 'relatorios_hist',
      'relatorios_hist': 'relatorios_hist',
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

  // --- FIREBASE: Salvar relatório no histórico ---
  async saveReport(reportData) {
    return await saveReportFirebase(reportData);
  },

  // --- GAS: Sincronização Master (ÚNICO uso restante do GAS) ---
  // Dispara dados para as planilhas smg13 e smg32
  async syncToSheet(targetBase, data) {
    return await fetchGAS({ action: 'syncMaster', targetBase, data });
  },
};


