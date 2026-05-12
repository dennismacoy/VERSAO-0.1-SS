import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, push, update, remove, onValue, query, orderByChild } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCxTCOr-ud2h2Ec17WCXfUp5krrngZNqs4",
  authDomain: "atacadao-ss.firebaseapp.com",
  databaseURL: "https://atacadao-ss-default-rtdb.firebaseio.com",
  projectId: "atacadao-ss",
  storageBucket: "atacadao-ss.firebasestorage.app",
  messagingSenderId: "66416290882",
  appId: "1:66416290882:web:8917d52f92568c7d2711db",
  measurementId: "G-PL1JVTNRLZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// =============================================
// LEITURA DE DADOS (Produtos / Usuarios)
// =============================================

/**
 * Busca todos os produtos do nó /baseProdutos (leitura única).
 * Retorna um array de objetos.
 */
export const fetchProductsFromFirebase = async () => {
  try {
    const snapshot = await get(ref(db, 'baseProdutos'));
    if (!snapshot.exists()) return [];

    const data = snapshot.val();

    // Se for um objeto { chave: {...}, ... }, converte para array
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return Object.values(data);
    }

    // Se já for um array (caso raro), retorna direto
    return Array.isArray(data) ? data.filter(Boolean) : [];
  } catch (error) {
    console.error('[Firebase] Erro ao buscar produtos:', error);
    throw error;
  }
};

/**
 * Listener em tempo real para o nó /baseProdutos.
 * Chama o callback sempre que houver alteração.
 * Retorna a função unsubscribe.
 */
export const listenToProducts = (callback) => {
  const productsRef = ref(db, 'baseProdutos');
  return onValue(productsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const items = data && typeof data === 'object' && !Array.isArray(data)
      ? Object.values(data)
      : (Array.isArray(data) ? data.filter(Boolean) : []);
    callback(items);
  }, (error) => {
    console.error('[Firebase] Erro no listener de produtos:', error);
  });
};

// =============================================
// GRAVAÇÃO DE DADOS (Pedidos / Pré-Vendas)
// =============================================

/**
 * Cria uma nova Pré-Venda no nó /prevendas.
 * Usa push() para gerar ID único do Firebase.
 */
export const createPreVendaFirebase = async (pedidoData) => {
  try {
    const prevendasRef = ref(db, 'prevendas');
    const newRef = push(prevendasRef);
    const data = {
      ...pedidoData,
      firebaseId: newRef.key,
      createdAt: new Date().toISOString(),
    };
    await set(newRef, data);
    return { success: true, id: newRef.key, data };
  } catch (error) {
    console.error('[Firebase] Erro ao criar pré-venda:', error);
    throw error;
  }
};

/**
 * Cria um novo Pedido B2B (cliente) no nó /pedidos.
 */
export const createPedidoFirebase = async (pedidoData) => {
  try {
    const pedidosRef = ref(db, 'pedidos');
    const newRef = push(pedidosRef);
    const data = {
      ...pedidoData,
      firebaseId: newRef.key,
      createdAt: new Date().toISOString(),
    };
    await set(newRef, data);
    return { success: true, id: newRef.key, data };
  } catch (error) {
    console.error('[Firebase] Erro ao criar pedido:', error);
    throw error;
  }
};

/**
 * Busca todos os registros de um nó (ex: 'prevendas', 'pedidos').
 * Retorna array ordenado por data (mais recente primeiro).
 */
export const getHistoryFirebase = async (nodeName) => {
  try {
    const snapshot = await get(ref(db, nodeName));
    if (!snapshot.exists()) return [];

    const data = snapshot.val();
    const items = data && typeof data === 'object' && !Array.isArray(data)
      ? Object.entries(data).map(([key, val]) => ({ ...val, firebaseId: key }))
      : (Array.isArray(data) ? data.filter(Boolean) : []);

    // Ordena por data decrescente
    return items.sort((a, b) => new Date(b.createdAt || b.data || 0) - new Date(a.createdAt || a.data || 0));
  } catch (error) {
    console.error(`[Firebase] Erro ao buscar histórico de ${nodeName}:`, error);
    throw error;
  }
};

/**
 * Atualiza o status de um registro em um nó específico.
 */
export const updateStatusFirebase = async (nodeName, firebaseId, newStatus) => {
  try {
    const itemRef = ref(db, `${nodeName}/${firebaseId}`);
    await update(itemRef, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error(`[Firebase] Erro ao atualizar status:`, error);
    throw error;
  }
};

/**
 * Atualiza campos arbitrários de um registro.
 */
export const updateRecordFirebase = async (nodeName, firebaseId, fieldsToUpdate) => {
  try {
    const itemRef = ref(db, `${nodeName}/${firebaseId}`);
    await update(itemRef, {
      ...fieldsToUpdate,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error(`[Firebase] Erro ao atualizar registro:`, error);
    throw error;
  }
};

/**
 * Remove um registro de um nó.
 */
export const deleteRecordFirebase = async (nodeName, firebaseId) => {
  try {
    const itemRef = ref(db, `${nodeName}/${firebaseId}`);
    await remove(itemRef);
    return { success: true };
  } catch (error) {
    console.error(`[Firebase] Erro ao deletar registro:`, error);
    throw error;
  }
};

/**
 * Remove vários registros de uma vez.
 */
export const deleteMultipleFirebase = async (nodeName, firebaseIds) => {
  try {
    const updates = {};
    firebaseIds.forEach(id => {
      updates[`${nodeName}/${id}`] = null;
    });
    await update(ref(db), updates);
    return { success: true };
  } catch (error) {
    console.error(`[Firebase] Erro ao deletar múltiplos registros:`, error);
    throw error;
  }
};

/**
 * Listener em tempo real para um nó específico (ex: 'prevendas', 'pedidos').
 */
export const listenToNode = (nodeName, callback) => {
  const nodeRef = ref(db, nodeName);
  return onValue(nodeRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const items = data && typeof data === 'object' && !Array.isArray(data)
      ? Object.entries(data).map(([key, val]) => ({ ...val, firebaseId: key }))
      : (Array.isArray(data) ? data.filter(Boolean) : []);
    callback(items.sort((a, b) => new Date(b.createdAt || b.data || 0) - new Date(a.createdAt || a.data || 0)));
  }, (error) => {
    console.error(`[Firebase] Erro no listener de ${nodeName}:`, error);
  });
};

// Exporta o db para uso direto se necessário
export { db, ref, get, set, push, update, remove, onValue };
