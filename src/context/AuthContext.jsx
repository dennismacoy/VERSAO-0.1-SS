import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { listenToPermissions, fetchPermissionsFromFirebase, savePermissionsToFirebase } from '../lib/firebase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

const defaultPermissions = {
  // Pages
  'Acesso Dashboard': ['admin', 'gerente', 'vendedor'],
  'Acesso Consulta': ['admin', 'gerente', 'repositor', 'vendedor'],
  'Acesso Pedidos': ['clientes'],
  'Acesso Requisições': ['admin', 'gerente'],
  'Acesso Pre-Venda': ['admin', 'gerente', 'vendedor'],
  'Acesso Separacao': ['admin', 'gerente', 'repositor'],
  'Acesso Relatorios': ['admin', 'gerente'],
  'Acesso Configuracoes': ['admin', 'gerente', 'repositor', 'vendedor', 'clientes'],

  // Dashboard Cards
  'Ver Separacoes Abertas': ['admin', 'gerente', 'repositor'],
  'Ver Requisicoes Pendentes': ['admin', 'gerente'],
  'Ver Itens ISV': ['admin', 'gerente'],
  'Ver Itens Idade': ['admin', 'gerente'],
  'Ver Total Paletes': ['admin', 'gerente', 'repositor'],
  'Ver Valor Estoque': ['admin', 'gerente'],

  // Consulta Details (Bottom Sheet)
  'Ver Card Geral': ['admin', 'gerente', 'vendedor', 'repositor'],
  'Ver Card Extras': ['admin', 'gerente'],

  // Botoes
  'Botao Enviar WPP': ['admin', 'gerente', 'vendedor'],
  'Botao Ligar Comprador': ['admin', 'gerente'],
  'Botao Gerar PDF': ['admin', 'gerente', 'vendedor'],
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(defaultPermissions);
  const unsubPermsRef = useRef(null);

  // Listener em tempo real para permissões do Firebase
  useEffect(() => {
    unsubPermsRef.current = listenToPermissions((fbPerms) => {
      if (fbPerms && typeof fbPerms === 'object') {
        // Remove a chave interna 'updatedAt' para não poluir a matriz
        const { updatedAt, ...cleanPerms } = fbPerms;
        if (Object.keys(cleanPerms).length > 0) {
          setPermissions(cleanPerms);
        }
      }
    });

    return () => {
      if (unsubPermsRef.current) unsubPermsRef.current();
    };
  }, []);

  const login = async (username, password) => {
    try {
      const response = await api.login(username, password);

      let userRole = '';
      let userData = null;

      if (response && response.success === true) {
        userRole = response.role || 'vendedor';
        userData = response.user || { name: username };
      } else {
        throw new Error(response?.message || "Credenciais inválidas.");
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

  const hasPermission = React.useCallback((actionName) => {
    // Admin sempre tem acesso total
    const currentRole = (role || '').toLowerCase();
    if (currentRole === 'admin') return true;

    const allowedRoles = permissions[actionName] || [];
    return allowedRoles.some(r => r.toLowerCase() === currentRole);
  }, [role, permissions]);

  const isAdmin = React.useCallback(() => {
    return (role || '').toLowerCase() === 'admin';
  }, [role]);

  const updatePermissions = React.useCallback(async (newPermissions) => {
    setPermissions(newPermissions);
    try {
      await savePermissionsToFirebase(newPermissions);
    } catch (e) {
      console.error('Erro ao salvar permissões no Firebase:', e);
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedRole = localStorage.getItem('role');
    if (savedUser && savedRole) {
      setUser(JSON.parse(savedUser));
      setRole(savedRole);
    }
    setLoading(false);
  }, []);

  const contextValue = React.useMemo(() => ({
    user, role, login, logout, loading, permissions, hasPermission, updatePermissions, isAdmin
  }), [user, role, loading, permissions, hasPermission, updatePermissions, isAdmin]);

  return (
    <AuthContext.Provider value={contextValue}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
