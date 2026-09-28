import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermission from '../hooks/usePermission';
import Layout from './Layout';
import SemAcesso from '../pages/SemAcesso';
import { Loader2 } from 'lucide-react';

/**
 * Componente de Proteção de Rotas Dinâmico baseado na Matriz de Permissões.
 * 
 * @param {React.ReactNode} children - Componente/Página a ser renderizada se permitido
 * @param {string} requiredAction - Ação necessária na Matriz de Permissões (ex: 'view_gestao_admin')
 */
export default function ProtectedRoute({ children, requiredAction }) {
  const { user, currentUser, loading } = useAuth();
  const activeUser = user || currentUser;
  const hasAccess = usePermission(requiredAction);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 text-slate-700 dark:text-slate-200">
        <Loader2 size={36} className="animate-spin text-green-600 mb-3" />
        <p className="font-bold text-sm uppercase tracking-wider">Verificando Credenciais...</p>
      </div>
    );
  }

  if (!activeUser) {
    return <Navigate to="/login" replace />;
  }

  if (requiredAction && !hasAccess) {
    return <SemAcesso requiredAction={requiredAction} />;
  }

  return <Layout>{children}</Layout>;
}
