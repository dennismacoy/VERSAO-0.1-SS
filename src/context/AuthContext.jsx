import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

const defaultPermissions = {
  // Pages
  'Acesso Consulta': ['Gerente', 'Lider', 'Colaborador', 'Tercerizado', 'Repositor'],
  'Acesso Pre-Venda': ['Gerente', 'Lider', 'Colaborador'],
  'Acesso Separacao': ['Gerente', 'Lider', 'Colaborador', 'Tercerizado', 'Repositor'],
  'Acesso Relatorios': ['Gerente'],
  // Info
  'Ver Preço de Custo': ['Gerente'],
  'Ver Margem': ['Gerente'],
  'Ver Telefone do Comprador': ['Gerente', 'Lider'],
  // Buttons
  'Botão Finalizar Venda': ['Gerente', 'Lider', 'Colaborador'],
  'Botão Gerar PDF': ['Gerente', 'Lider', 'Colaborador'],
  'Botão Excluir Histórico': ['Gerente'],
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
      
      if (response && response.success === true) {
        userRole = response.role || 'Admin';
        
        // Force exact "Admin" capitalization to match permissions matrix
        if (userRole.toLowerCase() === 'admin') {
          userRole = 'Admin';
        }
        
        userData = response.user || { name: username };
      } else {
        throw new Error(response?.message || "Credenciais inválidas ou erro na API");
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
    if (user?.role && user.role.toLowerCase() === 'admin') return true;
    if (role && role.toLowerCase() === 'admin') return true; // Fallback
    
    const allowedRoles = permissions[actionName] || [];
    return allowedRoles.includes(role);
  }, [user, role, permissions]);

  const updatePermissions = React.useCallback((newPermissions) => {
    setPermissions(newPermissions);
    localStorage.setItem('permissions_matrix', JSON.stringify(newPermissions));
  }, []);

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

  const contextValue = React.useMemo(() => ({
    user, role, login, logout, loading, permissions, hasPermission, updatePermissions
  }), [user, role, loading, permissions, hasPermission, updatePermissions]);

  return (
    <AuthContext.Provider value={contextValue}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
