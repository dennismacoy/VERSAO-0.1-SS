import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Building2,
  Users,
  Laptop,
  Calendar,
  FileText,
  Loader2,
  RefreshCw,
  X,
  Phone,
  MapPin,
  Tag,
  ArrowUpDown,
  CheckSquare,
  Square
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// URL da API do Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbxXJgrXliDUG1MAvqBa0wnmpbRfVMe4IhcgHCZNMo_trvSTFmJpl5Ih2Td-MYGL_ReS2w/exec";

// Função utilitária para requisições ao GAS
const fetchGAS = async (payload) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[GAS API Error] (${payload.action} - ${payload.sheetName}):`, error);
    throw error;
  }
};

// Opções de Status das Tarefas
const TASK_STATUS_OPTIONS = [
  'Em Cotação',
  'Aguardando Tec Manutenção',
  'Aguardando Retorno do Prestador',
  'Aguardando Orçamento',
  'Aguardando Aprovação da Despesa',
  'Aprovado - Aguardando Chegada',
  'Recusado',
  'Aguardando Verba'
];

// Opções de Categorias de Preventiva
const PREVENTIVE_CATEGORY_OPTIONS = [
  'Equipamento / Máquina',
  'Veículo / Frota',
  'Documento / Licença',
  'Infraestrutura / Prédio'
];

// Opções de Periodicidade
const PERIODICITY_OPTIONS = ['Mensal', 'Trimestral', 'Semestral', 'Anual'];

// Opções de Status de TI
const IT_STATUS_OPTIONS = [
  'Enviado',
  'Aguardando Orçamento',
  'Aguardando Aprovação',
  'Aprovado',
  'Aguardando Retorno'
];

// Utilitário para calcular a próxima data da preventiva
const calculateNextDate = (lastDateStr, periodicity) => {
  if (!lastDateStr) return null;
  const date = new Date(lastDateStr);
  if (isNaN(date.getTime())) return null;

  switch (periodicity) {
    case 'Mensal':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'Trimestral':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'Semestral':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'Anual':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }
  return date;
};

// Utilitário para calcular dias restantes
const getDaysRemaining = (targetDate) => {
  if (!targetDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default function GestaoOperacional() {
  const { hasPermission } = useAuth();

  // Abas de navegação: 'tasks' | 'preventive' | 'it'
  const [activeTab, setActiveTab] = useState('tasks');

  // Estados de listas de dados
  const [setores, setSetores] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [preventivas, setPreventivas] = useState([]);
  const [tiItems, setTiItems] = useState([]);

  // Estado de carregamento e salvamento
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Filtros globais de busca
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modais
  const [modalType, setModalType] = useState(null); // 'task' | 'preventive' | 'it' | 'sector' | 'supplier' | null
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { sheetName, id, name }

  // Estados dos formulários de modais
  const [taskForm, setTaskForm] = useState({
    name: '',
    sector: '',
    status: TASK_STATUS_OPTIONS[0],
    entryDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    completed: false
  });

  const [prevForm, setPrevForm] = useState({
    name: '',
    category: PREVENTIVE_CATEGORY_OPTIONS[0],
    periodicity: PERIODICITY_OPTIONS[0],
    lastDate: new Date().toISOString().split('T')[0]
  });

  const [itForm, setItForm] = useState({
    device: '',
    supplierId: '',
    supplierName: '',
    status: IT_STATUS_OPTIONS[0],
    sendDate: new Date().toISOString().split('T')[0],
    expectedDate: '',
    notes: '',
    completed: false
  });

  const [sectorForm, setSectorForm] = useState({ nome: '' });
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact: '',
    phone: '',
    cep: '',
    city: '',
    state: ''
  });

  // Função para exibir notificações temporárias
  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Carregamento inicial de todos os dados via Promise.all
  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resSetores, resFornecedores, resTarefas, resPreventivas, resTI] = await Promise.all([
        fetchGAS({ action: 'getData', sheetName: 'Setores' }),
        fetchGAS({ action: 'getData', sheetName: 'Fornecedores' }),
        fetchGAS({ action: 'getData', sheetName: 'Tarefas' }),
        fetchGAS({ action: 'getData', sheetName: 'Preventivas' }),
        fetchGAS({ action: 'getData', sheetName: 'TI' })
      ]);

      setSetores(Array.isArray(resSetores) ? resSetores : []);
      setFornecedores(Array.isArray(resFornecedores) ? resFornecedores : []);
      setTarefas(Array.isArray(resTarefas) ? resTarefas : []);
      setPreventivas(Array.isArray(resPreventivas) ? resPreventivas : []);
      setTiItems(Array.isArray(resTI) ? resTI : []);
    } catch (error) {
      console.error('Erro ao carregar dados da API:', error);
      showToast('Falha ao carregar dados do servidor. Tente atualizar.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handler genérico de salvamento de registros
  const handleSaveRecord = async (sheetName, dataObj, callbackSuccess) => {
    setIsSaving(true);
    try {
      const result = await fetchGAS({
        action: 'saveData',
        sheetName,
        data: dataObj
      });

      showToast(`Registro salvo com sucesso em ${sheetName}!`, 'success');
      if (callbackSuccess) callbackSuccess(result);
      await loadAllData();
      setModalType(null);
      setEditingItem(null);
    } catch (error) {
      console.error(`Erro ao salvar no ${sheetName}:`, error);
      showToast(`Erro ao salvar registro em ${sheetName}.`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handler genérico de exclusão de registros
  const handleDeleteRecord = async () => {
    if (!deleteConfirm) return;
    const { sheetName, id } = deleteConfirm;
    setIsSaving(true);
    try {
      await fetchGAS({
        action: 'deleteData',
        sheetName,
        id
      });
      showToast('Registro excluído com sucesso!', 'success');
      await loadAllData();
      setDeleteConfirm(null);
    } catch (error) {
      console.error(`Erro ao deletar de ${sheetName}:`, error);
      showToast('Erro ao excluir registro.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Conclusão de Tarefa
  const handleToggleTaskCompleted = async (task) => {
    const isNowCompleted = !task.completed;
    const updatedData = {
      ...task,
      completed: isNowCompleted,
      completedDate: isNowCompleted ? new Date().toISOString().split('T')[0] : ''
    };
    await handleSaveRecord('Tarefas', updatedData);
  };

  // Toggle Conclusão de Manutenção de TI
  const handleToggleITCompleted = async (itItem) => {
    const isNowCompleted = !itItem.completed;
    const updatedData = {
      ...itItem,
      completed: isNowCompleted,
      completedDate: isNowCompleted ? new Date().toISOString().split('T')[0] : ''
    };
    await handleSaveRecord('TI', updatedData);
  };

  // Abertura de modais de edição
  const openEditModal = (type, item) => {
    setEditingItem(item);
    setModalType(type);
    if (type === 'task') {
      setTaskForm({
        name: item.name || '',
        sector: item.sector || '',
        status: item.status || TASK_STATUS_OPTIONS[0],
        entryDate: item.entryDate || new Date().toISOString().split('T')[0],
        dueDate: item.dueDate || '',
        notes: item.notes || '',
        completed: Boolean(item.completed)
      });
    } else if (type === 'preventive') {
      setPrevForm({
        name: item.name || '',
        category: item.category || PREVENTIVE_CATEGORY_OPTIONS[0],
        periodicity: item.periodicity || PERIODICITY_OPTIONS[0],
        lastDate: item.lastDate || new Date().toISOString().split('T')[0]
      });
    } else if (type === 'it') {
      setItForm({
        device: item.device || '',
        supplierId: item.supplierId || '',
        supplierName: item.supplierName || '',
        status: item.status || IT_STATUS_OPTIONS[0],
        sendDate: item.sendDate || new Date().toISOString().split('T')[0],
        expectedDate: item.expectedDate || '',
        notes: item.notes || '',
        completed: Boolean(item.completed)
      });
    }
  };

  // Abertura de modais de criação
  const openCreateModal = (type) => {
    setEditingItem(null);
    setModalType(type);
    if (type === 'task') {
      setTaskForm({
        name: '',
        sector: setores.length > 0 ? setores[0].nome : '',
        status: TASK_STATUS_OPTIONS[0],
        entryDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        notes: '',
        completed: false
      });
    } else if (type === 'preventive') {
      setPrevForm({
        name: '',
        category: PREVENTIVE_CATEGORY_OPTIONS[0],
        periodicity: PERIODICITY_OPTIONS[0],
        lastDate: new Date().toISOString().split('T')[0]
      });
    } else if (type === 'it') {
      setItForm({
        device: '',
        supplierId: fornecedores.length > 0 ? fornecedores[0].id : '',
        supplierName: fornecedores.length > 0 ? fornecedores[0].name : '',
        status: IT_STATUS_OPTIONS[0],
        sendDate: new Date().toISOString().split('T')[0],
        expectedDate: '',
        notes: '',
        completed: false
      });
    } else if (type === 'sector') {
      setSectorForm({ nome: '' });
    } else if (type === 'supplier') {
      setSupplierForm({ name: '', contact: '', phone: '', cep: '', city: '', state: '' });
    }
  };

  // Submissão do Formulário de Tarefa
  const handleSubmitTask = (e) => {
    e.preventDefault();
    if (!taskForm.name.trim()) return alert('Informe a descrição da tarefa.');
    const dataObj = {
      ...(editingItem ? { id: editingItem.id } : {}),
      ...taskForm
    };
    handleSaveRecord('Tarefas', dataObj);
  };

  // Submissão do Formulário de Preventiva
  const handleSubmitPreventive = (e) => {
    e.preventDefault();
    if (!prevForm.name.trim()) return alert('Informe o equipamento ou documento.');
    const dataObj = {
      ...(editingItem ? { id: editingItem.id } : {}),
      ...prevForm
    };
    handleSaveRecord('Preventivas', dataObj);
  };

  // Submissão do Formulário de TI
  const handleSubmitIT = (e) => {
    e.preventDefault();
    if (!itForm.device.trim()) return alert('Informe o equipamento.');
    
    // Buscar nome do fornecedor pelo ID selecionado se não estiver preenchido
    let supName = itForm.supplierName;
    if (itForm.supplierId && (!supName || supName === 'N/A')) {
      const foundSup = fornecedores.find(f => String(f.id) === String(itForm.supplierId));
      if (foundSup) supName = foundSup.name;
    }

    const dataObj = {
      ...(editingItem ? { id: editingItem.id } : {}),
      ...itForm,
      supplierName: supName || 'Não Informado'
    };
    handleSaveRecord('TI', dataObj);
  };

  // Submissão de Novo Setor
  const handleSubmitSector = (e) => {
    e.preventDefault();
    if (!sectorForm.nome.trim()) return alert('Informe o nome do setor.');
    handleSaveRecord('Setores', { nome: sectorForm.nome.trim() });
  };

  // Submissão de Novo Fornecedor
  const handleSubmitSupplier = (e) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return alert('Informe o nome do fornecedor.');
    handleSaveRecord('Fornecedores', supplierForm);
  };

  // --- CÁLCULOS E FILTROS DE DADOS ---

  // Cálculo de KPIs de Tarefas
  const taskKPIs = useMemo(() => {
    const total = tarefas.length;
    const completed = tarefas.filter(t => Boolean(t.completed)).length;
    const todayStr = new Date().toISOString().split('T')[0];
    const overdue = tarefas.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr).length;
    const pending = total - completed;
    return { total, completed, overdue, pending };
  }, [tarefas]);

  // Cálculo de KPIs de Preventivas
  const preventiveKPIs = useMemo(() => {
    const total = preventivas.length;
    let urgentCount = 0;
    let okCount = 0;

    preventivas.forEach(p => {
      const nextDate = calculateNextDate(p.lastDate, p.periodicity);
      const days = getDaysRemaining(nextDate);
      if (days !== null && days <= 15) {
        urgentCount++;
      } else {
        okCount++;
      }
    });

    return { total, urgentCount, okCount };
  }, [preventivas]);

  // Cálculo de KPIs de TI
  const itKPIs = useMemo(() => {
    const total = tiItems.length;
    const inProgress = tiItems.filter(i => !i.completed).length;
    const completed = tiItems.filter(i => Boolean(i.completed)).length;
    return { total, inProgress, completed };
  }, [tiItems]);

  // Filtragem de Tarefas
  const filteredTarefas = useMemo(() => {
    return tarefas.filter(t => {
      const term = searchQuery.toLowerCase();
      const matchSearch = !term || 
        (t.name || '').toLowerCase().includes(term) ||
        (t.sector || '').toLowerCase().includes(term) ||
        (t.notes || '').toLowerCase().includes(term);
      const matchStatus = !statusFilter || t.status === statusFilter;
      const matchSector = !sectorFilter || t.sector === sectorFilter;
      return matchSearch && matchStatus && matchSector;
    });
  }, [tarefas, searchQuery, statusFilter, sectorFilter]);

  // Filtragem de Preventivas
  const filteredPreventivas = useMemo(() => {
    return preventivas.filter(p => {
      const term = searchQuery.toLowerCase();
      const matchSearch = !term || (p.name || '').toLowerCase().includes(term);
      const matchCategory = !categoryFilter || p.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [preventivas, searchQuery, categoryFilter]);

  // Filtragem de TI
  const filteredTI = useMemo(() => {
    return tiItems.filter(i => {
      const term = searchQuery.toLowerCase();
      const matchSearch = !term ||
        (i.device || '').toLowerCase().includes(term) ||
        (i.supplierName || '').toLowerCase().includes(term);
      const matchStatus = !statusFilter || i.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tiItems, searchQuery, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-slate-100 p-4 md:p-8 space-y-8">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-5 right-5 z-[200] px-5 py-3 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-3 transition-all animate-bounce ${
          notification.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {notification.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Cabeçalho do Painel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Wrench className="text-indigo-600 w-8 h-8" />
            Gestão <span className="text-indigo-600">Operacional</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Controle de Tarefas, Manutenções Preventivas e Suporte de TI em tempo real
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openCreateModal('sector')}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <Building2 size={16} className="text-indigo-600" />
            + Setor
          </button>
          <button
            onClick={() => openCreateModal('supplier')}
            className="flex items-center gap-2 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <Users size={16} className="text-indigo-600" />
            + Fornecedor
          </button>
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-4 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50"
            title="Atualizar dados"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {/* CARDS DE KPI DE TOPO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeTab === 'tasks' && (
          <>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Tarefas</p>
                <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{taskKPIs.total}</h3>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl">
                <FileText size={24} />
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pendentes</p>
                <h3 className="text-3xl font-extrabold text-amber-600 mt-1">{taskKPIs.pending}</h3>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-xl">
                <Clock size={24} />
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Em Atraso</p>
                <h3 className="text-3xl font-extrabold text-rose-600 mt-1">{taskKPIs.overdue}</h3>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-xl">
                <AlertTriangle size={24} />
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Concluídas</p>
                <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{taskKPIs.completed}</h3>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
                <CheckCircle2 size={24} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'preventive' && (
          <>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Preventivas</p>
                <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{preventiveKPIs.total}</h3>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl">
                <Wrench size={24} />
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Atenção / Vencendo</p>
                <h3 className="text-3xl font-extrabold text-rose-600 mt-1">{preventiveKPIs.urgentCount}</h3>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-xl">
                <AlertTriangle size={24} />
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Em Dia</p>
                <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{preventiveKPIs.okCount}</h3>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
                <CheckCircle2 size={24} />
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Categorias</p>
                <h3 className="text-3xl font-extrabold text-indigo-600 mt-1">{PREVENTIVE_CATEGORY_OPTIONS.length}</h3>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl">
                <Tag size={24} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'it' && (
          <>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Equipamentos TI</p>
                <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{itKPIs.total}</h3>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl">
                <Laptop size={24} />
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Em Manutenção</p>
                <h3 className="text-3xl font-extrabold text-amber-600 mt-1">{itKPIs.inProgress}</h3>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-xl">
                <Clock size={24} />
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Concluídos / Retornados</p>
                <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{itKPIs.completed}</h3>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
                <CheckCircle2 size={24} />
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fornecedores TI</p>
                <h3 className="text-3xl font-extrabold text-indigo-600 mt-1">{fornecedores.length}</h3>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl">
                <Users size={24} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* SISTEMA DE ABAS (TABS) */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 space-x-2">
        <button
          onClick={() => { setActiveTab('tasks'); setSearchQuery(''); setStatusFilter(''); setSectorFilter(''); }}
          className={`px-6 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'tasks'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText size={16} />
          Gestão de Tarefas ({tarefas.length})
        </button>

        <button
          onClick={() => { setActiveTab('preventive'); setSearchQuery(''); setCategoryFilter(''); }}
          className={`px-6 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'preventive'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Wrench size={16} />
          Manutenções Preventivas ({preventivas.length})
        </button>

        <button
          onClick={() => { setActiveTab('it'); setSearchQuery(''); setStatusFilter(''); }}
          className={`px-6 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'it'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Laptop size={16} />
          Informática & TI ({tiItems.length})
        </button>
      </div>

      {/* ÁREA PRINCIPAL DE CONTEÚDO */}
      {isLoading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-16 flex flex-col items-center justify-center space-y-4 shadow-sm">
          <Loader2 className="animate-spin text-indigo-600 w-12 h-12" />
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-wider">
            Sincronizando dados com o Google Apps Script...
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* BARRA DE FILTROS E AÇÃO */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600 transition-all"
                />
              </div>

              {activeTab === 'tasks' && (
                <>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Todos os Status</option>
                    {TASK_STATUS_OPTIONS.map((st, i) => (
                      <option key={i} value={st}>{st}</option>
                    ))}
                  </select>

                  <select
                    value={sectorFilter}
                    onChange={(e) => setSectorFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Todos os Setores</option>
                    {setores.map(s => (
                      <option key={s.id} value={s.nome}>{s.nome}</option>
                    ))}
                  </select>
                </>
              )}

              {activeTab === 'preventive' && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-600"
                >
                  <option value="">Todas as Categorias</option>
                  {PREVENTIVE_CATEGORY_OPTIONS.map((cat, i) => (
                    <option key={i} value={cat}>{cat}</option>
                  ))}
                </select>
              )}

              {activeTab === 'it' && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-600"
                >
                  <option value="">Todos os Status</option>
                  {IT_STATUS_OPTIONS.map((st, i) => (
                    <option key={i} value={st}>{st}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Botão Principal de Adicionar da Aba */}
            <div>
              {activeTab === 'tasks' && (
                <button
                  onClick={() => openCreateModal('task')}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
                >
                  <Plus size={16} /> Nova Tarefa
                </button>
              )}
              {activeTab === 'preventive' && (
                <button
                  onClick={() => openCreateModal('preventive')}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
                >
                  <Plus size={16} /> Nova Preventiva
                </button>
              )}
              {activeTab === 'it' && (
                <button
                  onClick={() => openCreateModal('it')}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
                >
                  <Plus size={16} /> Novo Registro TI
                </button>
              )}
            </div>
          </div>

          {/* TABELA DA ABA 1: TAREFAS */}
          {activeTab === 'tasks' && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200 dark:border-zinc-700">
                    <tr>
                      <th className="px-6 py-4 w-12 text-center">Status</th>
                      <th className="px-6 py-4">Descrição da Tarefa</th>
                      <th className="px-6 py-4">Setor</th>
                      <th className="px-6 py-4">Status Processo</th>
                      <th className="px-6 py-4 text-center">Data Entrada</th>
                      <th className="px-6 py-4 text-center">Data Prazo</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {filteredTarefas.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-medium">
                          Nenhuma tarefa encontrada.
                        </td>
                      </tr>
                    ) : (
                      filteredTarefas.map((t) => {
                        const isCompleted = Boolean(t.completed);
                        const todayStr = new Date().toISOString().split('T')[0];
                        const isOverdue = !isCompleted && t.dueDate && t.dueDate < todayStr;

                        return (
                          <tr key={t.id} className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-all ${
                            isCompleted ? 'bg-slate-50/40 dark:bg-zinc-900/40 opacity-70' : ''
                          }`}>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => handleToggleTaskCompleted(t)}
                                className="text-slate-400 hover:text-indigo-600 transition-colors"
                                title={isCompleted ? "Marcar como pendente" : "Marcar como concluída"}
                              >
                                {isCompleted ? (
                                  <CheckSquare size={20} className="text-emerald-600" />
                                ) : (
                                  <Square size={20} />
                                )}
                              </button>
                            </td>

                            <td className="px-6 py-4">
                              <p className={`font-bold text-slate-800 dark:text-slate-100 ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                                {t.name}
                              </p>
                              {t.notes && (
                                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{t.notes}</p>
                              )}
                            </td>

                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300">
                                <Building2 size={13} className="text-indigo-600" />
                                {t.sector || 'Geral'}
                              </span>
                            </td>

                            <td className="px-6 py-4">
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                {t.status}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                              {t.entryDate ? new Date(t.entryDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                            </td>

                            <td className="px-6 py-4 text-center">
                              {t.dueDate ? (
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                  isCompleted
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : isOverdue
                                      ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                                      : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {new Date(t.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-right space-x-2">
                              <button
                                onClick={() => openEditModal('task', t)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ sheetName: 'Tarefas', id: t.id, name: t.name })}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Deletar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABELA DA ABA 2: PREVENTIVAS */}
          {activeTab === 'preventive' && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200 dark:border-zinc-700">
                    <tr>
                      <th className="px-6 py-4">Equipamento / Documento</th>
                      <th className="px-6 py-4">Categoria</th>
                      <th className="px-6 py-4 text-center">Periodicidade</th>
                      <th className="px-6 py-4 text-center">Última Realização</th>
                      <th className="px-6 py-4 text-center">Próxima Realização</th>
                      <th className="px-6 py-4 text-center">Status / Dias</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {filteredPreventivas.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-medium">
                          Nenhuma preventiva encontrada.
                        </td>
                      </tr>
                    ) : (
                      filteredPreventivas.map((p) => {
                        const nextDate = calculateNextDate(p.lastDate, p.periodicity);
                        const daysRemaining = getDaysRemaining(nextDate);
                        const isUrgent = daysRemaining !== null && daysRemaining <= 15;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-all">
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-800 dark:text-slate-100">{p.name}</p>
                            </td>

                            <td className="px-6 py-4">
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700">
                                {p.category}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-center font-semibold text-slate-600 dark:text-slate-300">
                              {p.periodicity}
                            </td>

                            <td className="px-6 py-4 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                              {p.lastDate ? new Date(p.lastDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                            </td>

                            <td className="px-6 py-4 text-center text-xs font-bold">
                              {nextDate ? nextDate.toLocaleDateString('pt-BR') : '-'}
                            </td>

                            <td className="px-6 py-4 text-center">
                              {daysRemaining !== null ? (
                                <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                                  daysRemaining < 0
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : daysRemaining <= 15
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                }`}>
                                  {daysRemaining < 0 ? `Vencido (${Math.abs(daysRemaining)}d)` : `${daysRemaining} dias`}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-right space-x-2">
                              <button
                                onClick={() => openEditModal('preventive', p)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ sheetName: 'Preventivas', id: p.id, name: p.name })}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Deletar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABELA DA ABA 3: TI & INFORMÁTICA */}
          {activeTab === 'it' && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200 dark:border-zinc-700">
                    <tr>
                      <th className="px-6 py-4 w-12 text-center">Status</th>
                      <th className="px-6 py-4">Equipamento</th>
                      <th className="px-6 py-4">Fornecedor / Assistência</th>
                      <th className="px-6 py-4">Status Manutenção</th>
                      <th className="px-6 py-4 text-center">Data Envio</th>
                      <th className="px-6 py-4 text-center">Data Prevista Retorno</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {filteredTI.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-medium">
                          Nenhum equipamento de TI em manutenção.
                        </td>
                      </tr>
                    ) : (
                      filteredTI.map((i) => {
                        const isCompleted = Boolean(i.completed);

                        return (
                          <tr key={i.id} className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-all ${
                            isCompleted ? 'bg-slate-50/40 dark:bg-zinc-900/40 opacity-70' : ''
                          }`}>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => handleToggleITCompleted(i)}
                                className="text-slate-400 hover:text-indigo-600 transition-colors"
                                title={isCompleted ? "Marcar em aberto" : "Marcar como retornado / concluído"}
                              >
                                {isCompleted ? (
                                  <CheckSquare size={20} className="text-emerald-600" />
                                ) : (
                                  <Square size={20} />
                                )}
                              </button>
                            </td>

                            <td className="px-6 py-4">
                              <p className={`font-bold text-slate-800 dark:text-slate-100 ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                                {i.device}
                              </p>
                              {i.notes && (
                                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{i.notes}</p>
                              )}
                            </td>

                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                                <Users size={13} />
                                {i.supplierName || 'Não Informado'}
                              </span>
                            </td>

                            <td className="px-6 py-4">
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                {i.status}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                              {i.sendDate ? new Date(i.sendDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                            </td>

                            <td className="px-6 py-4 text-center text-xs font-bold text-slate-700 dark:text-slate-300">
                              {i.expectedDate ? new Date(i.expectedDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                            </td>

                            <td className="px-6 py-4 text-right space-x-2">
                              <button
                                onClick={() => openEditModal('it', i)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ sheetName: 'TI', id: i.id, name: i.device })}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Deletar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAIS DO SISTEMA                                                */}
      {/* ================================================================ */}

      {/* MODAL: CRIAR / EDITAR TAREFA */}
      {modalType === 'task' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="text-indigo-600" size={20} />
                {editingItem ? 'Editar Tarefa' : 'Nova Tarefa'}
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Descrição da Tarefa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cotação de manutenção do ar condicionado"
                  value={taskForm.name}
                  onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Setor *
                  </label>
                  <select
                    value={taskForm.sector}
                    onChange={(e) => setTaskForm({ ...taskForm, sector: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Selecione um setor...</option>
                    {setores.map(s => (
                      <option key={s.id} value={s.nome}>{s.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Status do Processo
                  </label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  >
                    {TASK_STATUS_OPTIONS.map((st, i) => (
                      <option key={i} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Data de Entrada
                  </label>
                  <input
                    type="date"
                    value={taskForm.entryDate}
                    onChange={(e) => setTaskForm({ ...taskForm, entryDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Data Limite (Prazo)
                  </label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Observações / Detalhes
                </label>
                <textarea
                  rows="3"
                  placeholder="Informações adicionais sobre o orçamento ou fornecedor..."
                  value={taskForm.notes}
                  onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                ></textarea>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {editingItem ? 'Salvar Alterações' : 'Criar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR PREVENTIVA */}
      {modalType === 'preventive' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench className="text-indigo-600" size={20} />
                {editingItem ? 'Editar Preventiva' : 'Nova Manutenção Preventiva'}
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitPreventive} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Equipamento / Documento / Veículo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Empilhadeira Elétrica Toyota #02 ou Alvará de Bombeiros"
                  value={prevForm.name}
                  onChange={(e) => setPrevForm({ ...prevForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Categoria *
                  </label>
                  <select
                    value={prevForm.category}
                    onChange={(e) => setPrevForm({ ...prevForm, category: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  >
                    {PREVENTIVE_CATEGORY_OPTIONS.map((cat, i) => (
                      <option key={i} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Periodicidade *
                  </label>
                  <select
                    value={prevForm.periodicity}
                    onChange={(e) => setPrevForm({ ...prevForm, periodicity: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  >
                    {PERIODICITY_OPTIONS.map((p, i) => (
                      <option key={i} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Data da Última Realização *
                </label>
                <input
                  type="date"
                  required
                  value={prevForm.lastDate}
                  onChange={(e) => setPrevForm({ ...prevForm, lastDate: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {editingItem ? 'Salvar Alterações' : 'Criar Preventiva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR REGISTRO TI */}
      {modalType === 'it' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Laptop className="text-indigo-600" size={20} />
                {editingItem ? 'Editar Equipamento TI' : 'Enviar Equipamento TI'}
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitIT} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Equipamento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Coletor de Dados Zebra TC21 / Leitor de Código de Barras"
                  value={itForm.device}
                  onChange={(e) => setItForm({ ...itForm, device: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Fornecedor / Assistência *
                  </label>
                  <select
                    value={itForm.supplierId}
                    onChange={(e) => {
                      const selectedSup = fornecedores.find(f => String(f.id) === String(e.target.value));
                      setItForm({
                        ...itForm,
                        supplierId: e.target.value,
                        supplierName: selectedSup ? selectedSup.name : ''
                      });
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Selecione um fornecedor...</option>
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Status do Envio / Reparo
                  </label>
                  <select
                    value={itForm.status}
                    onChange={(e) => setItForm({ ...itForm, status: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  >
                    {IT_STATUS_OPTIONS.map((st, i) => (
                      <option key={i} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Data de Envio
                  </label>
                  <input
                    type="date"
                    value={itForm.sendDate}
                    onChange={(e) => setItForm({ ...itForm, sendDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Previsão de Retorno
                  </label>
                  <input
                    type="date"
                    value={itForm.expectedDate}
                    onChange={(e) => setItForm({ ...itForm, expectedDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Observações / Defeito Relatado
                </label>
                <textarea
                  rows="3"
                  placeholder="Número de série, modelo, problema apresentado..."
                  value={itForm.notes}
                  onChange={(e) => setItForm({ ...itForm, notes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                ></textarea>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {editingItem ? 'Salvar Alterações' : 'Registrar Envio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO SETOR */}
      {modalType === 'sector' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="text-indigo-600" size={20} />
                Cadastrar Novo Setor
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitSector} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nome do Setor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Manutenção, Frios, Logística, Depósito"
                  value={sectorForm.nome}
                  onChange={(e) => setSectorForm({ nome: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  Salvar Setor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO FORNECEDOR */}
      {modalType === 'supplier' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="text-indigo-600" size={20} />
                Cadastrar Fornecedor / Assistência
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplier} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Razão Social / Nome Fantasia *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Assistência Técnica Zebra Brasil Ltd"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Contato Responsável
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Oliveira"
                    value={supplierForm.contact}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="(16) 99999-9999"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    CEP
                  </label>
                  <input
                    type="text"
                    placeholder="14400-000"
                    value={supplierForm.cep}
                    onChange={(e) => setSupplierForm({ ...supplierForm, cep: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    placeholder="Franca"
                    value={supplierForm.city}
                    onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    UF
                  </label>
                  <input
                    type="text"
                    placeholder="SP"
                    maxLength={2}
                    value={supplierForm.state}
                    onChange={(e) => setSupplierForm({ ...supplierForm, state: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  Salvar Fornecedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Confirmar Exclusão</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tem certeza que deseja excluir o registro <strong className="text-slate-800 dark:text-slate-200">"{deleteConfirm.name}"</strong> da aba <strong className="text-indigo-600">{deleteConfirm.sheetName}</strong>?
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteRecord}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
