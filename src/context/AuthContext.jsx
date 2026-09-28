import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import {
  auth,
  db,
  ref,
  get,
  listenToPermissions,
  savePermissionsToFirebase,
  listenToRoles,
  loginFirebase,
  logoutFirebase,
} from '../lib/firebase';
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
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [customRoles, setCustomRoles] = useState([]);
  const unsubPermsRef = useRef(null);
  const unsubRolesRef = useRef(null);

  // Monitora o estado do Firebase Auth em tempo real
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let resolvedRole = 'vendedor';
        let extraData = {};

        try {
          // A busca da role só acontece após o Firebase Auth confirmar o usuário ativo
          const snapshot = await get(ref(db, 'usuarios'));
          if (snapshot.exists()) {
            const data = snapshot.val();
            const users = data && typeof data === 'object' && !Array.isArray(data)
              ? Object.entries(data).map(([key, val]) => ({ ...val, firebaseId: key }))
              : (Array.isArray(data) ? data.filter(Boolean) : []);

            const found = users.find(u =>
              (u.email && u.email.toLowerCase() === firebaseUser.email?.toLowerCase()) ||
              (u.uid && u.uid === firebaseUser.uid) ||
              (u.usuario && firebaseUser.email && firebaseUser.email.toLowerCase().startsWith(u.usuario.toLowerCase()))
            );

            if (found) {
              resolvedRole = found.role || found.perfil || found.cargo || 'vendedor';
              extraData = found;
            }
          }
        } catch (err) {
          console.warn('[AuthContext] Erro ao buscar perfil no banco (aplicando role padrão):', err);
          resolvedRole = 'vendedor';
        }

        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: extraData.nome || extraData.usuario || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
          usuario: extraData.usuario || firebaseUser.email?.split('@')[0] || 'usuario',
          role: resolvedRole,
          firebaseId: extraData.firebaseId || firebaseUser.uid,
          ...extraData,
        };

        setCurrentUser(userData);
        setUserRole(resolvedRole);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('role', resolvedRole);
      } else {
        setCurrentUser(null);
        setUserRole(null);
        localStorage.removeItem('user');
        localStorage.removeItem('role');
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listeners em tempo real para permissões do Firebase SOMENTE com usuário autenticado
  useEffect(() => {
    if (!currentUser) {
      if (unsubPermsRef.current) {
        unsubPermsRef.current();
        unsubPermsRef.current = null;
      }
      if (unsubRolesRef.current) {
        unsubRolesRef.current();
        unsubRolesRef.current = null;
      }
      return;
    }

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
  }, [currentUser?.uid]);

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
    try {
      await logoutFirebase();
    } catch (err) {
      console.error('[AuthContext] Erro ao deslogar:', err);
    } finally {
      setCurrentUser(null);
      setUserRole(null);
      localStorage.removeItem('user');
      localStorage.removeItem('role');
    }
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
