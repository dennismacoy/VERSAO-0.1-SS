import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import {
  listenToPermissions,
  savePermissionsToFirebase,
  listenToRoles,
  loginFirebase,
} from '../lib/firebase';
import { hasRolePermission } from '../lib/permissions';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

const defaultPermissions = {
  // Pages
  'Acesso Dashboard': ['admin', 'gerente', 'vendedor', 'repositor', 'promotor', 'operador'],
  'Acesso Consulta': ['admin', 'gerente', 'repositor', 'vendedor', 'promotor', 'operador', 'clientes'],
  'view_consulta': ['admin', 'gerente', 'repositor', 'vendedor', 'promotor', 'operador', 'clientes'],
  'allow_sheets_sync': ['admin', 'gerente', 'repositor', 'vendedor', 'promotor', 'operador', 'clientes'],
  'Acesso Pedidos': ['clientes', 'admin', 'gerente', 'vendedor'],
  'Acesso Requisições': ['admin', 'gerente', 'vendedor'],
  'Acesso Pre-Venda': ['admin', 'gerente', 'vendedor'],
  'Acesso Separacao': ['admin', 'gerente', 'repositor'],
  'Acesso Gestao Administrativa': ['admin', 'gerente', 'vendedor', 'repositor'],
  'gestao_administrativa': ['admin', 'gerente', 'vendedor', 'repositor'],
  'Acesso Relatorios': ['admin', 'gerente', 'vendedor'],
  'Acesso Configuracoes': ['admin', 'gerente', 'repositor', 'vendedor', 'clientes'],
  'Acesso Telefones': ['admin', 'gerente', 'repositor', 'vendedor', 'promotor', 'operador'],
  'Acessar Sincronização Master': ['admin'],

  // Dashboard Cards
  'Ver Separacoes Abertas': ['admin', 'gerente', 'repositor'],
  'Ver Requisicoes Pendentes': ['admin', 'gerente'],
  'Ver Itens ISV': ['admin', 'gerente', 'vendedor'],
  'Ver Itens Idade': ['admin', 'gerente', 'vendedor'],
  'Ver Total Paletes': ['admin', 'gerente', 'repositor'],
  'Ver Valor Estoque': ['admin', 'gerente'],

  // Consulta Details (Bottom Sheet)
  'Ver Card Geral': ['admin', 'gerente', 'vendedor', 'repositor', 'promotor', 'operador', 'clientes'],
  'Ver Card Extras': ['admin', 'gerente'],

  // Botoes
  'Botao Enviar WPP': ['admin', 'gerente', 'vendedor'],
  'Botao Ligar Comprador': ['admin', 'gerente'],
  'Botao Gerar PDF': ['admin', 'gerente', 'vendedor'],
  'Criar Prevenda': ['admin', 'gerente', 'vendedor'],
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [customRoles, setCustomRoles] = useState([]);
  const unsubPermsRef = useRef(null);
  const unsubRolesRef = useRef(null);

  // Inicializa o estado de autenticação a partir do localStorage
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      const savedRole = localStorage.getItem('role');
      if (savedUser && savedRole) {
        setCurrentUser(JSON.parse(savedUser));
        setUserRole(savedRole);
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
    } catch (err) {
      console.warn('[AuthContext] Erro ao ler usuário do localStorage:', err);
      setCurrentUser(null);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Listeners em tempo real para permissões e roles dinâmicas do Firebase
  useEffect(() => {
    try {
      unsubPermsRef.current = listenToPermissions((fbPerms) => {
        if (fbPerms && typeof fbPerms === 'object') {
          const { updatedAt, ...cleanPerms } = fbPerms;
          if (Object.keys(cleanPerms).length > 0) {
            setPermissions(prev => ({ ...defaultPermissions, ...prev, ...cleanPerms }));
          }
        }
      });
    } catch (e) {
      console.warn('[AuthContext] Falha ao iniciar listener de permissões:', e);
    }

    try {
      unsubRolesRef.current = listenToRoles((rolesData) => {
        if (Array.isArray(rolesData)) {
          setCustomRoles(rolesData);
          const roleMatrix = {};
          rolesData.forEach(r => {
            if (r.id && Array.isArray(r.permissions)) {
              roleMatrix[r.id] = r.permissions;
            }
          });
          setPermissions(prev => ({ ...prev, ...roleMatrix }));
        }
      });
    } catch (e) {
      console.warn('[AuthContext] Falha ao iniciar listener de roles:', e);
    }

    return () => {
      if (unsubPermsRef.current) unsubPermsRef.current();
      if (unsubRolesRef.current) unsubRolesRef.current();
    };
  }, []);

  const login = async (emailOrUsername, password) => {
    const res = await loginFirebase(emailOrUsername, password);
    if (res && res.success) {
      setCurrentUser(res.user);
      setUserRole(res.role);
      localStorage.setItem('user', JSON.stringify(res.user));
      localStorage.setItem('role', res.role);
      return res;
    } else {
      throw new Error(res?.message || 'Credenciais inválidas.');
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    setUserRole(null);
    localStorage.removeItem('user');
    localStorage.removeItem('role');
  };

  const hasPermission = React.useCallback((actionName) => {
    return hasRolePermission(userRole, actionName, permissions);
  }, [userRole, permissions]);

  const isAdmin = React.useCallback(() => {
    return hasRolePermission(userRole, 'view_configuracoes', permissions);
  }, [userRole, permissions]);

  const updatePermissions = React.useCallback(async (newPermissions) => {
    setPermissions(newPermissions);
    try {
      await savePermissionsToFirebase(newPermissions);
    } catch (e) {
      console.error('Erro ao salvar permissões no Firebase:', e);
    }
  }, []);

  const contextValue = React.useMemo(() => ({
    user: currentUser,
    currentUser,
    role: userRole,
    userRole,
    login,
    logout,
    loading,
    permissions,
    customRoles,
    hasPermission,
    updatePermissions,
    isAdmin
  }), [currentUser, userRole, loading, permissions, customRoles, hasPermission, updatePermissions, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 text-slate-700 dark:text-slate-200">
        <Loader2 size={36} className="animate-spin text-green-600 mb-3" />
        <p className="font-bold text-sm uppercase tracking-wider">Verificando Autenticação...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
