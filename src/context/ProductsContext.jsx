import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
import { get, set } from 'idb-keyval';

const CACHE_KEY = 'erp_products_cache';
const ProductsContext = createContext({});

export const useProducts = () => useContext(ProductsContext);

export const ProductsProvider = ({ children }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    // Retiramos o !loading do if para evitar o trigger repetitivo
    if (user && !hasLoaded) {
      const fetchAllProducts = async () => {
        setLoading(true);
        // Definimos hasLoaded como true no início para travar o useEffect e evitar loops
        setHasLoaded(true);

        try {
          // 1. Tentar puxar do IndexedDB primeiro
          const cached = await get(CACHE_KEY);
          if (cached && cached.length > 0) {
            setProducts(cached);
            setLoading(false); // Remove o loading da tela, mas continua a busca em background
          }

          // 2. Buscar do backend no Google Apps Script
          const res = await api.getAllProducts();
          const items = Array.isArray(res) ? res : (res?.data || []);

          if (items.length > 0) {
            setProducts(items);
            await set(CACHE_KEY, items);
          }
        } catch (error) {
          console.error("Failed to load products cache:", error);
          // Se falhar e não tinha cache, você pode querer reverter o hasLoaded
          // para permitir tentar de novo se o usuário atualizar a página
        } finally {
          setLoading(false);
        }
      };

      fetchAllProducts();
    }
  }, [user, hasLoaded]); // <-- Dependência "loading" removida

  const refreshProducts = async () => {
    setLoading(true);
    try {
      const res = await api.getAllProducts();
      const items = Array.isArray(res) ? res : (res?.data || []);
      if (items.length > 0) {
        setProducts(items);
        await set(CACHE_KEY, items);
      }
    } catch (error) {
      console.error("Failed to refresh products cache:", error);
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