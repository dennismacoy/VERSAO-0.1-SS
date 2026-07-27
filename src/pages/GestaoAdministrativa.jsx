import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
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
  Wrench,
  CheckSquare,
  Square,
  Eye,
  Settings,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  ListFilter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// URL da API do Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbyatPC_b9psYhtPry34w0R9q2jZkLXnFlZ6oeoWcRUXXPfHE0MClrEiTsnLvUpeOSdDcA/exec";

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

// Utilitário estrito para verificar se um item está concluído (trata strings 'false', '0', etc.)
const isItemCompleted = (item) => {
  if (!item) return false;
  const val = item.completed;
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'sim';
  }
  return false;
};

// Utilitário centralizado para calcular a próxima data da preventiva com base na periodicidade
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

export default function GestaoAdministrativa() {
  const { hasPermission } = useAuth();

  // Abas de navegação: 'tasks' | 'preventive' | 'it' | 'config'
  const [activeTab, setActiveTab] = useState('tasks');

  // Filtro de Ativos vs. Concluídos: 'active' | 'completed' | 'all'
  const [completionFilter, setCompletionFilter] = useState('active');

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

  // Modais de Criação Rápida / Cadastros
  const [modalType, setModalType] = useState(null); // 'task' | 'preventive' | 'it' | 'sector' | 'supplier' | null
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { sheetName, id, name }

  // Modal / Slide-Over de Detalhes e Edição ao Clicar na Linha
  const [selectedDetail, setSelectedDetail] = useState(null); // { item, type: 'task'|'preventive'|'it' }
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [detailForm, setDetailForm] = useState({});

  // Estados dos formulários de modais de criação
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

      if (callbackSuccess) callbackSuccess(result);
      else showToast(`Registro salvo com sucesso em ${sheetName}!`, 'success');

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
      if (selectedDetail && selectedDetail.item.id === id) {
        setSelectedDetail(null);
      }
    } catch (error) {
      console.error(`Erro ao deletar de ${sheetName}:`, error);
      showToast('Erro ao excluir registro.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Conclusão de Tarefa
  const handleToggleTaskCompleted = async (task, e) => {
    if (e) e.stopPropagation();
    const currentlyCompleted = isItemCompleted(task);
    const isNowCompleted = !currentlyCompleted;
    const updatedData = {
      ...task,
      completed: isNowCompleted,
      completedDate: isNowCompleted ? new Date().toISOString().split('T')[0] : ''
    };
    await handleSaveRecord('Tarefas', updatedData, () => {
      showToast(isNowCompleted ? `Tarefa "${task.name}" marcada como concluída!` : `Tarefa "${task.name}" marcada como ativa.`, 'success');
    });
    if (selectedDetail && selectedDetail.item.id === task.id) {
      setSelectedDetail({
        ...selectedDetail,
        item: updatedData
      });
    }
  };

  // Toggle Conclusão de Manutenção de TI
  const handleToggleITCompleted = async (itItem, e) => {
    if (e) e.stopPropagation();
    const currentlyCompleted = isItemCompleted(itItem);
    const isNowCompleted = !currentlyCompleted;
    const updatedData = {
      ...itItem,
      completed: isNowCompleted,
      completedDate: isNowCompleted ? new Date().toISOString().split('T')[0] : ''
    };
    await handleSaveRecord('TI', updatedData, () => {
      showToast(isNowCompleted ? `Equipamento "${itItem.device}" marcado como retornado!` : `Equipamento "${itItem.device}" marcado em aberto.`, 'success');
    });
    if (selectedDetail && selectedDetail.item.id === itItem.id) {
      setSelectedDetail({
        ...selectedDetail,
        item: updatedData
      });
    }
  };

  // REGRA ESPECIAL DE PREVENTIVAS: Renovação Automática do Ciclo
  const handleCompletePreventiveCycle = async (preventiveItem, e) => {
    if (e) e.stopPropagation();
    const todayStr = new Date().toISOString().split('T')[0];
    const nextDateObj = calculateNextDate(todayStr, preventiveItem.periodicity);
    const nextFormatted = nextDateObj ? nextDateObj.toLocaleDateString('pt-BR') : 'próximo ciclo';

    const updatedPreventive = {
      ...preventiveItem,
      lastDate: todayStr
    };

    await handleSaveRecord('Preventivas', updatedPreventive, () => {
      showToast(
        `Preventiva "${preventiveItem.name}" renovada com sucesso! Nova realização: ${new Date(todayStr + 'T00:00:00').toLocaleDateString('pt-BR')}. Próximo vencimento: ${nextFormatted}.`,
        'success'
      );
    });

    if (selectedDetail && selectedDetail.item.id === preventiveItem.id) {
      setSelectedDetail({
        ...selectedDetail,
        item: updatedPreventive
      });
    }
  };

  // Abertura do Modal de Detalhes / Edição ao clicar em uma linha
  const openRowDetail = (item, type, editDirectly = false) => {
    setSelectedDetail({ item, type });
    setIsEditingModal(editDirectly);
    setDetailForm({ ...item });
  };

  // Submissão do Modal de Edição (Visualização & Edição)
  const handleSaveDetailModal = async (e) => {
    e.preventDefault();
    if (!selectedDetail) return;

    const { type, item } = selectedDetail;
    let sheetName = 'Tarefas';
    if (type === 'preventive') sheetName = 'Preventivas';
    if (type === 'it') sheetName = 'TI';

    let dataObj = { id: item.id, ...detailForm };

    if (type === 'it') {
      let supName = detailForm.supplierName;
      if (detailForm.supplierId && (!supName || supName === 'N/A')) {
        const foundSup = fornecedores.find(f => String(f.id) === String(detailForm.supplierId));
        if (foundSup) supName = foundSup.name;
      }
      dataObj.supplierName = supName || 'Não Informado';
    }

    await handleSaveRecord(sheetName, dataObj, () => {
      showToast(`Alterações salvas com sucesso!`, 'success');
      setSelectedDetail({ item: dataObj, type });
      setIsEditingModal(false);
    });
  };

  // Modais de Criação Rápida
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

  // Editar Setor / Fornecedor na Aba 4
  const openEditBaseModal = (type, item) => {
    setEditingItem(item);
    setModalType(type);
    if (type === 'sector') {
      setSectorForm({ nome: item.nome || '' });
    } else if (type === 'supplier') {
      setSupplierForm({
        name: item.name || '',
        contact: item.contact || '',
        phone: item.phone || '',
        cep: item.cep || '',
        city: item.city || '',
        state: item.state || ''
      });
    }
  };

  // CORREÇÃO: Submissão do Formulário de Tarefa garantindo completed: false em tarefas novas
  const handleSubmitTask = (e) => {
    e.preventDefault();
    if (!taskForm.name.trim()) return alert('Informe a descrição da tarefa.');
    const isEdit = Boolean(editingItem);
    const dataObj = {
      ...(isEdit ? { id: editingItem.id } : {}),
      ...taskForm,
      completed: isEdit ? isItemCompleted(taskForm) : false,
      completedDate: isEdit && isItemCompleted(taskForm) ? (taskForm.completedDate || new Date().toISOString().split('T')[0]) : ''
    };
    handleSaveRecord('Tarefas', dataObj, () => {
      showToast(isEdit ? 'Tarefa atualizada com sucesso!' : 'Nova tarefa criada com sucesso!', 'success');
    });
  };

  // Submissão do Formulário de Preventiva
  const handleSubmitPreventive = (e) => {
    e.preventDefault();
    if (!prevForm.name.trim()) return alert('Informe o equipamento ou documento.');
    const dataObj = {
      ...(editingItem ? { id: editingItem.id } : {}),
      ...prevForm
    };
    handleSaveRecord('Preventivas', dataObj, () => {
      showToast('Nova manutenção preventiva salva!', 'success');
    });
  };

  // Submissão do Formulário de TI
  const handleSubmitIT = (e) => {
    e.preventDefault();
    if (!itForm.device.trim()) return alert('Informe o equipamento.');

    let supName = itForm.supplierName;
    if (itForm.supplierId && (!supName || supName === 'N/A')) {
      const foundSup = fornecedores.find(f => String(f.id) === String(itForm.supplierId));
      if (foundSup) supName = foundSup.name;
    }

    const isEdit = Boolean(editingItem);
    const dataObj = {
      ...(isEdit ? { id: editingItem.id } : {}),
      ...itForm,
      supplierName: supName || 'Não Informado',
      completed: isEdit ? isItemCompleted(itForm) : false,
      completedDate: isEdit && isItemCompleted(itForm) ? (itForm.completedDate || new Date().toISOString().split('T')[0]) : ''
    };
    handleSaveRecord('TI', dataObj, () => {
      showToast('Novo registro de TI adicionado!', 'success');
    });
  };

  // Submissão de Novo Setor
  const handleSubmitSector = (e) => {
    e.preventDefault();
    if (!sectorForm.nome.trim()) return alert('Informe o nome do setor.');
    const dataObj = {
      ...(editingItem ? { id: editingItem.id } : {}),
      nome: sectorForm.nome.trim()
    };
    handleSaveRecord('Setores', dataObj, () => {
      showToast('Setor salvo com sucesso!', 'success');
    });
  };

  // Submissão de Novo Fornecedor
  const handleSubmitSupplier = (e) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return alert('Informe o nome do fornecedor.');
    const dataObj = {
      ...(editingItem ? { id: editingItem.id } : {}),
      ...supplierForm
    };
    handleSaveRecord('Fornecedores', dataObj, () => {
      showToast('Fornecedor salvo com sucesso!', 'success');
    });
  };

  // --- CÁLCULOS E FILTROS DE DADOS ---

  // Cálculo de KPIs de Tarefas usando isItemCompleted
  const taskKPIs = useMemo(() => {
    const total = tarefas.length;
    const completed = tarefas.filter(t => isItemCompleted(t)).length;
    const todayStr = new Date().toISOString().split('T')[0];
    const overdue = tarefas.filter(t => !isItemCompleted(t) && t.dueDate && t.dueDate < todayStr).length;
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

  // Cálculo de KPIs de TI usando isItemCompleted
  const itKPIs = useMemo(() => {
    const total = tiItems.length;
    const inProgress = tiItems.filter(i => !isItemCompleted(i)).length;
    const completed = tiItems.filter(i => isItemCompleted(i)).length;
    return { total, inProgress, completed };
  }, [tiItems]);

  // CORREÇÃO: Filtragem de Tarefas usando isItemCompleted
  const filteredTarefas = useMemo(() => {
    return tarefas.filter(t => {
      const completed = isItemCompleted(t);
      if (completionFilter === 'active' && completed) return false;
      if (completionFilter === 'completed' && !completed) return false;

      const term = searchQuery.toLowerCase();
      const matchSearch = !term ||
        (t.name || '').toLowerCase().includes(term) ||
        (t.sector || '').toLowerCase().includes(term) ||
        (t.notes || '').toLowerCase().includes(term);
      const matchStatus = !statusFilter || t.status === statusFilter;
      const matchSector = !sectorFilter || t.sector === sectorFilter;
      return matchSearch && matchStatus && matchSector;
    });
  }, [tarefas, completionFilter, searchQuery, statusFilter, sectorFilter]);

  // Filtragem de Preventivas
  const filteredPreventivas = useMemo(() => {
    return preventivas.filter(p => {
      const nextDate = calculateNextDate(p.lastDate, p.periodicity);
      const daysRemaining = getDaysRemaining(nextDate);
      const isUrgent = daysRemaining !== null && daysRemaining <= 15;

      if (completionFilter === 'active' && !isUrgent && completionFilter !== 'all') {
        // No caso das preventivas, 'active' traz todas as ativas do ciclo
      }

      const term = searchQuery.toLowerCase();
      const matchSearch = !term || (p.name || '').toLowerCase().includes(term);
      const matchCategory = !categoryFilter || p.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [preventivas, completionFilter, searchQuery, categoryFilter]);

  // CORREÇÃO: Filtragem de TI usando isItemCompleted
  const filteredTI = useMemo(() => {
    return tiItems.filter(i => {
      const completed = isItemCompleted(i);
      if (completionFilter === 'active' && completed) return false;
      if (completionFilter === 'completed' && !completed) return false;

      const term = searchQuery.toLowerCase();
      const matchSearch = !term ||
        (i.device || '').toLowerCase().includes(term) ||
        (i.supplierName || '').toLowerCase().includes(term);
      const matchStatus = !statusFilter || i.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tiItems, completionFilter, searchQuery, statusFilter]);

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
            <Building2 className="text-green-600 w-8 h-8" />
            Gestão <span className="text-green-600">Administrativa</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Controle de Tarefas, Manutenções Preventivas, Suporte de TI e Cadastros Base
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="flex items-center gap-2 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/60 px-4 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50"
            title="Atualizar dados do servidor"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Sincronizar
          </button>
        </div>
      </div>

      {/* CARDS DE KPI DE TOPO */}
      {activeTab !== 'config' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeTab === 'tasks' && (
            <>
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Tarefas</p>
                  <h3 className="text-3xl font-extrabold text-green-600 mt-1">{taskKPIs.total}</h3>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950/50 text-green-600 rounded-xl">
                  <FileText size={24} />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pendentes / Ativas</p>
                  <h3 className="text-3xl font-extrabold text-orange-500 mt-1">{taskKPIs.pending}</h3>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-orange-950/50 text-orange-500 rounded-xl">
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
                  <h3 className="text-3xl font-extrabold text-green-600 mt-1">{preventiveKPIs.total}</h3>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950/50 text-green-600 rounded-xl">
                  <Wrench size={24} />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Atenção / Vencendo</p>
                  <h3 className="text-3xl font-extrabold text-orange-500 mt-1">{preventiveKPIs.urgentCount}</h3>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-orange-950/50 text-orange-500 rounded-xl">
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
                  <h3 className="text-3xl font-extrabold text-green-600 mt-1">{PREVENTIVE_CATEGORY_OPTIONS.length}</h3>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950/50 text-green-600 rounded-xl">
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
                  <h3 className="text-3xl font-extrabold text-green-600 mt-1">{itKPIs.total}</h3>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950/50 text-green-600 rounded-xl">
                  <Laptop size={24} />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Em Manutenção</p>
                  <h3 className="text-3xl font-extrabold text-orange-500 mt-1">{itKPIs.inProgress}</h3>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-orange-950/50 text-orange-500 rounded-xl">
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
                  <h3 className="text-3xl font-extrabold text-green-600 mt-1">{fornecedores.length}</h3>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950/50 text-green-600 rounded-xl">
                  <Users size={24} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* SISTEMA DE ABAS (4 ABAS: TAREFAS, PREVENTIVAS, TI, CONFIGURAÇÕES) */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 space-x-2 overflow-x-auto">
        <button
          onClick={() => { setActiveTab('tasks'); setSearchQuery(''); setStatusFilter(''); setSectorFilter(''); }}
          className={`px-5 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'tasks'
              ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-950/30 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText size={16} />
          Gestão de Tarefas ({tarefas.length})
        </button>

        <button
          onClick={() => { setActiveTab('preventive'); setSearchQuery(''); setCategoryFilter(''); }}
          className={`px-5 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'preventive'
              ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-950/30 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Wrench size={16} />
          Manutenções Preventivas ({preventivas.length})
        </button>

        <button
          onClick={() => { setActiveTab('it'); setSearchQuery(''); setStatusFilter(''); }}
          className={`px-5 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'it'
              ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-950/30 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Laptop size={16} />
          Informática & TI ({tiItems.length})
        </button>

        <button
          onClick={() => { setActiveTab('config'); setSearchQuery(''); }}
          className={`px-5 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'config'
              ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-950/30 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Settings size={16} />
          ⚙️ Configurações
        </button>
      </div>

      {/* ÁREA PRINCIPAL DE CONTEÚDO */}
      {isLoading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-16 flex flex-col items-center justify-center space-y-4 shadow-sm">
          <Loader2 className="animate-spin text-green-600 w-12 h-12" />
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-wider">
            Sincronizando dados com o Google Apps Script...
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* BARRA DE FILTROS E TOGGLE ATIVOS / CONCLUÍDOS */}
          {activeTab !== 'config' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Pesquisar..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600 transition-all"
                    />
                  </div>

                  {activeTab === 'tasks' && (
                    <>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-green-600"
                      >
                        <option value="">Todos os Status</option>
                        {TASK_STATUS_OPTIONS.map((st, i) => (
                          <option key={i} value={st}>{st}</option>
                        ))}
                      </select>

                      <select
                        value={sectorFilter}
                        onChange={(e) => setSectorFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-green-600"
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
                      className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-green-600"
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
                      className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-green-600"
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
                      className="w-full md:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
                    >
                      <Plus size={16} /> Nova Tarefa
                    </button>
                  )}
                  {activeTab === 'preventive' && (
                    <button
                      onClick={() => openCreateModal('preventive')}
                      className="w-full md:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
                    >
                      <Plus size={16} /> Nova Preventiva
                    </button>
                  )}
                  {activeTab === 'it' && (
                    <button
                      onClick={() => openCreateModal('it')}
                      className="w-full md:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
                    >
                      <Plus size={16} /> Novo Registro TI
                    </button>
                  )}
                </div>
              </div>

              {/* SELETOR DE STATUS: ATIVOS VS CONCLUÍDOS */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1">
                  <ListFilter size={14} /> Exibir:
                </span>
                <button
                  onClick={() => setCompletionFilter('active')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    completionFilter === 'active'
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50'
                  }`}
                >
                  Pendentes / Ativos ({activeTab === 'tasks' ? taskKPIs.pending : activeTab === 'it' ? itKPIs.inProgress : preventiveKPIs.total})
                </button>
                <button
                  onClick={() => setCompletionFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    completionFilter === 'completed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50'
                  }`}
                >
                  Concluídos ({activeTab === 'tasks' ? taskKPIs.completed : activeTab === 'it' ? itKPIs.completed : preventiveKPIs.okCount})
                </button>
                <button
                  onClick={() => setCompletionFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    completionFilter === 'all'
                      ? 'bg-green-600 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50'
                  }`}
                >
                  Todos os Itens
                </button>
              </div>
            </div>
          )}

          {/* TABELA DA ABA 1: TAREFAS (COM PARSE ESTRITO DE COMPLETED) */}
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
                      <th className="px-6 py-4 text-right">Ações Rápidas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {filteredTarefas.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-medium">
                          Nenhuma tarefa encontrada para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredTarefas.map((t) => {
                        const isCompleted = isItemCompleted(t);
                        const todayStr = new Date().toISOString().split('T')[0];
                        const isOverdue = !isCompleted && t.dueDate && t.dueDate < todayStr;

                        return (
                          <tr
                            key={t.id}
                            onClick={() => openRowDetail(t, 'task')}
                            className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors ${
                              isCompleted ? 'bg-slate-50/40 dark:bg-zinc-900/40 opacity-70' : ''
                            }`}
                          >
                            <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleToggleTaskCompleted(t, e)}
                                className="text-slate-400 hover:text-green-600 transition-colors"
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
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300">
                                <Building2 size={13} className="text-green-600" />
                                {t.sector || 'Geral'}
                              </span>
                            </td>

                            <td className="px-6 py-4">
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
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

                            {/* AÇÕES RÁPIDAS NA LINHA */}
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRowDetail(t, 'task', true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-colors flex items-center gap-1"
                                  title="Editar Tarefa"
                                >
                                  <Edit2 size={13} /> Editar
                                </button>
                                <button
                                  onClick={(e) => handleToggleTaskCompleted(t, e)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                                    isCompleted
                                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                                  }`}
                                  title={isCompleted ? "Reabrir tarefa" : "Concluir tarefa"}
                                >
                                  <CheckCircle2 size={13} /> {isCompleted ? 'Desfazer' : 'Concluir'}
                                </button>
                              </div>
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
                      <th className="px-6 py-4 text-right">Ações Rápidas</th>
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

                        return (
                          <tr
                            key={p.id}
                            onClick={() => openRowDetail(p, 'preventive')}
                            className="cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                          >
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
                                      ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                }`}>
                                  {daysRemaining < 0 ? `Vencido (${Math.abs(daysRemaining)}d)` : `${daysRemaining} dias`}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </td>

                            {/* AÇÕES RÁPIDAS NA LINHA */}
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRowDetail(p, 'preventive', true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-colors flex items-center gap-1"
                                  title="Editar Preventiva"
                                >
                                  <Edit2 size={13} /> Editar
                                </button>
                                <button
                                  onClick={(e) => handleCompletePreventiveCycle(p, e)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors flex items-center gap-1"
                                  title="Registrar manutenção realizada hoje e renovar ciclo"
                                >
                                  <RotateCcw size={13} /> Concluir & Renovar
                                </button>
                              </div>
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
                      <th className="px-6 py-4 text-right">Ações Rápidas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {filteredTI.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-medium">
                          Nenhum equipamento de TI encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredTI.map((i) => {
                        const isCompleted = isItemCompleted(i);

                        return (
                          <tr
                            key={i.id}
                            onClick={() => openRowDetail(i, 'it')}
                            className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors ${
                              isCompleted ? 'bg-slate-50/40 dark:bg-zinc-900/40 opacity-70' : ''
                            }`}
                          >
                            <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleToggleITCompleted(i, e)}
                                className="text-slate-400 hover:text-green-600 transition-colors"
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
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300">
                                <Users size={13} />
                                {i.supplierName || 'Não Informado'}
                              </span>
                            </td>

                            <td className="px-6 py-4">
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                                {i.status}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                              {i.sendDate ? new Date(i.sendDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                            </td>

                            <td className="px-6 py-4 text-center text-xs font-bold text-slate-700 dark:text-slate-300">
                              {i.expectedDate ? new Date(i.expectedDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                            </td>

                            {/* AÇÕES RÁPIDAS NA LINHA */}
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRowDetail(i, 'it', true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-colors flex items-center gap-1"
                                  title="Editar Equipamento TI"
                                >
                                  <Edit2 size={13} /> Editar
                                </button>
                                <button
                                  onClick={(e) => handleToggleITCompleted(i, e)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                                    isCompleted
                                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                                  }`}
                                  title={isCompleted ? "Marcar em manutenção" : "Marcar como retornado"}
                                >
                                  <CheckCircle2 size={13} /> {isCompleted ? 'Desfazer' : 'Retornado'}
                                </button>
                              </div>
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

          {/* ABA 4: CONFIGURAÇÕES */}
          {activeTab === 'config' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                  <Settings className="text-green-600" size={22} />
                  Gestão de Cadastros Base
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Gerencie os Setores da empresa e os Fornecedores/Assistências Técnicas parceiras para uso nas Tarefas e Manutenções.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* SEÇÃO 1: TABELA DE SETORES */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-base">
                      <Building2 size={18} className="text-green-600" />
                      Setores ({setores.length})
                    </h3>
                    <button
                      onClick={() => openCreateModal('sector')}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all text-xs uppercase tracking-wider"
                    >
                      <Plus size={14} /> Novo Setor
                    </button>
                  </div>

                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200 dark:border-zinc-700">
                        <tr>
                          <th className="px-5 py-3 w-16">ID</th>
                          <th className="px-5 py-3">Nome do Setor</th>
                          <th className="px-5 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {setores.length === 0 ? (
                          <tr>
                            <td colSpan="3" className="px-5 py-8 text-center text-slate-400 font-medium">
                              Nenhum setor cadastrado.
                            </td>
                          </tr>
                        ) : (
                          setores.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                              <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">#{s.id}</td>
                              <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-slate-100">{s.nome}</td>
                              <td className="px-5 py-3.5 text-right space-x-1">
                                <button
                                  onClick={() => openEditBaseModal('sector', s)}
                                  className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                  title="Editar Setor"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ sheetName: 'Setores', id: s.id, name: s.nome })}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                  title="Deletar Setor"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SEÇÃO 2: TABELA DE FORNECEDORES */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-base">
                      <Users size={18} className="text-orange-500" />
                      Fornecedores & Assistências ({fornecedores.length})
                    </h3>
                    <button
                      onClick={() => openCreateModal('supplier')}
                      className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all text-xs uppercase tracking-wider"
                    >
                      <Plus size={14} /> Novo Fornecedor
                    </button>
                  </div>

                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200 dark:border-zinc-700">
                        <tr>
                          <th className="px-5 py-3">Fornecedor</th>
                          <th className="px-5 py-3">Contato / Telefone</th>
                          <th className="px-5 py-3">Cidade / UF</th>
                          <th className="px-5 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {fornecedores.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="px-5 py-8 text-center text-slate-400 font-medium">
                              Nenhum fornecedor cadastrado.
                            </td>
                          </tr>
                        ) : (
                          fornecedores.map((f) => (
                            <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                              <td className="px-5 py-3.5">
                                <p className="font-bold text-slate-800 dark:text-slate-100">{f.name}</p>
                              </td>
                              <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                                {f.contact && <p className="font-semibold">{f.contact}</p>}
                                {f.phone && <p className="text-slate-400 flex items-center gap-1"><Phone size={11} /> {f.phone}</p>}
                              </td>
                              <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                                {f.city ? `${f.city}${f.state ? ` / ${f.state}` : ''}` : '-'}
                              </td>
                              <td className="px-5 py-3.5 text-right space-x-1">
                                <button
                                  onClick={() => openEditBaseModal('supplier', f)}
                                  className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                  title="Editar Fornecedor"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ sheetName: 'Fornecedores', id: f.id, name: f.name })}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                  title="Deletar Fornecedor"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL DE DETALHES E EDIÇÃO AO CLICAR EM UMA LINHA                 */}
      {/* ================================================================ */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header do Modal */}
            <div className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300">
                  {selectedDetail.type === 'task' && 'Detalhes da Tarefa'}
                  {selectedDetail.type === 'preventive' && 'Detalhes da Preventiva'}
                  {selectedDetail.type === 'it' && 'Detalhes do Equipamento TI'}
                </span>
                <h3 className="font-extrabold text-xl text-slate-900 dark:text-white mt-1.5">
                  {selectedDetail.item.name || selectedDetail.item.device}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* CONTEÚDO DO MODAL: MODO VISUALIZAÇÃO OU MODO EDIÇÃO */}
            {!isEditingModal ? (
              /* --- MODO VISUALIZAÇÃO --- */
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Status do Processo */}
                  <div className="bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Atual</p>
                    <p className="text-base font-extrabold text-orange-600 mt-1">
                      {selectedDetail.item.status || selectedDetail.item.category || 'Em Andamento'}
                    </p>
                  </div>

                  {/* Setor / Fornecedor */}
                  <div className="bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {selectedDetail.type === 'it' ? 'Fornecedor / Assistência' : 'Setor Vinculado'}
                    </p>
                    <p className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                      {selectedDetail.item.sector || selectedDetail.item.supplierName || 'Geral'}
                    </p>
                  </div>

                  {/* Datas Relevantes */}
                  {selectedDetail.type === 'task' && (
                    <>
                      <div className="bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data de Entrada</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                          {selectedDetail.item.entryDate ? new Date(selectedDetail.item.entryDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data Prazo</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                          {selectedDetail.item.dueDate ? new Date(selectedDetail.item.dueDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </p>
                      </div>
                    </>
                  )}

                  {selectedDetail.type === 'preventive' && (
                    <>
                      <div className="bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Periodicidade</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                          {selectedDetail.item.periodicity}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Última Realização</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                          {selectedDetail.item.lastDate ? new Date(selectedDetail.item.lastDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </p>
                      </div>
                    </>
                  )}

                  {selectedDetail.type === 'it' && (
                    <>
                      <div className="bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data de Envio</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                          {selectedDetail.item.sendDate ? new Date(selectedDetail.item.sendDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Previsão Retorno</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                          {selectedDetail.item.expectedDate ? new Date(selectedDetail.item.expectedDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Observações / Notas */}
                {selectedDetail.item.notes && (
                  <div className="bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-slate-100 dark:border-zinc-800">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Observações / Detalhes</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line">
                      {selectedDetail.item.notes}
                    </p>
                  </div>
                )}

                {/* Ações de Rodapé no Modo Visualização */}
                <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-3">
                  <div className="flex gap-2">
                    {selectedDetail.type === 'task' && (
                      <button
                        onClick={() => handleToggleTaskCompleted(selectedDetail.item)}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 border transition-all ${
                          isItemCompleted(selectedDetail.item)
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <CheckSquare size={16} />
                        {isItemCompleted(selectedDetail.item) ? 'Concluída' : 'Marcar Concluída'}
                      </button>
                    )}
                    {selectedDetail.type === 'preventive' && (
                      <button
                        onClick={() => handleCompletePreventiveCycle(selectedDetail.item)}
                        className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-all"
                      >
                        <RotateCcw size={16} />
                        Concluir & Renovar Ciclo
                      </button>
                    )}
                    {selectedDetail.type === 'it' && (
                      <button
                        onClick={() => handleToggleITCompleted(selectedDetail.item)}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 border transition-all ${
                          isItemCompleted(selectedDetail.item)
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <CheckSquare size={16} />
                        {isItemCompleted(selectedDetail.item) ? 'Retornado / Concluído' : 'Marcar Retornado'}
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirm({
                        sheetName: selectedDetail.type === 'task' ? 'Tarefas' : selectedDetail.type === 'preventive' ? 'Preventivas' : 'TI',
                        id: selectedDetail.item.id,
                        name: selectedDetail.item.name || selectedDetail.item.device
                      })}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingModal(true);
                        setDetailForm({ ...selectedDetail.item });
                      }}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all flex items-center gap-2"
                    >
                      <Edit2 size={16} /> Editar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* --- MODO EDIÇÃO --- */
              <form onSubmit={handleSaveDetailModal} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    {selectedDetail.type === 'it' ? 'Equipamento *' : 'Descrição / Nome *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={detailForm.name ?? detailForm.device ?? ''}
                    onChange={(e) => {
                      if (selectedDetail.type === 'it') setDetailForm({ ...detailForm, device: e.target.value });
                      else setDetailForm({ ...detailForm, name: e.target.value });
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                  />
                </div>

                {selectedDetail.type === 'task' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Setor
                      </label>
                      <select
                        value={detailForm.sector || ''}
                        onChange={(e) => setDetailForm({ ...detailForm, sector: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                      >
                        <option value="">Selecione...</option>
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
                        value={detailForm.status || TASK_STATUS_OPTIONS[0]}
                        onChange={(e) => setDetailForm({ ...detailForm, status: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                      >
                        {TASK_STATUS_OPTIONS.map((st, i) => (
                          <option key={i} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {selectedDetail.type === 'preventive' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Categoria
                      </label>
                      <select
                        value={detailForm.category || PREVENTIVE_CATEGORY_OPTIONS[0]}
                        onChange={(e) => setDetailForm({ ...detailForm, category: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                      >
                        {PREVENTIVE_CATEGORY_OPTIONS.map((cat, i) => (
                          <option key={i} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Periodicidade
                      </label>
                      <select
                        value={detailForm.periodicity || PERIODICITY_OPTIONS[0]}
                        onChange={(e) => setDetailForm({ ...detailForm, periodicity: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                      >
                        {PERIODICITY_OPTIONS.map((p, i) => (
                          <option key={i} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {selectedDetail.type === 'it' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Fornecedor / Assistência
                      </label>
                      <select
                        value={detailForm.supplierId || ''}
                        onChange={(e) => {
                          const selectedSup = fornecedores.find(f => String(f.id) === String(e.target.value));
                          setDetailForm({
                            ...detailForm,
                            supplierId: e.target.value,
                            supplierName: selectedSup ? selectedSup.name : ''
                          });
                        }}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                      >
                        <option value="">Selecione...</option>
                        {fornecedores.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Status Manutenção
                      </label>
                      <select
                        value={detailForm.status || IT_STATUS_OPTIONS[0]}
                        onChange={(e) => setDetailForm({ ...detailForm, status: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                      >
                        {IT_STATUS_OPTIONS.map((st, i) => (
                          <option key={i} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Datas no Modo Edição */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedDetail.type === 'task' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Data Entrada
                        </label>
                        <input
                          type="date"
                          value={detailForm.entryDate || ''}
                          onChange={(e) => setDetailForm({ ...detailForm, entryDate: e.target.value })}
                          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Data Prazo
                        </label>
                        <input
                          type="date"
                          value={detailForm.dueDate || ''}
                          onChange={(e) => setDetailForm({ ...detailForm, dueDate: e.target.value })}
                          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                        />
                      </div>
                    </>
                  )}

                  {selectedDetail.type === 'preventive' && (
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Última Realização
                      </label>
                      <input
                        type="date"
                        value={detailForm.lastDate || ''}
                        onChange={(e) => setDetailForm({ ...detailForm, lastDate: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                      />
                    </div>
                  )}

                  {selectedDetail.type === 'it' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Data Envio
                        </label>
                        <input
                          type="date"
                          value={detailForm.sendDate || ''}
                          onChange={(e) => setDetailForm({ ...detailForm, sendDate: e.target.value })}
                          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Previsão Retorno
                        </label>
                        <input
                          type="date"
                          value={detailForm.expectedDate || ''}
                          onChange={(e) => setDetailForm({ ...detailForm, expectedDate: e.target.value })}
                          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Observações / Detalhes
                  </label>
                  <textarea
                    rows="3"
                    value={detailForm.notes || ''}
                    onChange={(e) => setDetailForm({ ...detailForm, notes: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
                  ></textarea>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditingModal(false)}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                  >
                    Cancelar Edição
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                    Salvar Alterações
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAIS DE CRIAÇÃO / EDIÇÃO DE SETOR & FORNECEDOR */}
      {modalType === 'task' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="text-green-600" size={20} />
                Nova Tarefa
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
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  Criar Tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR PREVENTIVA */}
      {modalType === 'preventive' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench className="text-green-600" size={20} />
                Nova Manutenção Preventiva
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
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  Criar Preventiva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR REGISTRO TI */}
      {modalType === 'it' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Laptop className="text-green-600" size={20} />
                Enviar Equipamento TI
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
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  Registrar Envio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR SETOR */}
      {modalType === 'sector' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="text-green-600" size={20} />
                {editingItem ? 'Editar Setor' : 'Cadastrar Novo Setor'}
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
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  Salvar Setor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR FORNECEDOR */}
      {modalType === 'supplier' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="text-orange-500" size={20} />
                {editingItem ? 'Editar Fornecedor' : 'Cadastrar Fornecedor / Assistência'}
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
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-green-600"
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
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-orange-500 hover:bg-orange-600 text-white shadow-md flex items-center gap-2 disabled:opacity-50"
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
                Tem certeza que deseja excluir o registro <strong className="text-slate-800 dark:text-slate-200">"{deleteConfirm.name}"</strong> da aba <strong className="text-green-600">{deleteConfirm.sheetName}</strong>?
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
