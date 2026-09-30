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
  Phone,
  Settings
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
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
import { hasRolePermission, DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ALL_PERMISSIONS_LIST, PAGE_PERMISSIONS_STRUCTURE } from '../lib/permissions';

export default function Configuracoes() {
  const { role, permissions, updatePermissions, user, hasPermission, customRoles: authCustomRoles } = useAuth();

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
  const [userForm, setUserForm] = useState({ nome: '', usuario: '', senha: '', role: 'admin' });
  const [savingUser, setSavingUser] = useState(false);
  const unsubUsersRef = useRef(null);

  const ALL_PAGES = useMemo(() => [
    { path: '/', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/consulta', name: 'Consulta', icon: Search },
    { path: '/pedidos', name: 'Pedidos', icon: ClipboardList },
    { path: '/requisicoes', name: 'Requisições', icon: Inbox },
    { path: '/pre-venda', name: 'Pré-Venda', icon: ShoppingCart },
    { path: '/separacao', name: 'Separação', icon: ListChecks },
    { path: '/gestao-administrativa', name: 'Gestão Administrativa', icon: Building2 },
    { path: '/relatorios', name: 'Relatórios', icon: BarChart3 },
    { path: '/telefones', name: 'Telefones', icon: Phone },
    { path: '/configuracoes', name: 'Configurações', icon: Settings },
  ], []);

  const [customMenuOrder, setCustomMenuOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('smartstock_menu_order');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return ALL_PAGES.map(p => p.path);
  });

  const orderedPagesList = useMemo(() => {
    return [...ALL_PAGES].sort((a, b) => {
      const indexA = customMenuOrder.indexOf(a.path);
      const indexB = customMenuOrder.indexOf(b.path);
      const orderA = indexA === -1 ? 999 : indexA;
      const orderB = indexB === -1 ? 999 : indexB;
      return orderA - orderB;
    });
  }, [ALL_PAGES, customMenuOrder]);

  const saveMenuOrder = (newPathsOrder) => {
    setCustomMenuOrder(newPathsOrder);
    localStorage.setItem('smartstock_menu_order', JSON.stringify(newPathsOrder));
    window.dispatchEvent(new Event('menuOrderChanged'));
  };

  const handleMovePageUp = (index) => {
    if (index === 0) return;
    const list = [...orderedPagesList.map(p => p.path)];
    const temp = list[index - 1];
    list[index - 1] = list[index];
    list[index] = temp;
    saveMenuOrder(list);
  };

  const handleMovePageDown = (index) => {
    if (index === orderedPagesList.length - 1) return;
    const list = [...orderedPagesList.map(p => p.path)];
    const temp = list[index + 1];
    list[index + 1] = list[index];
    list[index] = temp;
    saveMenuOrder(list);
  };

  const handleResetMenuOrder = () => {
    const defaultPaths = ALL_PAGES.map(p => p.path);
    saveMenuOrder(defaultPaths);
  };

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

  const canManageConfig = useMemo(() => {
    return hasPermission(PERMISSIONS.VIEW_CONFIGURACOES) || hasPermission('Acesso Configuracoes');
  }, [hasPermission]);

  useEffect(() => {
    if (canManageConfig) {
      unsubUsersRef.current = listenToUsers(setUsers);
      return () => { if (unsubUsersRef.current) unsubUsersRef.current(); };
    }
  }, [canManageConfig]);

  // Se não possui permissão de configuração e tab atual é restrita, muda pra senha
  useEffect(() => {
    const canSyncMaster = hasPermission(PERMISSIONS.SYNC_MASTER) || hasPermission('Acessar Sincronização Master');
    if (!canManageConfig && activeTab === 'permissoes') setActiveTab('senha');
    if (!canSyncMaster && activeTab === 'sync') setActiveTab('senha');
  }, [activeTab, canManageConfig, hasPermission]);

  // ---- DEFINIÇÃO DE ROLES (Role Nativa 'admin' + Roles Dinâmicas Customizadas) ----
  const NATIVE_ROLES = useMemo(() => ['admin'], []);

  const allRoles = useMemo(() => [
    ...NATIVE_ROLES,
    ...dynamicRoles.map(r => r.id || r.name.toLowerCase().replace(/\s+/g, '_'))
  ].filter((v, i, a) => a.indexOf(v) === i), [NATIVE_ROLES, dynamicRoles]);

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

  const checkItemAccess = (roleId, itemId, legacyId = null) => {
    return hasRolePermission(roleId, itemId, permissions) || (legacyId ? hasRolePermission(roleId, legacyId, permissions) : false);
  };

  const handleToggleItemForRole = async (targetRole, itemId, legacyId = null) => {
    const normRole = targetRole.toLowerCase();
    const hasAccess = checkItemAccess(targetRole, itemId, legacyId);

    // 1. Obter ações atuais para a role
    let rolePerms = permissions[normRole];
    if (!rolePerms || !Array.isArray(rolePerms)) {
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[normRole] || [];
      if (defaultPerms.includes('*')) {
        rolePerms = ALL_PERMISSIONS_LIST.map(p => p.id);
      } else {
        rolePerms = [...defaultPerms];
      }
    } else if (rolePerms.includes('*')) {
      rolePerms = ALL_PERMISSIONS_LIST.map(p => p.id);
    } else {
      rolePerms = [...rolePerms];
    }

    let newRolePerms;
    if (hasAccess) {
      // Remover permissão
      newRolePerms = rolePerms.filter(p => p !== itemId && p !== legacyId);
    } else {
      // Adicionar permissão
      newRolePerms = Array.from(new Set([...rolePerms, itemId, ...(legacyId ? [legacyId] : [])]));
    }

    // 2. Atualizar compatibilidade legada { [action]: [roles] }
    const currentIdRoles = (permissions[itemId] || []).map(r => String(r).toLowerCase());
    let newIdRoles = hasAccess
      ? currentIdRoles.filter(r => r !== normRole)
      : Array.from(new Set([...currentIdRoles, normRole]));

    const newPermissions = {
      ...permissions,
      [normRole]: newRolePerms,
      [itemId]: newIdRoles,
      ...(legacyId ? { [legacyId]: newIdRoles } : {})
    };

    // 3. Atualizar Role Dinâmica no Firebase se aplicável
    const dynamicRole = dynamicRoles.find(dr => dr.id === normRole || dr.name?.toLowerCase().replace(/\s+/g, '_') === normRole);
    if (dynamicRole) {
      try {
        await saveRoleFirebase(dynamicRole.name || targetRole, newRolePerms);
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

  // ---- Rotinas de Processamento Dual de Arquivos (XLSX / XLS e CSV) ----
  const parseExcelFile = (uploadedFile) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target.result;
          const workbook = XLSX.read(buffer, {
            type: 'array',
            cellDates: true,
            dateNF: 'yyyy-mm-dd',
            raw: false
          });
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return reject(new Error('Nenhuma planilha/aba encontrada no arquivo Excel (.xlsx/.xls).'));
          }
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "", blankrows: false });

          if (!rawJson || rawJson.length === 0) {
            return reject(new Error('A planilha selecionada no arquivo Excel está vazia.'));
          }

          // Sanitiza chaves de cabeçalho removendo espaços e quebras de linha acidentais
          const cleaned = rawJson.map((row) => {
            const cleanRow = {};
            Object.entries(row).forEach(([colKey, val]) => {
              const cleanKey = String(colKey || '').trim().replace(/[\r\n]+/g, ' ');
              if (cleanKey) {
                if (val instanceof Date) {
                  cleanRow[cleanKey] = val.toISOString().split('T')[0];
                } else if (val === null || val === undefined) {
                  cleanRow[cleanKey] = "";
                } else {
                  cleanRow[cleanKey] = typeof val === 'string' ? val.trim() : val;
                }
              }
            });
            return cleanRow;
          });

          resolve(cleaned);
        } catch (err) {
          reject(new Error(`Erro ao ler arquivo Excel: ${err?.message || err}`));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler os bytes do arquivo Excel.'));
      reader.readAsArrayBuffer(uploadedFile);
    });
  };

  const parseCSVFile = (uploadedFile) => {
    return new Promise((resolve, reject) => {
      Papa.parse(uploadedFile, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (header) => String(header || '').trim().replace(/[\r\n]+/g, ' '),
        complete: (results) => {
          if (results.errors && results.errors.length > 0 && (!results.data || results.data.length === 0)) {
            return reject(new Error(`Erro ao processar CSV: ${results.errors[0]?.message || 'Arquivo corrompido'}`));
          }
          const cleaned = (results.data || []).map((row) => {
            const cleanRow = {};
            Object.entries(row).forEach(([k, v]) => {
              const cleanK = String(k || '').trim().replace(/[\r\n]+/g, ' ');
              if (cleanK) {
                cleanRow[cleanK] = v === null || v === undefined ? "" : (typeof v === 'string' ? v.trim() : v);
              }
            });
            return cleanRow;
          });
          resolve(cleaned);
        },
        error: (err) => reject(new Error(`Falha no parse do CSV: ${err?.message || err}`)),
      });
    });
  };

  const parseUploadedFile = async (uploadedFile) => {
    const fileName = uploadedFile.name || '';
    const extension = fileName.split('.').pop()?.toLowerCase();

    let rawData = [];
    if (extension === 'xlsx' || extension === 'xls') {
      rawData = await parseExcelFile(uploadedFile);
    } else if (extension === 'csv') {
      rawData = await parseCSVFile(uploadedFile);
    } else {
      throw new Error(`Formato de arquivo ".${extension}" não suportado. Utilize arquivos .xlsx, .xls ou .csv.`);
    }

    // Validação de Payload: bloquear se vazio ou sem linhas válidas
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      throw new Error('O arquivo selecionado está vazio ou não contém dados válidos.');
    }

    const validRows = rawData.filter((row) => {
      if (!row || typeof row !== 'object') return false;
      return Object.values(row).some((val) => val !== null && val !== undefined && String(val).trim() !== '');
    });

    if (validRows.length === 0) {
      throw new Error('O arquivo selecionado está vazio ou não contém dados válidos.');
    }

    return validRows;
  };

  // ---- Sincronização Master ----
  const handleSync = async (target) => {
    setSyncingTarget(target); 
    setSyncStatus({ type: '', message: '' });
    
    if (file) {
      try {
        // 1. Processar arquivo (suporte dual XLSX e CSV) com validação de payload
        const jsonData = await parseUploadedFile(file);

        // 2. Chamar api.uploadData com a URL do ambiente da filial ativa
        const response = await api.uploadData(jsonData, target);

        const countMsg = response?.count ? ` (${response.count} registros gravados)` : ` (${jsonData.length} registros)`;
        setSyncStatus({ 
          type: 'success', 
          message: `Base ${target.toUpperCase()} sincronizada com sucesso!${countMsg}` 
        });
        setFile(null);
      } catch (err) {
        console.error("Erro na sincronização:", err);
        setSyncStatus({ 
          type: 'error', 
          message: err?.message || `Falha na sincronização da base ${target.toUpperCase()}.` 
        });
      } finally {
        setSyncingTarget(null);
      }
    } else {
      try {
        await api.syncMaster(target, { action: "sync_trigger", timestamp: new Date().toISOString() });
        setSyncStatus({ type: 'success', message: `Disparo da base ${target.toUpperCase()} enviado com sucesso!` });
      } catch (err) { 
        console.error("Erro no disparo:", err);
        setSyncStatus({ 
          type: 'error', 
          message: err?.message || `Falha na sincronização do ${target.toUpperCase()}.` 
        }); 
      } finally { 
        setSyncingTarget(null); 
      }
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
    ...(canManageConfig ? [{ id: 'permissoes', label: 'Controle de Acessos (Roles)' }] : []),
    { id: 'menu', label: 'Ordenação do Menu' },
    ...(hasPermission(PERMISSIONS.SYNC_MASTER) || hasPermission('Acessar Sincronização Master') ? [{ id: 'sync', label: 'Sincronização Master' }] : []),
    { id: 'senha', label: 'Trocar Senha' },
  ];

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
      {activeTab === 'permissoes' && canManageConfig && (
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

                      {/* Seção Toggles Organizados por Página e Abas */}
                      <div className="space-y-4">
                        <h4 className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">
                          Permissões por Página & Abas
                        </h4>

                        <div className="space-y-3">
                          {PAGE_PERMISSIONS_STRUCTURE.map(pageStruct => {
                            const pageAccess = checkItemAccess(roleId, pageStruct.pageId, pageStruct.legacyId);

                            return (
                              <div
                                key={pageStruct.pageId}
                                className="bg-slate-50/50 dark:bg-zinc-900/60 border border-border rounded-xl p-3 space-y-2"
                              >
                                {/* Alternador Principal da Página */}
                                <div
                                  onClick={() => handleToggleItemForRole(roleId, pageStruct.pageId, pageStruct.legacyId)}
                                  className="flex items-center justify-between cursor-pointer select-none"
                                >
                                  <span className="font-extrabold text-xs text-foreground uppercase tracking-tight">
                                    {pageStruct.label}
                                  </span>

                                  <div
                                    className={cn(
                                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                                      pageAccess ? "bg-green-600" : "bg-zinc-300 dark:bg-zinc-700"
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                                        pageAccess ? "translate-x-4" : "translate-x-0"
                                      )}
                                    />
                                  </div>
                                </div>

                                {/* Lista Sub-Abas/Módulos da Página */}
                                {pageStruct.tabs && pageStruct.tabs.length > 0 && (
                                  <div className="pl-3 border-l-2 border-primary/20 space-y-1.5 pt-1">
                                    {pageStruct.tabs.map(tab => {
                                      const tabAccess = checkItemAccess(roleId, tab.id, tab.legacyId);

                                      return (
                                        <div
                                          key={tab.id}
                                          onClick={() => handleToggleItemForRole(roleId, tab.id, tab.legacyId)}
                                          className={cn(
                                            "flex items-center justify-between p-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer select-none",
                                            tabAccess
                                              ? "bg-green-100/60 dark:bg-green-950/40 text-green-900 dark:text-green-200"
                                              : "text-muted-foreground hover:bg-muted/40"
                                          )}
                                        >
                                          <span>{tab.label}</span>
                                          <div
                                            className={cn(
                                              "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out",
                                              tabAccess ? "bg-green-600" : "bg-zinc-300 dark:bg-zinc-700"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out",
                                                tabAccess ? "translate-x-3" : "translate-x-0"
                                              )}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <UploadCloud size={24} className="text-primary" />
              <h2 className="text-xl font-black uppercase">Sincronização Master</h2>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              {import.meta.env.VITE_FILIAL_NOME || `Filial ${import.meta.env.VITE_FILIAL_ID || 'Ativa'}`}
            </span>
          </div>

          <div className="bg-muted/40 border border-border rounded-xl p-3 text-xs flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Planilha de Destino:</span>
            <span className="font-bold text-foreground flex items-center gap-1">
              Google Sheets — {import.meta.env.VITE_FILIAL_NOME || `Filial ${import.meta.env.VITE_FILIAL_ID || '685'}`}
            </span>
          </div>
          
          <div
            className={cn("border-4 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative", dragActive ? "border-primary bg-primary/5" : "border-border", file ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "")}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files?.[0]) { setFile(e.dataTransfer.files[0]); setSyncStatus({ type: '', message: '' }); } }}
          >
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".csv, .xlsx, .xls" onChange={(e) => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setSyncStatus({ type: '', message: '' }); } }} />
            <p className="font-black text-sm uppercase text-foreground">{file ? file.name : "Arraste o arquivo Excel (.xlsx, .xls) ou CSV"}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{file ? `${(file.size / 1024).toFixed(1)} KB — Pronto para sincronizar` : "Selecione o arquivo de dados. Se não selecionado, fará o disparo padrão."}</p>
          </div>

          {file && (
            <div className="flex justify-end -mt-3">
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <X size={14} /> Remover arquivo selecionado
              </button>
            </div>
          )}
          
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

      {/* TAB: Ordenação do Menu */}
      {activeTab === 'menu' && (
        <div className="erp-card p-6 space-y-6 max-w-3xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-black flex items-center gap-2 text-foreground">
                <ArrowUpDown size={22} className="text-primary" />
                Personalizar Ordem do Menu
              </h2>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                Reordene a sequência das páginas exibidas no menu lateral e mobile.
              </p>
            </div>
            <button
              onClick={handleResetMenuOrder}
              className="px-4 py-2 rounded-xl border border-border text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} />
              Restaurar Ordem Padrão
            </button>
          </div>

          <div className="space-y-2">
            {orderedPagesList.map((pg, idx) => {
              const IconComp = pg.icon;
              return (
                <div
                  key={pg.path}
                  className="p-3.5 bg-card border border-border rounded-2xl flex items-center justify-between hover:border-primary/40 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-primary">
                      <IconComp size={18} />
                    </div>
                    <div>
                      <span className="font-extrabold text-sm text-foreground block">{pg.name}</span>
                      <span className="text-[10px] text-muted-foreground font-semibold">{pg.path}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMovePageUp(idx)}
                      className="p-2 rounded-xl border border-border hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-all cursor-pointer"
                      title="Mover para cima"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === orderedPagesList.length - 1}
                      onClick={() => handleMovePageDown(idx)}
                      className="p-2 rounded-xl border border-border hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-all cursor-pointer"
                      title="Mover para baixo"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
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
