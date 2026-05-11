import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Package2, Loader2, User, Lock, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      await login(username, password);
      navigate('/');
    } catch (error) {
      console.error(error);
      setErrorMsg('Acesso Negado: Verifique suas credenciais de segurança.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#0a0a0a] px-4 overflow-hidden relative">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -mr-64 -mt-64" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -ml-64 -mb-64" />

      <div className="max-w-md w-full relative">
        <div className="bg-card p-10 rounded-[2.5rem] shadow-2xl border-4 border-white dark:border-zinc-900 transition-all">
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-primary rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-primary/20 transform rotate-3">
              <Package2 size={40} className="text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase italic">
              Smart<span className="text-primary">Stock</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <ShieldCheck size={14} className="text-muted-foreground" />
              <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-[0.3em]">Portal Corporativo v1.0</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMsg && (
              <div className="p-4 bg-destructive/10 border-2 border-destructive/20 rounded-2xl text-destructive text-xs font-black uppercase tracking-widest text-center animate-in shake">
                {errorMsg}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Identificação do Usuário</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <User size={20} />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-border bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold transition-all"
                  placeholder="Seu usuário corporativo"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Chave de Acesso</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  required
                  className="block w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-border bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:opacity-90 font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-70 mt-4 shadow-xl shadow-primary/20 transform active:scale-95 uppercase tracking-widest text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-border flex flex-col items-center gap-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">
              Acesso restrito a colaboradores autorizados
            </p>
            <div className="flex gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-primary/40 rounded-full" />
              <div className="w-2 h-2 bg-primary/10 rounded-full" />
            </div>
          </div>
        </div>
        
        <p className="mt-8 text-center text-muted-foreground/40 font-black text-[8px] uppercase tracking-[0.5em]">
          &copy; 2026 SmartStock Logistics Division
        </p>
      </div>
    </div>
  );
}
