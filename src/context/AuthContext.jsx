import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
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
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [customRoles, setCustomRoles] = useState([]);
  const unsubPermsRef = useRef(null);
  const unsubRolesRef = useRef(null);

  // Monitora imediatamente as alterações no estado do Firebase Auth
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let userRole = 'admin';
        let extraData = {};

        try {
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
              userRole = found.role || found.perfil || found.cargo || 'admin';
              extraData = found;
            }
          }
        } catch (err) {
          console.warn('[AuthContext] Erro ao carregar dados do perfil do RTDB:', err);
        }

        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: extraData.nome || extraData.usuario || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
          usuario: extraData.usuario || firebaseUser.email?.split('@')[0] || 'usuario',
          role: userRole,
          firebaseId: extraData.firebaseId || firebaseUser.uid,
          ...extraData,
        };

        setUser(userData);
        setRole(userRole);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('role', userRole);
      } else {
        setUser(null);
        setRole(null);
        localStorage.removeItem('user');
        localStorage.removeItem('role');
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listener em tempo real para permissões do Firebase
  useEffect(() => {
    unsubPermsRef.current = listenToPermissions((fbPerms) => {
      if (fbPerms && typeof fbPerms === 'object') {
        const { updatedAt, ...cleanPerms } = fbPerms;
        if (Object.keys(cleanPerms).length > 0) {
          setPermissions(prev => ({ ...defaultPermissions, ...prev, ...cleanPerms }));
        }
      }
    });

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

    return () => {
      if (unsubPermsRef.current) unsubPermsRef.current();
      if (unsubRolesRef.current) unsubRolesRef.current();
    };
  }, []);

  const login = async (emailOrUsername, password) => {
    const res = await loginFirebase(emailOrUsername, password);
    if (res && res.success) {
      setUser(res.user);
      setRole(res.role);
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
      setUser(null);
      setRole(null);
      localStorage.removeItem('user');
      localStorage.removeItem('role');
    }
  };

  const hasPermission = React.useCallback((actionName) => {
    return hasRolePermission(role, actionName, permissions);
  }, [role, permissions]);

  // isAdmin derivado exclusivamente da verificação dinâmica da permissão de configurações
  const isAdmin = React.useCallback(() => {
    return hasRolePermission(role, 'view_configuracoes', permissions);
  }, [role, permissions]);

  const updatePermissions = React.useCallback(async (newPermissions) => {
    setPermissions(newPermissions);
    try {
      await savePermissionsToFirebase(newPermissions);
    } catch (e) {
      console.error('Erro ao salvar permissões no Firebase:', e);
    }
  }, []);

  const contextValue = React.useMemo(() => ({
    user,
    currentUser: user,
    role,
    login,
    logout,
    loading,
    permissions,
    customRoles,
    hasPermission,
    updatePermissions,
    isAdmin
  }), [user, role, loading, permissions, customRoles, hasPermission, updatePermissions, isAdmin]);

  return (
    <AuthContext.Provider value={contextValue}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
