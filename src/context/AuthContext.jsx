import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

const defaultPermissions = {
  'Ver Preço de Custo': ['Admin', 'Gerente'],
  'Acionar WhatsApp': ['Admin', 'Gerente', 'Lider', 'Colaborador'],
  'Ver Aba Relatórios': ['Admin', 'Gerente'],
  'Ver Aba Separação': ['Admin', 'Gerente', 'Lider', 'Colaborador', 'Repositor'],
  'Ver Histórico de Vendas': ['Admin', 'Gerente', 'Lider'],
  'Gerar PDF Pré-Venda': ['Admin', 'Gerente', 'Lider', 'Colaborador'],
  'Botão Gerar PDF': ['Admin', 'Gerente', 'Lider', 'Colaborador'],
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(defaultPermissions);

  const login = async (username, password) => {
    try {
      const response = await api.login(username, password);
      
      let userRole = '';
      let userData = null;
      
      if (response && response.success) {
        userRole = response.role;
        userData = response.user;
      } else {
        throw new Error("Credenciais inválidas ou erro na API");
      }

      setUser(userData);
      setRole(userRole);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('role', userRole);
      return true;
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const logout = async () => {
    setUser(null);
    setRole(null);
    localStorage.removeItem('user');
    localStorage.removeItem('role');
  };

  const hasPermission = (actionName) => {
    if (role && role.toLowerCase() === 'admin') return true; // Admin always has full access
    const allowedRoles = permissions[actionName] || [];
    return allowedRoles.includes(role);
  };

  const updatePermissions = (newPermissions) => {
    setPermissions(newPermissions);
    localStorage.setItem('permissions_matrix', JSON.stringify(newPermissions));
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedRole = localStorage.getItem('role');
    if (savedUser && savedRole) {
      setUser(JSON.parse(savedUser));
      setRole(savedRole);
    }

    const savedPerms = localStorage.getItem('permissions_matrix');
    if (savedPerms) {
      setPermissions(JSON.parse(savedPerms));
    }
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, login, logout, loading, permissions, hasPermission, updatePermissions }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
