import React from 'react';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

export default function SemAcesso() {
  const { user, role, logout } = useAuth();

  return (
    <Layout>
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-8 md:p-12 rounded-3xl shadow-xl max-w-md w-full space-y-6 animate-in fade-in zoom-in duration-200">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert size={32} />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Nenhuma Página Liberada
            </h2>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Sua conta com o perfil <span className="font-extrabold uppercase text-rose-600 dark:text-rose-400">"{role || 'Indefinido'}"</span> não possui permissão de visualização para nenhuma página no momento.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 rounded-xl text-left border border-slate-200 dark:border-zinc-700 text-xs space-y-1">
            <p className="font-bold text-slate-700 dark:text-slate-300">O que fazer agora?</p>
            <p className="text-slate-500 dark:text-slate-400">
              Entre em contato com o Administrador do sistema para atualizar as permissões do seu perfil na Matriz de Permissões.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw size={14} />
              Tentar Novamente
            </button>
            <button
              onClick={logout}
              className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
