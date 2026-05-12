import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

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
          const res = await api.searchProducts('');
          setProducts(Array.isArray(res) ? res : (res?.data || []));
          setHasLoaded(true);
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
      const res = await api.searchProducts('');
      setProducts(Array.isArray(res) ? res : (res?.data || []));
      setHasLoaded(true);
    } catch (error) {
      console.error("Failed to refresh products cache:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProductsContext.Provider value={{ products, loading, refreshProducts, hasLoaded }}>
      {children}
    </ProductsContext.Provider>
  );
};
