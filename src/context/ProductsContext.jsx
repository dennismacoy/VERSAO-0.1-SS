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

      // 1. Carregar cache do IndexedDB para exibição instantânea
      idbGet(CACHE_KEY).then(cached => {
        if (cached && cached.length > 0) {
          setProducts(cached);
          setLoading(false); // Remove loading visual, Firebase sincroniza em background
        }
      }).catch(err => console.error('[IDB] Erro ao ler cache:', err));

      // 2. Listener em tempo real do Firebase Realtime Database
      // Substitui completamente o antigo api.getAllProducts() via Google Apps Script
      unsubscribeRef.current = listenToProducts(async (items) => {
        if (items && items.length > 0) {
          setProducts(items);
          // Atualiza o cache do IndexedDB com os dados frescos do Firebase
          try {
            await idbSet(CACHE_KEY, items);
          } catch (err) {
            console.error('[IDB] Erro ao salvar cache:', err);
          }
        }
        setLoading(false);
      });
    }

    // Cleanup: desconecta o listener ao desmontar ou logout
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, hasLoaded]);

  // Refresh manual: busca uma vez do Firebase (sem listener)
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
    return products.filter(p =>
      (p.CODIGO && p.CODIGO.toString().includes(lowerQ)) ||
      (p.DESCRICAO && p.DESCRICAO.toLowerCase().includes(lowerQ))
    );
  };

  return (
    <ProductsContext.Provider value={{ products, loading, refreshProducts, hasLoaded, searchLocal }}>
      {children}
    </ProductsContext.Provider>
  );
};