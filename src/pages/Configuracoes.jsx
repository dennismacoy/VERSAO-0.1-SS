import React, { useState, useCallback } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import Papa from 'papaparse';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Configuracoes() {
  const { role, permissions, updatePermissions } = useAuth();
  
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [targetBase, setTargetBase] = useState('smg13');
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const rolesAvailable = ['Gerente', 'Lider', 'Colaborador', 'Tercerizado', 'Repositor'];
  const actionsList = [
    'Ver Preço de Custo',
    'Acionar WhatsApp',
    'Ver Aba Relatórios',
    'Ver Aba Separação',
    'Ver Histórico de Vendas',
    'Gerar PDF Pré-Venda',
    'Botão Gerar PDF'
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

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus({ type: '', message: '' });
    }
  }, []);

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus({ type: '', message: '' });
    }
  };

  const handleSync = () => {
    if (!file) {
      setStatus({ type: 'error', message: 'Selecione um arquivo primeiro.' });
      return;
    }

    setSyncing(true);
    setStatus({ type: '', message: '' });

    Papa.parse(file, {
      complete: async (results) => {
        try {
          const data2D = results.data;
          if (data2D.length === 0) throw new Error("Arquivo vazio");

          // Send to Google Apps Script
          await api.uploadData(data2D, targetBase);
          
          setStatus({ type: 'success', message: 'Sincronização iniciada com sucesso!' });
          setFile(null);
        } catch (error) {
          setStatus({ type: 'error', message: 'Erro ao sincronizar dados. Tente novamente.' });
        } finally {
          setSyncing(false);
        }
      },
      error: (error) => {
        setStatus({ type: 'error', message: 'Erro ao ler arquivo CSV.' });
        setSyncing(false);
      }
    });
  };

  return (
    <div className="flex flex-col h-full space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações do Sistema</h1>
        <p className="text-muted-foreground mt-1">Sincronização de base de dados e administração</p>
      </div>

      {role === 'Admin' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border bg-muted/30">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="text-primary" size={24} />
              Matriz de Permissões
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Controle o acesso das funções do sistema para cada nível de usuário. Administradores têm acesso total.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-semibold uppercase tracking-wider text-xs border-b border-border">
                <tr>
                  <th className="px-6 py-4">Permissão / Ação</th>
                  {rolesAvailable.map(r => (
                    <th key={r} className="px-6 py-4 text-center">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {actionsList.map(action => (
                  <tr key={action} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{action}</td>
                    {rolesAvailable.map(r => {
                      const isAllowed = (permissions[action] || []).includes(r);
                      return (
                        <td key={r} className="px-6 py-4 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={isAllowed}
                              onChange={() => handleTogglePermission(action, r)}
                            />
                            <div className="relative w-11 h-6 bg-muted border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm p-6 md:p-8 max-w-4xl">
        <h2 className="text-xl font-bold mb-6">Sincronização de Base de Dados</h2>
        
        <div className="mb-8">
          <p className="text-sm font-semibold text-foreground mb-3">Selecione o destino da importação:</p>
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer bg-muted/50 px-4 py-2 rounded-lg border border-border hover:border-primary transition-colors">
              <input 
                type="radio" 
                name="base" 
                value="smg13" 
                checked={targetBase === 'smg13'}
                onChange={() => setTargetBase('smg13')}
                className="w-4 h-4 text-primary bg-background border-border focus:ring-primary"
              />
              <span className="text-sm font-bold">Base SMG-13</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-muted/50 px-4 py-2 rounded-lg border border-border hover:border-primary transition-colors">
              <input 
                type="radio" 
                name="base" 
                value="smg32" 
                checked={targetBase === 'smg32'}
                onChange={() => setTargetBase('smg32')}
                className="w-4 h-4 text-primary bg-background border-border focus:ring-primary"
              />
              <span className="text-sm font-bold">Base SMG-32</span>
            </label>
          </div>
        </div>

        {/* Dropzone */}
        <div 
          className={`relative w-full h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all ${
            dragActive ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            accept=".csv,.xlsx"
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <UploadCloud size={48} className="text-muted-foreground mb-4" />
          <p className="text-lg font-bold text-foreground">
            Arraste e solte o arquivo aqui
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            ou clique para procurar (CSV)
          </p>
          
          {file && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-card px-4 py-2 rounded-lg border border-primary/50 shadow-md flex items-center gap-2">
              <CheckCircle2 size={18} className="text-success" />
              <span className="text-sm font-bold text-foreground">{file.name}</span>
            </div>
          )}
        </div>

        {status.message && (
          <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 font-medium ${
            status.type === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}>
            {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{status.message}</span>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSync}
            disabled={!file || syncing}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-95"
          >
            {syncing ? <Loader2 className="animate-spin" size={20} /> : 'Sincronizar Dados Agora'}
          </button>
        </div>
      </div>
    </div>
  );
}
