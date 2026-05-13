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
      setErrorMsg(error?.message || 'Acesso Negado: Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#0a0a0a] px-4 overflow-hidden relative">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px] -mr-48 -mt-48" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] -ml-48 -mb-48" />

      <div className="max-w-xs w-full relative">
        <div className="bg-card p-6 rounded-2xl shadow-xl border border-border transition-all">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-primary/20 transform rotate-3">
              <Package2 size={24} className="text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-black text-foreground tracking-tighter uppercase italic">
              Smart<span className="text-primary">Stock</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-1.5">
              <ShieldCheck size={10} className="text-muted-foreground" />
              <p className="text-muted-foreground font-bold text-[8px] uppercase tracking-[0.2em]">Acesso Seguro</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-[10px] font-black uppercase tracking-widest text-center animate-in shake">
                {errorMsg}
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Usuário</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <User size={16} />
                </div>
                {/* font-size 16px (text-base) impede zoom automático no mobile */}
                <input
                  type="text"
                  required
                  className="block w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold transition-all text-base min-h-[44px]"
                  placeholder="Seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Senha</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  required
                  className="block w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold transition-all text-base min-h-[44px]"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:opacity-90 font-black py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-2 shadow-lg shadow-primary/20 transform active:scale-95 uppercase tracking-widest text-xs min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border flex flex-col items-center gap-2">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center">
              Acesso restrito a colaboradores autorizados
            </p>
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
              <div className="w-1.5 h-1.5 bg-primary/10 rounded-full" />
            </div>
          </div>
        </div>
        
        <p className="mt-6 text-center text-muted-foreground/40 font-black text-[7px] uppercase tracking-[0.4em]">
          &copy; 2026 SmartStock Logistics
        </p>
      </div>
    </div>
  );
}
