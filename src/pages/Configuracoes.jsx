import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ShieldPlus,
  Settings2,
  Lock,
  Eye,
  FileText,
  Trash2,
  UserPlus,
  X,
  Save,
  Key,
  RefreshCw,
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  LayoutDashboard,
  Search,
  ClipboardList,
  Inbox,
  ShoppingCart,
  ListChecks,
  Building2,
  BarChart3,
  Settings
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import useSortableData from '../hooks/useSortableData';
import {
  fetchUsersFromFirebase,
  createUserFirebase,
  updateUserFirebase,
  deleteUserFirebase,
  changePasswordFirebase,
  listenToUsers,
  saveRoleFirebase,
  deleteRoleFirebase,
  listenToRoles
} from '../lib/firebase';
import ModalCriarRole from '../components/ModalCriarRole';

const SYSTEM_PAGES = [
  { id: 'Acesso Dashboard', canonical: 'view_dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'Acesso Consulta', canonical: 'view_consulta', label: 'Consulta', icon: Search },
  { id: 'Acesso Pedidos', canonical: 'view_pedidos', label: 'Pedidos', icon: ClipboardList },
  { id: 'Acesso Requisições', canonical: 'view_requisicoes', label: 'Requisições', icon: Inbox },
  { id: 'Acesso Pre-Venda', canonical: 'view_prevenda', label: 'Pré-Venda', icon: ShoppingCart },
  { id: 'Acesso Separacao', canonical: 'view_separacao', label: 'Separação', icon: ListChecks },
  { id: 'Acesso Gestao Administrativa', canonical: 'view_gestao_admin', label: 'Gestão Adm.', icon: Building2 },
  { id: 'Acesso Relatorios', canonical: 'view_relatorios', label: 'Relatórios', icon: BarChart3 },
  { id: 'Acesso Configuracoes', canonical: 'view_configuracoes', label: 'Configurações', icon: Settings },
  { id: 'Acessar Sincronização Master', canonical: 'sync_master', label: 'Sincronização Master', icon: UploadCloud }
];

export default function Configuracoes() {
  const { role, permissions, updatePermissions, isAdmin, user, hasPermission, customRoles: authCustomRoles } = useAuth();

  // ---- ESTADOS E REFS DE CONFIGURAÇÃO ----
  const [activeTab, setActiveTab] = useState('permissoes');
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [dynamicRoles, setDynamicRoles] = useState([]);
  const unsubRolesRef = useRef(null);

  // ---- ESTADOS E REFS DE USUÁRIOS ----
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ nome: '', usuario: '', senha: '', role: 'vendedor' });
  const [savingUser, setSavingUser] = useState(false);
  const unsubUsersRef = useRef(null);

  // ---- ESTADOS DE SINCRONIZAÇÃO E SENHA ----
  const [file, setFile] = useState(null);
  const [syncingTarget, setSyncingTarget] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ type: '', message: '' });
  const [dragActive, setDragActive] = useState(false);
  const [updatingMaster, setUpdatingMaster] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  // ---- EFFECT LISTENERS DE DADOS DO FIREBASE ----
  useEffect(() => {
    unsubRolesRef.current = listenToRoles(setDynamicRoles);
    return () => {
      if (unsubRolesRef.current) unsubRolesRef.current();
    };
  }, []);

  useEffect(() => {
    if (isAdmin()) {
      unsubUsersRef.current = listenToUsers(setUsers);
      return () => { if (unsubUsersRef.current) unsubUsersRef.current(); };
    }
  }, [isAdmin]);

  // Se não é admin e tab atual é restrita, muda pra senha
  useEffect(() => {
    if (!isAdmin() && activeTab === 'permissoes') setActiveTab('senha');
    if (!hasPermission('Acessar Sincronização Master') && activeTab === 'sync') setActiveTab('senha');
  }, [activeTab, isAdmin, hasPermission]);

  // ---- DEFINIÇÃO DE ROLES ----
  const baseRoles = ['gerente', 'lider', 'vendedor', 'repositor', 'clientes'];
  const allRoles = useMemo(() => [
    ...baseRoles,
    ...dynamicRoles.map(r => r.id || r.name.toLowerCase().replace(/\s+/g, '_'))
  ].filter((v, i, a) => a.indexOf(v) === i), [baseRoles, dynamicRoles]);

  // ---- HOOKS DE ORDENAÇÃO DINÂMICA ----
  const { items: sortedUsers, requestSort: sortUsers, sortConfig: sortUsersConfig } = useSortableData(users, { key: 'nome', direction: 'asc' });

  // ---- MANIPULADORES DE EVENTOS DE INTERFACE ----
  const renderSortHeader = (title, key, currentSortConfig, onRequestSort, align = 'left') => {
    const isActive = currentSortConfig?.key === key;
    return (
      <th
        onClick={() => onRequestSort(key)}
        className={`px-4 py-3 cursor-pointer select-none hover:bg-muted/80 transition-colors ${
          align === 'center' ? 'text-center' : 'text-left'
        }`}
        title={`Clique para ordenar por ${title}`}
      >
        <div className={`inline-flex items-center gap-1.5 ${align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span>{title}</span>
          {isActive ? (
            currentSortConfig.direction === 'asc' ? (
              <ArrowUp size={13} className="text-primary font-bold" />
            ) : (
              <ArrowDown size={13} className="text-primary font-bold" />
            )
          ) : (
            <ArrowUpDown size={12} className="text-muted-foreground opacity-50 hover:opacity-100" />
          )}
        </div>
      </th>
    );
  };

  const handleSaveNewRole = async (roleName, selectedPermissions = []) => {
    setIsSavingRole(true);
    try {
      await saveRoleFirebase(roleName, selectedPermissions);
      setShowCreateRoleModal(false);
      alert(`Nova Role "${roleName}" criada e salva com sucesso!`);
    } catch (err) {
      console.error('[Firebase] Erro ao salvar Role:', err);
      alert('Erro ao salvar nova Role no Firebase.');
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteDynamicRole = async (roleObj) => {
    if (window.confirm(`Tem certeza que deseja excluir a Role "${roleObj.name || roleObj.id}"?`)) {
      try {
        await deleteRoleFirebase(roleObj.id);
        alert(`Role "${roleObj.name || roleObj.id}" excluída com sucesso!`);
      } catch (err) {
        console.error('[Firebase] Erro ao excluir Role:', err);
        alert('Erro ao excluir Role.');
      }
    }
  };

  const checkRolePageAccess = (roleId, page) => {
    const normRole = roleId.toLowerCase();
    
    // Check in permissions object
    const actionRoles = permissions[page.id] || [];
    const canonicalRoles = page.canonical ? (permissions[page.canonical] || []) : [];
    if (actionRoles.some(r => String(r).toLowerCase() === normRole) || canonicalRoles.some(r => String(r).toLowerCase() === normRole)) {
      return true;
    }

    // Check dynamic role object permissions
    const dynamicRole = dynamicRoles.find(dr => dr.id === normRole || dr.name?.toLowerCase().replace(/\s+/g, '_') === normRole);
    if (dynamicRole && Array.isArray(dynamicRole.permissions)) {
      if (dynamicRole.permissions.includes(page.id) || (page.canonical && dynamicRole.permissions.includes(page.canonical))) {
        return true;
      }
    }

    return false;
  };

  const handleTogglePageForRole = async (targetRole, page) => {
    const normRole = targetRole.toLowerCase();
    const hasAccess = checkRolePageAccess(targetRole, page);

    const currentIdRoles = (permissions[page.id] || []).map(r => String(r).toLowerCase());
    let newIdRoles;
    if (hasAccess) {
      newIdRoles = currentIdRoles.filter(r => r !== normRole);
    } else {
      newIdRoles = Array.from(new Set([...currentIdRoles, normRole]));
    }

    let newCanonicalRoles;
    if (page.canonical) {
      const currentCanonicalRoles = (permissions[page.canonical] || []).map(r => String(r).toLowerCase());
      if (hasAccess) {
        newCanonicalRoles = currentCanonicalRoles.filter(r => r !== normRole);
      } else {
        newCanonicalRoles = Array.from(new Set([...currentCanonicalRoles, normRole]));
      }
    }

    const newPermissions = {
      ...permissions,
      [page.id]: newIdRoles,
      ...(page.canonical ? { [page.canonical]: newCanonicalRoles } : {})
    };

    const dynamicRole = dynamicRoles.find(dr => dr.id === normRole || dr.name?.toLowerCase().replace(/\s+/g, '_') === normRole);
    if (dynamicRole) {
      let updatedPerms = Array.isArray(dynamicRole.permissions) ? [...dynamicRole.permissions] : [];
      if (hasAccess) {
        updatedPerms = updatedPerms.filter(p => p !== page.id && p !== page.canonical);
      } else {
        if (!updatedPerms.includes(page.id)) updatedPerms.push(page.id);
        if (page.canonical && !updatedPerms.includes(page.canonical)) updatedPerms.push(page.canonical);
      }
      try {
        await saveRoleFirebase(dynamicRole.name || targetRole, updatedPerms);
      } catch (e) {
        console.error('Erro ao atualizar role no Firebase:', e);
      }
    }

    await updatePermissions(newPermissions);
  };

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
    ...(isAdmin() ? [{ id: 'permissoes', label: 'Controle de Acessos (Roles)' }] : []),
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
                    {renderSortHeader('Nome', 'nome', sortUsersConfig, sortUsers, 'left')}
                    {renderSortHeader('Usuário', 'usuario', sortUsersConfig, sortUsers, 'left')}
                    {renderSortHeader('Role', 'role', sortUsersConfig, sortUsers, 'center')}
                    <th className="px-4 py-3 text-center text-xs uppercase font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedUsers.map(u => (
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

          {/* Painel de Controle de Acesso por Role (Cards com Toggles) */}
          <div className="erp-card p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <ShieldCheck size={26} className="text-primary" />
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Gerenciamento de Roles e Permissões</h2>
                  <p className="text-xs font-bold text-muted-foreground">
                    Ative ou desative o acesso de cada perfil às páginas do sistema através dos botões.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCreateRoleModal(true)}
                className="flex items-center justify-center gap-2 text-xs py-2.5 px-4 rounded-xl shadow-md bg-green-600 hover:bg-green-700 text-white font-bold uppercase tracking-wider transition-all"
              >
                <ShieldPlus size={18} />
                <span>Criar Nova Role</span>
              </button>
            </div>

            {/* Grid de Roles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allRoles.map(roleId => {
                const dynamicRole = dynamicRoles.find(dr => dr.id === roleId || dr.name?.toLowerCase().replace(/\s+/g, '_') === roleId);
                const roleTitle = dynamicRole?.name || (roleId.charAt(0).toUpperCase() + roleId.slice(1));
                const isDynamic = !!dynamicRole;

                return (
                  <div key={roleId} className="bg-card border border-border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      {/* Header da Role */}
                      <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <ShieldCheck size={20} />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-base uppercase text-foreground flex items-center gap-2">
                              {roleTitle}
                            </h3>
                            <span className={cn(
                              "text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider",
                              isDynamic ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" : "bg-primary/15 text-primary"
                            )}>
                              {isDynamic ? 'Role Customizada' : 'Role Nativa'}
                            </span>
                          </div>
                        </div>

                        {isDynamic && (
                          <button
                            onClick={() => handleDeleteDynamicRole(dynamicRole)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title={`Excluir role ${roleTitle}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      {/* Seção Toggles por Página */}
                      <div className="space-y-3">
                        <h4 className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">
                          Acesso a Páginas do Sistema
                        </h4>

                        <div className="grid grid-cols-1 gap-2">
                          {SYSTEM_PAGES.map(page => {
                            const PageIcon = page.icon;
                            const hasAccess = checkRolePageAccess(roleId, page);

                            return (
                              <div
                                key={page.id}
                                onClick={() => handleTogglePageForRole(roleId, page)}
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none",
                                  hasAccess
                                    ? "bg-green-50/70 dark:bg-green-950/30 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200 shadow-2xs"
                                    : "bg-muted/40 border-border/60 text-muted-foreground hover:border-primary/40"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <PageIcon size={16} className={hasAccess ? "text-green-600 dark:text-green-400" : "text-muted-foreground"} />
                                  <span className="font-extrabold">{page.label}</span>
                                </div>

                                {/* Toggle Button / Switch */}
                                <div
                                  className={cn(
                                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                                    hasAccess ? "bg-green-600" : "bg-zinc-300 dark:bg-zinc-700"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                                      hasAccess ? "translate-x-4" : "translate-x-0"
                                    )}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                  {dynamicRoles.map(dr => (
                    <option key={dr.id} value={dr.id}>{dr.name || dr.id}</option>
                  ))}
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

      {/* Modal: Criar Nova Role Dinâmica */}
      <ModalCriarRole
        isOpen={showCreateRoleModal}
        onClose={() => setShowCreateRoleModal(false)}
        onSave={handleSaveNewRole}
        isSaving={isSavingRole}
      />
    </div>
  );
}
