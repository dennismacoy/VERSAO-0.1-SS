import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { listenToPermissions, fetchPermissionsFromFirebase, savePermissionsToFirebase, listenToRoles } from '../lib/firebase';
import { hasRolePermission } from '../lib/permissions';

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
  'Acesso Gestao Administrativa': ['admin', 'gerente', 'vendedor', 'repositor'],
  'gestao_administrativa': ['admin', 'gerente', 'vendedor', 'repositor'],
  'Acesso Relatorios': ['admin', 'gerente'],
  'Acesso Configuracoes': ['admin', 'gerente', 'repositor', 'vendedor', 'clientes'],
  'Acessar Sincronização Master': ['admin'],

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
  'Criar Prevenda': ['admin', 'gerente', 'vendedor'],
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [customRoles, setCustomRoles] = useState([]);
  const unsubPermsRef = useRef(null);
  const unsubRolesRef = useRef(null);

  // Listener em tempo real para permissões do Firebase
  useEffect(() => {
    unsubPermsRef.current = listenToPermissions((fbPerms) => {
      if (fbPerms && typeof fbPerms === 'object') {
        const { updatedAt, ...cleanPerms } = fbPerms;
        if (Object.keys(cleanPerms).length > 0) {
          setPermissions(prev => ({ ...defaultPermissions, ...cleanPerms, ...prev }));
        }
      }
    });

    unsubRolesRef.current = listenToRoles((rolesData) => {
      if (Array.isArray(rolesData)) {
        setCustomRoles(rolesData);
        // Transforma o formato { id, name, permissions } em entradas para a matriz
        const roleMatrix = {};
        rolesData.forEach(r => {
          if (r.id && Array.isArray(r.permissions)) {
            roleMatrix[r.id] = r.permissions;
          }
        });
        setPermissions(prev => ({ ...prev, ...roleMatrix }));
      }
    });

    return () => {
      if (unsubPermsRef.current) unsubPermsRef.current();
      if (unsubRolesRef.current) unsubRolesRef.current();
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
    return hasRolePermission(role, actionName, permissions);
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
    user, role, login, logout, loading, permissions, customRoles, hasPermission, updatePermissions, isAdmin
  }), [user, role, loading, permissions, customRoles, hasPermission, updatePermissions, isAdmin]);

  return (
    <AuthContext.Provider value={contextValue}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
