const API_URL = "https://script.google.com/macros/s/AKfycbwfUhRr1WmEmfNQzN12W_kX1Lcf7VSWX2c-QT5dERX4JnRT7ntUQ7bLLwFHQpQpxsdXpA/exec";

// Helper to make POST requests to GAS
// We use 'text/plain' because GAS often fails CORS preflight with 'application/json'
const fetchGAS = async (payload) => {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });
    
    // Attempt to parse JSON response. 
    // Note: If no-cors is used, response is opaque. We assume CORS is handled in GAS via Content-Type text/plain workaround.
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      // If it's not JSON, return the text directly
      return text;
    }
  } catch (error) {
    console.error(`Error in GAS fetch (action: ${payload.action}):`, error);
    throw error;
  }
};

export const api = {
  async login(username, password) {
    return await fetchGAS({ action: 'login', usuario: username, senha: password });
  },

  async searchProducts(query, type = 'geral') {
    return await fetchGAS({ action: 'searchProducts', query, type });
  },

  async createPreVenda(pedidoData) {
    return await fetchGAS({ action: 'createPreVenda', data: pedidoData });
  },

  async getHistory(sheetName) {
    return await fetchGAS({ action: 'getHistory', sheetName });
  },

  async updateStatus(id, newStatus) {
    return await fetchGAS({ action: 'updateStatus', id, status: newStatus });
  },

  async saveReport(reportData) {
    return await fetchGAS({ action: 'saveReport', data: reportData });
  },

  async uploadData(payload, targetBase) {
    return await fetchGAS({ action: 'uploadData', targetBase, data: payload });
  }
};
