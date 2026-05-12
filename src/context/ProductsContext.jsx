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
    if (user && !hasLoaded && !loading) {
      const fetchAllProducts = async () => {
        setLoading(true);
        try {
          // 1. Try to load from IndexedDB Cache first for instant display
          const cached = await get(CACHE_KEY);
          if (cached && cached.length > 0) {
            setProducts(cached);
            setHasLoaded(true);
            setLoading(false); // Stop loading visually, fetch in background if needed
          }

          // 2. Fetch from backend
          const res = await api.getAllProducts();
          const items = Array.isArray(res) ? res : (res?.data || []);
          
          if (items.length > 0) {
            setProducts(items);
            await set(CACHE_KEY, items);
            setHasLoaded(true);
          }
        } catch (error) {
          console.error("Failed to load products cache:", error);
        } finally {
          setLoading(false);
        }
      };
      
      fetchAllProducts();
    }
  }, [user, hasLoaded, loading]);

  const refreshProducts = async () => {
    setLoading(true);
    try {
      const res = await api.getAllProducts();
      const items = Array.isArray(res) ? res : (res?.data || []);
      if (items.length > 0) {
        setProducts(items);
        await set(CACHE_KEY, items);
        setHasLoaded(true);
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
