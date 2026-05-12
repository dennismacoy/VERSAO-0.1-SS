import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { listenToProducts, fetchProductsFromFirebase } from '../lib/firebase';

const CACHE_KEY = 'erp_products_cache';
const ProductsContext = createContext({});

export const useProducts = () => useContext(ProductsContext);

export const ProductsProvider = ({ children }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (user && !hasLoaded) {
      setLoading(true);
      setHasLoaded(true);

      console.log("📡 1. Verificando Memória Local (Cache)...");

      // Envolvemos o IDB em uma função segura para não travar Abas Anônimas
      const checkCache = async () => {
        try {
          const cached = await idbGet(CACHE_KEY);
          if (cached && cached.length > 0) {
            console.log(`✅ 2. Cache encontrado! Carregando ${cached.length} itens instantaneamente.`);
            setProducts(cached);
            setLoading(false); // Já tem dados, libera a tela!
          } else {
            console.log("⚠️ 2. Cache VAZIO (ou Aba Anônima). O sistema vai baixar os dados do servidor.");
          }
        } catch (err) {
          console.warn("🚫 Aviso: O navegador bloqueou o Cache Local. O download será feito direto da nuvem.", err);
        }
      };

      checkCache();

      console.log("☁️ 3. Conectando ao Firebase para Sincronização. Aguarde o download (pode demorar no celular)...");

      unsubscribeRef.current = listenToProducts(async (items) => {
        console.log(`🚀 4. Download Concluído! O Firebase entregou ${items ? items.length : 0} produtos.`);

        if (items && items.length > 0) {
          setProducts(items);

          try {
            await idbSet(CACHE_KEY, items);
            console.log("💾 5. Dados salvos no Cache Local com sucesso para o próximo acesso rápido.");
          } catch (err) {
            console.warn("🚫 Aviso: Impossível salvar no Cache. O usuário provavelmente está em Modo Anônimo ou sem espaço.", err);
          }
        }

        // Remove a tela de carregamento independentemente do que aconteça
        setLoading(false);
      });
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, hasLoaded]);

  const refreshProducts = async () => {
    setLoading(true);
    try {
      const items = await fetchProductsFromFirebase();
      if (items.length > 0) {
        setProducts(items);
        await idbSet(CACHE_KEY, items);
      }
    } catch (error) {
      console.error('[Firebase] Erro ao atualizar produtos:', error);
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