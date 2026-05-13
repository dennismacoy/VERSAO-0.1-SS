import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { get as idbGet, set as idbSet } from 'idb-keyval';

const CACHE_KEY = 'erp_products_cache';
const ProductsContext = createContext({});

const FIREBASE_REST_URL = "https://atacadao-ss-default-rtdb.firebaseio.com/baseProdutos.json";

// Função para evitar que o Cache trave a tela infinitamente
const fetchWithTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout do Navegador')), ms))
  ]);
};

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
    setHasLoaded(true);

    // TRAVA ABSOLUTA: Destrava a tela em 10 segundos, haja o que houver.
    const safeTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
        console.warn("⚠️ Trava de Segurança: Forçando a liberação da tela.");
      }
    }, 10000);

    const loadData = async () => {
      let hasCache = false;

      // 1. TENTA O CACHE COM LIMITE DE 2 SEGUNDOS (Evita o congelamento do Safari/Anônimo)
      try {
        console.log("📡 1. Lendo cache local...");
        const cached = await fetchWithTimeout(idbGet(CACHE_KEY), 2000);

        if (cached && cached.length > 0 && isMounted) {
          setProducts(cached);
          setLoading(false);
          clearTimeout(safeTimeout);
          hasCache = true;
          console.log(`✅ Cache lido com sucesso: ${cached.length} itens.`);
        }
      } catch (err) {
        console.warn("🚫 Cache vazio ou bloqueado. Pulando para o Servidor.");
      }

      // 2. SE NÃO TEM CACHE, FAZ O DOWNLOAD DA REST API
      if (!hasCache && isMounted) {
        try {
          console.log("☁️ 2. Baixando do Firebase (REST API)...");
          const res = await fetch(FIREBASE_REST_URL);

          if (!res.ok) throw new Error("Erro na URL do Firebase.");

          const data = await res.json();
          const items = data && typeof data === 'object' && !Array.isArray(data)
            ? Object.values(data)
            : (Array.isArray(data) ? data.filter(Boolean) : []);

          if (isMounted) {
            setProducts(items);
            setLoading(false);
            clearTimeout(safeTimeout);
            console.log(`🚀 Download concluído! ${items.length} itens.`);
          }

          try { await idbSet(CACHE_KEY, items); } catch (e) { }

        } catch (err) {
          console.error("❌ Falha crítica no download:", err);
          if (isMounted) {
            setLoading(false);
            clearTimeout(safeTimeout);
          }
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      clearTimeout(safeTimeout);
    };
  }, [user, hasLoaded]);

  const refreshProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(FIREBASE_REST_URL);
      const data = await res.json();
      const items = data && typeof data === 'object' && !Array.isArray(data)
        ? Object.values(data)
        : (Array.isArray(data) ? data.filter(Boolean) : []);

      setProducts(items);
      await idbSet(CACHE_KEY, items);
      console.log("✅ Atualizado com sucesso.");
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