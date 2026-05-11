import React, { useState, useCallback } from 'react';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  Settings2,
  Lock,
  Eye,
  FileText,
  Trash2,
  PhoneCall,
  UserPlus
} from 'lucide-react';
import Papa from 'papaparse';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export default function Configuracoes() {
  const { role, permissions, updatePermissions } = useAuth();
  
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [targetBase, setTargetBase] = useState('smg13');
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const rolesAvailable = ['Gerente', 'Lider', 'Colaborador', 'Tercerizado', 'Repositor'];
  
  const actionsList = [
    { id: 'Ver Preço de Custo', icon: Eye, label: 'Visualizar Preço de Custo' },
    { id: 'Ver Margem', icon: TrendingUp, label: 'Visualizar Margem de Lucro' },
    { id: 'Acionar WhatsApp', icon: PhoneCall, label: 'Acionar WhatsApp Comprador' },
    { id: 'Ver Aba Relatórios', icon: FileText, label: 'Acesso à Aba de Relatórios' },
    { id: 'Ver Aba Separação', icon: Package, label: 'Acesso à Aba de Separação' },
    { id: 'Ver Histórico de Vendas', icon: History, label: 'Ver Histórico de Vendas' },
    { id: 'Gerar PDF Pré-Venda', icon: FileText, label: 'Gerar PDF de Pré-Venda' },
    { id: 'Botão Gerar PDF', icon: Download, label: 'Botão Gerar PDF (Geral)' },
    { id: 'Botão Excluir Histórico', icon: Trash2, label: 'Excluir Registros de Histórico' },
    { id: 'Ver Telefone do Comprador', icon: PhoneCall, label: 'Visualizar Telefone do Comprador' },
  ];

  const handleTogglePermission = (action, targetRole) => {
    const currentRoles = permissions[action] || [];
    let newRoles;
    if (currentRoles.includes(targetRole)) {
      newRoles = currentRoles.filter(r => r !== targetRole);
    } else {
      newRoles = [...currentRoles, targetRole];
    }
    updatePermissions({ ...permissions, [action]: newRoles });
  };

  const handleSync = async () => {
    if (!file) {
      setStatus({ type: 'error', message: 'Selecione um arquivo CSV primeiro.' });
      return;
    }

    setSyncing(true);
    setStatus({ type: '', message: '' });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          await api.uploadData(results.data, targetBase);
          setStatus({ type: 'success', message: `Base ${targetBase} sincronizada com sucesso!` });
          setFile(null);
        } catch (err) {
          setStatus({ type: 'error', message: 'Falha na sincronização com o Google Apps Script.' });
        } finally {
          setSyncing(false);
        }
      },
      error: (err) => {
        setStatus({ type: 'error', message: 'Erro ao processar arquivo CSV.' });
        setSyncing(false);
      }
    });
  };

  return (
    <div className="flex flex-col h-full space-y-8 pb-10">
      <div className="space-y-1">
        <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic">
          Gestão <span className="text-primary">Administrativa</span>
        </h1>
        <p className="text-muted-foreground font-bold text-sm tracking-widest uppercase">
          Controle de Acessos, Permissões e Sincronização de Dados
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Permission Matrix */}
        <div className="xl:col-span-8 flex flex-col space-y-6">
          <div className="erp-card overflow-hidden">
            <div className="p-8 border-b border-border bg-card flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-primary/10 rounded-3xl text-primary border border-primary/20 shadow-sm">
                  <ShieldCheck size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Matriz de Permissões</h2>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Configuração granular por cargo</p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-2 bg-muted px-4 py-2 rounded-2xl border border-border">
                <Lock size={16} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Admin possui acesso total</span>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-8 py-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Funcionalidade / Ação</th>
                    {rolesAvailable.map(r => (
                      <th key={r} className="px-4 py-6 text-center font-black uppercase tracking-widest text-[10px] text-muted-foreground">{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {actionsList.map((action) => (
                    <tr key={action.id} className="hover:bg-primary/5 transition-all group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-muted rounded-xl text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                            <action.icon size={18} />
                          </div>
                          <span className="font-bold text-foreground text-sm">{action.label}</span>
                        </div>
                      </td>
                      {rolesAvailable.map(r => (
                        <td key={r} className="px-4 py-5 text-center">
                          <button
                            onClick={() => handleTogglePermission(action.id, r)}
                            className={cn(
                              "w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center mx-auto transform active:scale-90 shadow-sm",
                              permissions[action.id]?.includes(r) 
                                ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" 
                                : "bg-background border-border text-muted-foreground hover:border-primary/50"
                            )}
                          >
                            {permissions[action.id]?.includes(r) ? <CheckCircle2 size={18} strokeWidth={3} /> : <div className="w-2 h-2 bg-border rounded-full" />}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sync Panel */}
        <div className="xl:col-span-4 space-y-6">
          <div className="erp-card p-8 border-t-8 border-t-primary">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                <UploadCloud size={24} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">Sincronização Master</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Base de Dados Destino</label>
                <select
                  className="w-full px-5 py-4 rounded-2xl border-2 border-border bg-background focus:border-primary font-bold appearance-none cursor-pointer"
                  value={targetBase}
                  onChange={(e) => setTargetBase(e.target.value)}
                >
                  <option value="base">Planilha Principal (base)</option>
                  <option value="smg13">SMG 13 - Logística</option>
                  <option value="atacadao">Atacadão - Vendas</option>
                </select>
              </div>

              <div 
                className={cn(
                  "border-4 border-dashed rounded-[2.5rem] p-10 text-center transition-all cursor-pointer relative group",
                  dragActive ? "border-primary bg-primary/5 scale-105" : "border-border hover:border-primary/50",
                  file ? "border-success bg-success/5" : ""
                )}
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
                }}
              >
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept=".csv"
                  onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                />
                
                <div className="flex flex-col items-center gap-4">
                  {file ? (
                    <div className="w-16 h-16 bg-success rounded-3xl flex items-center justify-center text-success-foreground shadow-lg animate-bounce">
                      <CheckCircle2 size={32} />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded-3xl flex items-center justify-center text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-all">
                      <UploadCloud size={32} />
                    </div>
                  )}
                  
                  <div>
                    <p className="font-black text-sm uppercase tracking-widest">
                      {file ? file.name : "Arraste o arquivo CSV"}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mt-1">
                      {file ? `${(file.size / 1024).toFixed(1)} KB` : "Ou clique para selecionar"}
                    </p>
                  </div>
                </div>
              </div>

              {status.message && (
                <div className={cn(
                  "p-5 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2",
                  status.type === 'success' ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"
                )}>
                  {status.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                  <p className="font-bold text-sm leading-tight">{status.message}</p>
                </div>
              )}

              <button
                onClick={handleSync}
                disabled={!file || syncing}
                className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl transition-all shadow-xl hover:shadow-primary/30 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-sm disabled:opacity-50"
              >
                {syncing ? <Loader2 className="animate-spin" size={20} /> : <UploadCloud size={20} />}
                {syncing ? 'Processando Base...' : 'Sincronizar Agora'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendingUp({ size, className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function Package({ size, className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size}>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function History({ size, className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function Download({ size, className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}
