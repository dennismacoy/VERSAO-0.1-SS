import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Settings2, Lock, Eye, FileText, Trash2, UserPlus, X, Save, Key, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { fetchUsersFromFirebase, createUserFirebase, updateUserFirebase, deleteUserFirebase, changePasswordFirebase, listenToUsers } from '../lib/firebase';

export default function Configuracoes() {
  const { role, permissions, updatePermissions, isAdmin, user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('permissoes');

  // ---- Permissões ----
  const rolesAvailable = ['gerente', 'lider', 'vendedor', 'repositor', 'clientes'];
  const actionsList = [
    { id: 'Acesso Dashboard', label: 'Acesso Dashboard' },
    { id: 'Acesso Consulta', label: 'Acesso Consulta' },
    { id: 'Acesso Pedidos', label: 'Acesso Pedidos' },
    { id: 'Acesso Requisições', label: 'Acesso Requisições' },
    { id: 'Acesso Pre-Venda', label: 'Acesso Pré-Venda' },
    { id: 'Criar Prevenda', label: 'Criar Nova Pré-Venda' },
    { id: 'Acesso Separacao', label: 'Acesso Separação' },
    { id: 'Acesso Relatorios', label: 'Acesso Relatórios' },
    { id: 'Ver Aba Atual', label: 'Ver Aba Atual (Relatórios)' },
    { id: 'Ver Aba Histórico', label: 'Ver Aba Histórico (Relatórios)' },
    { id: 'Acesso Configuracoes', label: 'Acesso Configurações' },
    { id: 'Acessar Sincronização Master', label: 'Acessar Sincronização Master' },
    { id: 'Ver Card Geral', label: 'Ver Info Gerais (Consulta)' },
    { id: 'Ver Card Extras', label: 'Ver Info Extras (Consulta)' },
    { id: 'Ver Itens ISV', label: 'Ver Itens ISV (Dashboard)' },
    { id: 'Ver Itens Idade', label: 'Ver Itens Idade (Dashboard)' },
    { id: 'Ver Total Paletes', label: 'Ver Total Paletes' },
    { id: 'Ver Valor Estoque', label: 'Ver Valor Estoque' },
    { id: 'Botao Enviar WPP', label: 'Botão Enviar WhatsApp' },
    { id: 'Botao Ligar Comprador', label: 'Botão Falar Comprador' },
    { id: 'Botao Gerar PDF', label: 'Botão Gerar PDF' },
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

  // ---- Usuários ----
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ nome: '', usuario: '', senha: '', role: 'vendedor' });
  const [savingUser, setSavingUser] = useState(false);
  const unsubUsersRef = useRef(null);

  useEffect(() => {
    if (isAdmin()) {
      unsubUsersRef.current = listenToUsers(setUsers);
      return () => { if (unsubUsersRef.current) unsubUsersRef.current(); };
    }
  }, [isAdmin]);

  const openNewUser = () => { setEditingUser(null); setUserForm({ nome: '', usuario: '', senha: '', role: 'vendedor' }); setShowUserModal(true); };
  const openEditUser = (u) => { setEditingUser(u); setUserForm({ nome: u.nome || '', usuario: u.usuario || '', senha: '', role: u.role || u.perfil || 'vendedor' }); setShowUserModal(true); };

  const handleSaveUser = async () => {
    if (!userForm.nome || !userForm.usuario) return alert('Preencha nome e usuário.');
    setSavingUser(true);
    try {
      if (editingUser) {
        const fields = { nome: userForm.nome, usuario: userForm.usuario, role: userForm.role };
        if (userForm.senha) fields.senha = userForm.senha;
        await updateUserFirebase(editingUser.firebaseId, fields);
      } else {
        if (!userForm.senha) return alert('Senha obrigatória para novo usuário.');
        await createUserFirebase(userForm);
      }
      setShowUserModal(false);
    } catch (e) { alert('Erro ao salvar usuário.'); }
    finally { setSavingUser(false); }
  };

  const handleDeleteUser = async (u) => {
    if (window.confirm(`Excluir ${u.nome || u.usuario}?`)) {
      try { await deleteUserFirebase(u.firebaseId); } catch (e) { alert('Erro ao excluir.'); }
    }
  };

  // ---- Sincronização ----
  const [file, setFile] = useState(null);
  const [syncingTarget, setSyncingTarget] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ type: '', message: '' });
  const [dragActive, setDragActive] = useState(false);

  const handleSync = async (target) => {
    setSyncingTarget(target); 
    setSyncStatus({ type: '', message: '' });
    
    if (file) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        await api.syncMaster(target, jsonData);
        setSyncStatus({ type: 'success', message: `Base ${target.toUpperCase()} sincronizada com sucesso!` });
        setFile(null);
      } catch (err) {
        console.error("Erro no processamento do arquivo:", err);
        setSyncStatus({ type: 'error', message: `Falha na sincronização do ${target.toUpperCase()}.` });
      } finally {
        setSyncingTarget(null);
      }
    } else {
      try {
        await api.syncMaster(target, { action: "sync_trigger", timestamp: new Date().toISOString() });
        setSyncStatus({ type: 'success', message: `Base ${target.toUpperCase()} sincronizada com sucesso!` });
      } catch (err) { 
        setSyncStatus({ type: 'error', message: `Falha na sincronização do ${target.toUpperCase()}.` }); 
      }
      finally { setSyncingTarget(null); }
    }
  };
  const [updatingMaster, setUpdatingMaster] = useState(false);

  const handleTriggerUpdate = async () => {
    setUpdatingMaster(true);
    setSyncStatus({ type: '', message: '' });
    try {
      await api.triggerMasterUpdate();
      setSyncStatus({ type: 'success', message: 'Atualização mestre executada com sucesso!' });
    } catch (err) {
      setSyncStatus({ type: 'error', message: 'Falha na atualização mestre.' });
    } finally {
      setUpdatingMaster(false);
    }
  };

  // ---- Trocar Senha ----
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  const handleChangePassword = async () => {
    if (!newPwd || newPwd.length < 4) return alert('Senha deve ter pelo menos 4 caracteres.');
    if (newPwd !== confirmPwd) return alert('As senhas não coincidem.');
    if (!user?.firebaseId) return alert('Erro: ID do usuário não encontrado.');
    setChangingPwd(true);
    try {
      await changePasswordFirebase(user.firebaseId, newPwd);
      alert('Senha alterada com sucesso!');
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e) { alert('Erro ao alterar senha.'); }
    finally { setChangingPwd(false); }
  };

  const tabs = [
    ...(isAdmin() ? [{ id: 'permissoes', label: 'Matriz de Permissões' }] : []),
    ...(hasPermission('Acessar Sincronização Master') ? [{ id: 'sync', label: 'Sincronização Master' }] : []),
    { id: 'senha', label: 'Trocar Senha' },
  ];

  // Se não é admin e tab atual é restrita, muda pra senha
  useEffect(() => {
    if (!isAdmin() && activeTab === 'permissoes') setActiveTab('senha');
    if (!hasPermission('Acessar Sincronização Master') && activeTab === 'sync') setActiveTab('senha');
  }, [activeTab, isAdmin, hasPermission]);

  return (
    <div className="flex flex-col h-full space-y-6 pb-10">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-foreground uppercase italic">
          Gestão <span className="text-primary">Administrativa</span>
        </h1>
        <p className="text-muted-foreground font-bold text-sm tracking-widest uppercase">Controle de Acessos e Configurações</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={cn(
            "px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2",
            activeTab === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
          )}>{t.label}</button>
        ))}
      </div>

      {/* TAB: Permissões */}
      {activeTab === 'permissoes' && isAdmin() && (
        <div className="space-y-6">
          {/* User Management */}
          <div className="erp-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black flex items-center gap-2"><UserPlus size={22} /> Usuários Cadastrados</h2>
              <button onClick={openNewUser} className="btn-primary flex items-center gap-2 text-xs"><UserPlus size={16} /> Novo Usuário</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-200 dark:bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 font-bold text-xs uppercase">Nome</th>
                    <th className="px-4 py-3 font-bold text-xs uppercase">Usuário</th>
                    <th className="px-4 py-3 font-bold text-xs uppercase text-center">Role</th>
                    <th className="px-4 py-3 text-center text-xs uppercase font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map(u => (
                    <tr key={u.firebaseId} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-bold">{u.nome || u.usuario}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.usuario}</td>
                      <td className="px-4 py-3 text-center"><span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-black uppercase">{u.role || u.perfil || u.cargo}</span></td>
                      <td className="px-4 py-3 text-center flex justify-center gap-2">
                        <button onClick={() => openEditUser(u)} className="p-1.5 hover:bg-primary/10 rounded text-primary"><Settings2 size={16} /></button>
                        <button onClick={() => handleDeleteUser(u)} className="p-1.5 hover:bg-destructive/10 rounded text-destructive"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Permission Matrix */}
          <div className="erp-card overflow-hidden">
            <div className="p-6 border-b border-border flex items-center gap-3">
              <ShieldCheck size={24} className="text-primary" />
              <div>
                <h2 className="text-xl font-black uppercase">Matriz de Permissões</h2>
                <p className="text-xs font-bold text-muted-foreground">Admin possui acesso total automático</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-200 dark:bg-zinc-800">
                    <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Funcionalidade</th>
                    {rolesAvailable.map(r => (
                      <th key={r} className="px-3 py-4 text-center font-black uppercase tracking-widest text-[10px]">{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {actionsList.map(action => (
                    <tr key={action.id} className="hover:bg-primary/5">
                      <td className="px-6 py-3 font-bold text-sm">{action.label}</td>
                      {rolesAvailable.map(r => (
                        <td key={r} className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleTogglePermission(action.id, r)}
                            className={cn(
                              "w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center mx-auto active:scale-90",
                              permissions[action.id]?.includes(r)
                                ? "bg-primary border-primary text-primary-foreground shadow-md"
                                : "bg-background border-border text-muted-foreground hover:border-primary/50"
                            )}
                          >
                            {permissions[action.id]?.includes(r) ? <CheckCircle2 size={14} strokeWidth={3} /> : <div className="w-1.5 h-1.5 bg-border rounded-full" />}
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
      )}

      {/* TAB: Sincronização */}
      {activeTab === 'sync' && hasPermission('Acessar Sincronização Master') && (
        <div className="max-w-lg mx-auto erp-card p-8 border-t-8 border-t-primary space-y-6">
          <div className="flex items-center gap-3">
            <UploadCloud size={24} className="text-primary" />
            <h2 className="text-xl font-black uppercase">Sincronização Master</h2>
          </div>
          
          <div
            className={cn("border-4 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative", dragActive ? "border-primary bg-primary/5" : "border-border", file ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "")}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); }}
          >
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".csv, .xlsx, .xls" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
            <p className="font-black text-sm uppercase">{file ? file.name : "Arraste o arquivo Excel/CSV (Opcional)"}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{file ? `${(file.size / 1024).toFixed(1)} KB` : "Se não selecionado, fará a sincronização padrão."}</p>
          </div>
          
          {syncStatus.message && (
            <div className={cn("p-4 rounded-xl flex items-center gap-3", syncStatus.type === 'success' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
              {syncStatus.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <p className="font-bold text-sm">{syncStatus.message}</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <button 
              onClick={() => handleSync('smg13')} 
              disabled={syncingTarget !== null || updatingMaster} 
              className="w-full btn-primary py-4 flex flex-col items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50 transition-transform active:scale-95"
            >
              {syncingTarget === 'smg13' ? <Loader2 className="animate-spin" size={24} /> : <UploadCloud size={24} />}
              <span className="font-bold">{syncingTarget === 'smg13' ? 'Sincronizando...' : 'Sincronizar SMG13'}</span>
            </button>
            <button 
              onClick={() => handleSync('smg32')} 
              disabled={syncingTarget !== null || updatingMaster} 
              className="w-full btn-primary py-4 flex flex-col items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50 transition-transform active:scale-95 bg-blue-600 hover:bg-blue-700 border-blue-600"
            >
              {syncingTarget === 'smg32' ? <Loader2 className="animate-spin" size={24} /> : <UploadCloud size={24} />}
              <span className="font-bold">{syncingTarget === 'smg32' ? 'Sincronizando...' : 'Sincronizar SMG32'}</span>
            </button>
            <button 
              onClick={handleTriggerUpdate} 
              disabled={syncingTarget !== null || updatingMaster} 
              className="w-full btn-primary py-4 flex flex-col items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50 transition-transform active:scale-95 bg-orange-500 hover:bg-orange-600 border-orange-500"
            >
              {updatingMaster ? <Loader2 className="animate-spin" size={24} /> : <RefreshCw size={24} />}
              <span className="font-bold">{updatingMaster ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB: Trocar Senha */}
      {activeTab === 'senha' && (
        <div className="max-w-md mx-auto erp-card p-8 border-t-8 border-t-primary space-y-6">
          <div className="flex items-center gap-3">
            <Key size={24} className="text-primary" />
            <h2 className="text-xl font-black uppercase">Trocar Minha Senha</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nova Senha</label>
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-border bg-background font-bold text-base mt-1" placeholder="••••••••" />
            </div>
            <div>
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Confirmar Senha</label>
              <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-border bg-background font-bold text-base mt-1" placeholder="••••••••" />
            </div>
          </div>
          <button onClick={handleChangePassword} disabled={changingPwd} className="w-full btn-primary py-4 flex items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50">
            {changingPwd ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {changingPwd ? 'Salvando...' : 'Salvar Nova Senha'}
          </button>
        </div>
      )}

      {/* Modal: Novo/Editar Usuário */}
      {showUserModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden">
            <div className="p-5 border-b bg-primary/5 flex justify-between items-center">
              <h3 className="font-black text-lg">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
              <button onClick={() => setShowUserModal(false)} className="p-1.5 hover:bg-destructive hover:text-destructive-foreground rounded-full"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase">Nome</label>
                <input value={userForm.nome} onChange={(e) => setUserForm({ ...userForm, nome: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border bg-background font-bold text-base mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase">Usuário (login)</label>
                <input value={userForm.usuario} onChange={(e) => setUserForm({ ...userForm, usuario: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border bg-background font-bold text-base mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase">{editingUser ? 'Nova Senha (vazio = manter)' : 'Senha'}</label>
                <input type="password" value={userForm.senha} onChange={(e) => setUserForm({ ...userForm, senha: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border bg-background font-bold text-base mt-1" placeholder="••••••••" />
              </div>
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase">Role</label>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border bg-background font-bold mt-1">
                  <option value="admin">Admin</option>
                  <option value="gerente">Gerente</option>
                  <option value="lider">Líder</option>
                  <option value="vendedor">Vendedor</option>
                  <option value="repositor">Repositor</option>
                  <option value="clientes">Clientes</option>
                </select>
              </div>
              <button onClick={handleSaveUser} disabled={savingUser} className="w-full btn-primary py-3 flex items-center justify-center gap-2">
                {savingUser ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
