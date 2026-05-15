import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { get as idbGet, set as idbSet } from 'idb-keyval';

const CACHE_KEY = 'erp_products_cache';
const CACHE_TIME_KEY = 'erp_products_time'; // Para guardar a data da última atualização
const ProductsContext = createContext({});

// URL do GAS (Apps Script) extraída do seu api.js
const GAS_URL = "https://script.google.com/macros/s/AKfycbz7iaKD5YEy3_Q9P5lhIu3IBM1tGsMSqXedttsLAx-JRJwA7R8vIKSn0XRjumC8g33-xg/exec";

// Trava de cache no Firebase (Nó super leve apenas com a data de atualização)
const FIREBASE_SISTEMA_URL = "https://atacadao-ss-default-rtdb.firebaseio.com/sistema.json";

export const useProducts = () => useContext(ProductsContext);

export const ProductsProvider = ({ children }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!user || hasLoaded) return;

    let isMounted = true;
    setLoading(true);

    const safeTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
        setHasLoaded(true);
        console.warn("⚠️ Trava de Segurança MÁXIMA (20s): Forçando liberação da tela.");
      }
    }, 20000);

    const loadData = async () => {
      const getCacheSafe = (key) => new Promise(resolve => {
        let isDone = false;
        const tmr = setTimeout(() => { if (!isDone) { isDone = true; resolve(null); } }, 2000);
        try {
          idbGet(key).then(res => { if (!isDone) { isDone = true; clearTimeout(tmr); resolve(res); } }).catch(() => { if (!isDone) { isDone = true; clearTimeout(tmr); resolve(null); } });
        } catch (e) { if (!isDone) { isDone = true; clearTimeout(tmr); resolve(null); } }
      });

      console.log("📡 1. Lendo cache local...");
      const cachedProducts = await getCacheSafe(CACHE_KEY);
      const cachedTime = await getCacheSafe(CACHE_TIME_KEY) || 0;

      if (!isMounted) return;

      // 2. Verifica a trava de atualização no Firebase
      let serverTime = 0;
      try {
        console.log("🔒 2. Checando trava de atualização no Firebase...");
        const sysRes = await fetch(FIREBASE_SISTEMA_URL);
        if (sysRes.ok) {
          const sysData = await sysRes.json();
          // Pega o tempo do servidor (se não existir, usaremos Date.now() para forçar download)
          serverTime = sysData?.ultimaAtualizacao || Date.now();
        } else {
          serverTime = Date.now(); // Força baixar se a rota falhar
        }
      } catch (e) {
        console.warn("⚠️ Falha ao checar a trava. Se houver cache, ele será usado.");
      }

      // Se temos cache E o cache está atualizado (tempo local >= tempo do servidor)
      if (cachedProducts && cachedProducts.length > 0 && cachedTime >= serverTime) {
        console.log(`✅ 3. Cache ATUALIZADO lido com sucesso: ${cachedProducts.length} itens.`);
        setProducts(cachedProducts);
        setLoading(false);
        setHasLoaded(true);
        clearTimeout(safeTimeout);
        return;
      }

      // Se não tem cache ou a trava indicou que o Google Sheets mudou
      console.log("☁️ 3. Cache desatualizado ou vazio. Baixando direto do GOOGLE SHEETS (GAS)...");
      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 20000);

        // Faz um POST pro Google Apps Script exigindo a ação getProdutos
        const res = await fetch(GAS_URL, {
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: 'getProdutos' }),
          signal: controller.signal
        });
        clearTimeout(fetchTimeout);

        const text = await res.text();
        let data = [];
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error("Resposta inválida do Google Sheets (Provavelmente não retornou o JSON).");
        }

        const items = data && typeof data === 'object' && !Array.isArray(data)
          ? Object.values(data)
          : (Array.isArray(data) ? data.filter(Boolean) : []);

        if (!isMounted) return;

        console.log(`🚀 4. Download do Sheets concluído! ${items.length} itens.`);
        setProducts(items);
        setLoading(false);
        setHasLoaded(true);
        clearTimeout(safeTimeout);

        // Salva os novos produtos e sincroniza a trava local com o tempo do servidor
        try {
          await idbSet(CACHE_KEY, items);
          await idbSet(CACHE_TIME_KEY, serverTime === 0 ? Date.now() : serverTime);
        } catch (e) { }

      } catch (err) {
        console.error("❌ 4. Falha crítica no download do Sheets:", err);
        // Fallback de Emergência: se der erro (ex: offline), libera a tela com o cache velho se ele existir
        if (cachedProducts && cachedProducts.length > 0 && isMounted) {
          console.log("⚠️ Usando cache local como fallback de emergência.");
          setProducts(cachedProducts);
        }
        if (isMounted) {
          setLoading(false);
          setHasLoaded(true);
          clearTimeout(safeTimeout);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      clearTimeout(safeTimeout);
    };
  }, [user, hasLoaded]);

  // Função para forçar o download ignorando a Trava
  const refreshProducts = async () => {
    setLoading(true);
    try {
      console.log("☁️ Forçando atualização manual a partir do GOOGLE SHEETS...");
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(GAS_URL, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: 'getProdutos' }),
        signal: controller.signal
      });
      clearTimeout(fetchTimeout);

      const text = await res.text();
      let data = JSON.parse(text);

      const items = data && typeof data === 'object' && !Array.isArray(data)
        ? Object.values(data)
        : (Array.isArray(data) ? data.filter(Boolean) : []);

      setProducts(items);
      await idbSet(CACHE_KEY, items);
      await idbSet(CACHE_TIME_KEY, Date.now()); // Zera a trava pro momento atual
      console.log("✅ Atualizado manualmente com sucesso.");
    } catch (error) {
      console.error('❌ Erro no refresh:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchLocal = (query) => {
    if (!query) return products;
    const lowerQ = query.toLowerCase();

    return products.filter(p => {
      const cod = p.CODIGO || p.codigo || '';
      const desc = p.DESCRICAO || p.descricao || '';
      const rz = p.RAZAOSOCIAL || p.razaosocial || p.fornecedor || '';

      return (
        cod.toString().toLowerCase().includes(lowerQ) ||
        desc.toString().toLowerCase().includes(lowerQ) ||
        rz.toString().toLowerCase().includes(lowerQ)
      );
    });
  };

  return (
    <ProductsContext.Provider value={{ products, loading, refreshProducts, hasLoaded, searchLocal }}>
      {children}
    </ProductsContext.Provider>
  );
};