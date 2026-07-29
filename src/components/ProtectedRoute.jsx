import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermission from '../hooks/usePermission';
import Layout from './Layout';
import { ShieldAlert, Loader2, ArrowLeft } from 'lucide-react';

/**
 * Componente de Proteção de Rotas Dinâmico baseado na Matriz de Permissões.
 * 
 * @param {React.ReactNode} children - Componente/Página a ser renderizada se permitido
 * @param {string} requiredAction - Ação necessária na Matriz de Permissões (ex: 'view_gestao_admin')
 */
export default function ProtectedRoute({ children, requiredAction }) {
  const { user, loading } = useAuth();
  const hasAccess = usePermission(requiredAction);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 text-slate-700 dark:text-slate-200">
        <Loader2 size={36} className="animate-spin text-green-600 mb-3" />
        <p className="font-bold text-sm uppercase tracking-wider">Verificando Credenciais...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredAction && !hasAccess) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[75vh] p-4">
          <div className="bg-white dark:bg-zinc-900 p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 text-center max-w-md w-full animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-800">
              <ShieldAlert size={32} />
            </div>
            
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
              Acesso Negado
            </h2>
            
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium leading-relaxed">
              Você não possui permissão no seu perfil de usuário para acessar este recurso ({requiredAction}).
            </p>

            <button
              onClick={() => window.location.href = '/'}
              className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              Voltar ao Início
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
}
