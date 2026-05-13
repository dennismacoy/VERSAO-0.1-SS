import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { get as idbGet, set as idbSet } from 'idb-keyval';

const CACHE_KEY = 'erp_products_cache';
const ProductsContext = createContext({});

const FIREBASE_REST_URL = "https://atacadao-ss-default-rtdb.firebaseio.com/baseProdutos.json";

export const useProducts = () => useContext(ProductsContext);

export const ProductsProvider = ({ children }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    // Se o usuário não está logado ou já carregou, não faz nada
    if (!user || hasLoaded) return;

    let isMounted = true;
    setLoading(true);

    // TRAVA ABSOLUTA MÁXIMA: 12 segundos. Destrava a tela haja o que houver.
    const safeTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
        setHasLoaded(true);
        console.warn("⚠️ Trava de Segurança MÁXIMA: Forçando liberação da tela.");
      }
    }, 12000);

    const loadData = async () => {

      // 1. FUNÇÃO BLINDADA DE LEITURA DO CACHE (Máximo 1.5 segundos)
      const getCacheSafe = () => new Promise(resolve => {
        let isDone = false;
        const tmr = setTimeout(() => {
          if (!isDone) { isDone = true; resolve(null); }
        }, 1500);

        try {
          idbGet(CACHE_KEY).then(res => {
            if (!isDone) { isDone = true; clearTimeout(tmr); resolve(res); }
          }).catch(() => {
            if (!isDone) { isDone = true; clearTimeout(tmr); resolve(null); }
          });
        } catch (e) {
          if (!isDone) { isDone = true; clearTimeout(tmr); resolve(null); }
        }
      });

      console.log("📡 1. Lendo cache local (Aguardando max 1.5s)...");
      const cached = await getCacheSafe();

      if (!isMounted) return; // Previne o erro do React Strict Mode

      // SE ACHOU O CACHE
      if (cached && cached.length > 0) {
        console.log(`✅ 2. Cache lido com sucesso: ${cached.length} itens.`);
        setProducts(cached);
        setLoading(false);
        setHasLoaded(true);
        clearTimeout(safeTimeout);
        return; // PARA A EXECUÇÃO AQUI!
      }

      // SE NÃO ACHOU O CACHE (Cai direto pro Firebase)
      console.log("☁️ 2. Cache Vazio. Baixando do Firebase (REST API)...");
      try {
        const res = await fetch(FIREBASE_REST_URL);
        if (!res.ok) throw new Error("Erro na URL do Firebase.");

        const data = await res.json();
        const items = data && typeof data === 'object' && !Array.isArray(data)
          ? Object.values(data)
          : (Array.isArray(data) ? data.filter(Boolean) : []);

        if (!isMounted) return;

        console.log(`🚀 3. Download concluído! ${items.length} itens.`);
        setProducts(items);
        setLoading(false);
        setHasLoaded(true);
        clearTimeout(safeTimeout);

        // Salva silenciosamente pro futuro
        try { await idbSet(CACHE_KEY, items); } catch (e) { }

      } catch (err) {
        console.error("❌ 3. Falha crítica no download:", err);
        if (isMounted) {
          setLoading(false);
          setHasLoaded(true);
          clearTimeout(safeTimeout);
        }
      }
    };

    loadData();

    // Limpeza ao desmontar
    return () => {
      isMounted = false;
      clearTimeout(safeTimeout);
    };
  }, [user, hasLoaded]); // Dependências corrigidas!

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