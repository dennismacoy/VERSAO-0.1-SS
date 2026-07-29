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

  // Submissão do Formulário de Tarefa
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

  const taskKPIs = useMemo(() => {
    const total = tarefas.length;
    const completed = tarefas.filter(t => isItemCompleted(t)).length;
    const todayStr = new Date().toISOString().split('T')[0];
    const overdue = tarefas.filter(t => !isItemCompleted(t) && t.dueDate && t.dueDate < todayStr).length;
    const pending = total - completed;
    return { total, completed, overdue, pending };
  }, [tarefas]);

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

  const itKPIs = useMemo(() => {
    const total = tiItems.length;
    const inProgress = tiItems.filter(i => !isItemCompleted(i)).length;
    const completed = tiItems.filter(i => isItemCompleted(i)).length;
    return { total, inProgress, completed };
  }, [tiItems]);

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

  const filteredPreventivas = useMemo(() => {
    return preventivas.filter(p => {
      const nextDate = calculateNextDate(p.lastDate, p.periodicity);
      const daysRemaining = getDaysRemaining(nextDate);
      const isUrgent = daysRemaining !== null && daysRemaining <= 15;

      if (completionFilter === 'active' && !isUrgent && completionFilter !== 'all') {
        // no-op for preventivas
      }

      const term = searchQuery.toLowerCase();
      const matchSearch = !term || (p.name || '').toLowerCase().includes(term);
      const matchCategory = !categoryFilter || p.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [preventivas, completionFilter, searchQuery, categoryFilter]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-slate-100 p-2 sm:p-4 md:p-8 space-y-4 md:space-y-8">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 left-4 sm:left-auto sm:max-w-md z-[200] px-4 py-3 rounded-xl shadow-2xl font-bold text-xs sm:text-sm flex items-center gap-3 transition-all animate-bounce ${
          notification.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {notification.type === 'error' ? <AlertTriangle size={18} className="flex-shrink-0" /> : <CheckCircle2 size={18} className="flex-shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* CABEÇALHO DA PÁGINA (COMPACTO NO MOBILE) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-zinc-800 pb-4 md:pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 md:gap-3">
            <Building2 className="text-green-600 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
            Gestão <span className="text-green-600">Administrativa</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Tarefas, Manutenções, TI e Cadastros Base
          </p>
        </div>

        <button
          onClick={loadAllData}
          disabled={isLoading}
          className="self-end sm:self-auto flex items-center gap-2 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/60 px-3 py-2 md:px-4 md:py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50"
          title="Sincronizar dados"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          Sincronizar
        </button>
      </div>

      {/* CARDS DE KPI DE TOPO (2 COLUNAS NO MOBILE, 4 NO DESKTOP) */}
      {activeTab !== 'config' && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {activeTab === 'tasks' && (
            <>
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Tarefas</p>
                  <h3 className="text-xl sm:text-3xl font-extrabold text-green-600 mt-0.5">{taskKPIs.total}</h3>
                </div>
                <div className="p-2 sm:p-3 bg-green-50 dark:bg-green-950/50 text-green-600 rounded-xl">
                  <FileText size={18} className="sm:w-6 sm:h-6" />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ativas / Pendentes</p>
                  <h3 className="text-xl sm:text-3xl font-extrabold text-orange-500 mt-0.5">{taskKPIs.pending}</h3>
                </div>
                <div className="p-2 sm:p-3 bg-orange-50 dark:bg-orange-950/50 text-orange-500 rounded-xl">
                  <Clock size={18} className="sm:w-6 sm:h-6" />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Em Atraso</p>
                  <h3 className="text-xl sm:text-3xl font-extrabold text-rose-600 mt-0.5">{taskKPIs.overdue}</h3>
                </div>
                <div className="p-2 sm:p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-xl">
                  <AlertTriangle size={18} className="sm:w-6 sm:h-6" />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Concluídas</p>
                  <h3 className="text-xl sm:text-3xl font-extrabold text-emerald-600 mt-0.5">{taskKPIs.completed}</h3>
                </div>
                <div className="p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
                  <CheckCircle2 size={18} className="sm:w-6 sm:h-6" />
                </div>
              </div>
            </>
          )}

          {activeTab === 'preventive' && (
            <>
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Preventivas</p>
                  <h3 className="text-xl sm:text-3xl font-extrabold text-green-600 mt-0.5">{preventiveKPIs.total}</h3>
                </div>
                <div className="p-2 sm:p-3 bg-green-50 dark:bg-green-950/50 text-green-600 rounded-xl">
                  <Wrench size={18} className="sm:w-6 sm:h-6" />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Atenção / Vencendo</p>
                  <h3 className="text-xl sm:text-3xl font-extrabold text-orange-500 mt-0.5">{preventiveKPIs.urgentCount}</h3>
                </div>
                <div className="p-2 sm:p-3 bg-orange-50 dark:bg-orange-950/50 text-orange-500 rounded-xl">
                  <AlertTriangle size={18} className="sm:w-6 sm:h-6" />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Em Dia</p>
                  <h3 className="text-xl sm:text-3xl font-extrabold text-emerald-600 mt-0.5">{preventiveKPIs.okCount}</h3>
                </div>
                <div className="p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
                  <CheckCircle2 size={18} className="sm:w-6 sm:h-6" />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Categorias</p>
                  <h3 className="text-xl sm:text-3xl font-extrabold text-green-600 mt-0.5">{PREVENTIVE_CATEGORY_OPTIONS.length}</h3>
                </div>
                <div className="p-2 sm:p-3 bg-green-50 dark:bg-green-950/50 text-green-600 rounded-xl">
                  <Tag size={18} className="sm:w-6 sm:h-6" />
                </div>
              </div>
            </>
          )}

          {activeTab === 'it' && (
            <>
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Equipamentos</p>
                  <h3 className="text-xl sm:text-3xl font-extrabold text-green-600 mt-0.5">{itKPIs.total}</h3>
                </div>
                <div className="p-2 sm:p-3 bg-green-50 dark:bg-green-950/50 text-green-600 rounded-xl">
                  <Laptop size={18} className="sm:w-6 sm:h-6" />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Em Manutenção</p>
                  <h3 className="text-xl sm:text-3xl font-extrabold text-orange-500 mt-0.5">{itKPIs.inProgress}</h3>
                </div>
                <div className="p-2 sm:p-3 bg-orange-50 dark:bg-orange-950/50 text-orange-500 rounded-xl">
                  <Clock size={18} className="sm:w-6 sm:h-6" />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Retornados</p>
                  <h3 className="text-xl sm:text-3xl font-extrabold text-emerald-600 mt-0.5">{itKPIs.completed}</h3>
                </div>
                <div className="p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
                  <CheckCircle2 size={18} className="sm:w-6 sm:h-6" />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fornecedores</p>
                  <h3 className="text-xl sm:text-3xl font-extrabold text-green-600 mt-0.5">{fornecedores.length}</h3>
                </div>
                <div className="p-2 sm:p-3 bg-green-50 dark:bg-green-950/50 text-green-600 rounded-xl">
                  <Users size={18} className="sm:w-6 sm:h-6" />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TABS DE NAVEGAÇÃO SUPERIOR (SLIDE HORIZONTAL SUAVE NO MOBILE) */}
      <div className="flex items-center overflow-x-auto whitespace-nowrap pb-2 gap-2 hide-scrollbar border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => { setActiveTab('tasks'); setSearchQuery(''); setStatusFilter(''); setSectorFilter(''); }}
          className={`px-3.5 py-2.5 md:px-5 md:py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'tasks'
              ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-950/30 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText size={16} />
          Tarefas ({tarefas.length})
        </button>

        <button
          onClick={() => { setActiveTab('preventive'); setSearchQuery(''); setCategoryFilter(''); }}
          className={`px-3.5 py-2.5 md:px-5 md:py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'preventive'
              ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-950/30 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Wrench size={16} />
          Preventivas ({preventivas.length})
        </button>

        <button
          onClick={() => { setActiveTab('it'); setSearchQuery(''); setStatusFilter(''); }}
          className={`px-3.5 py-2.5 md:px-5 md:py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 flex-shrink-0 ${
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
          className={`px-3.5 py-2.5 md:px-5 md:py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'config'
              ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-950/30 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Settings size={16} />
          ⚙️ Configurações
        </button>
      </div>

      {/* CONTEÚDO DA ABA SELECIONADA */}
      {isLoading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-8 md:p-16 flex flex-col items-center justify-center space-y-3 shadow-xs">
          <Loader2 className="animate-spin text-green-600 w-10 h-10 md:w-12 md:h-12" />
          <p className="text-slate-500 dark:text-slate-400 font-bold text-xs md:text-sm uppercase tracking-wider text-center">
            Sincronizando dados com o servidor...
          </p>
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {/* BARRA DE FILTROS E PESQUISA RESPONSIVA (ABAS 1, 2 E 3) */}
          {activeTab !== 'config' && (
            <div className="space-y-3">
              <div className="bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="flex flex-1 flex-col sm:flex-row gap-2.5 w-full">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Pesquisar..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 h-10 text-xs md:h-11 md:text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium focus:outline-none focus:border-green-600"
                    />
                  </div>

                  {activeTab === 'tasks' && (
                    <div className="grid grid-cols-2 sm:flex gap-2">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="h-10 text-xs md:h-11 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 font-semibold focus:outline-none focus:border-green-600 truncate"
                      >
                        <option value="">Status (Todos)</option>
                        {TASK_STATUS_OPTIONS.map((st, i) => (
                          <option key={i} value={st}>{st}</option>
                        ))}
                      </select>

                      <select
                        value={sectorFilter}
                        onChange={(e) => setSectorFilter(e.target.value)}
                        className="h-10 text-xs md:h-11 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 font-semibold focus:outline-none focus:border-green-600 truncate"
                      >
                        <option value="">Setores (Todos)</option>
                        {setores.map(s => (
                          <option key={s.id} value={s.nome}>{s.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {activeTab === 'preventive' && (
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="h-10 text-xs md:h-11 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 font-semibold focus:outline-none focus:border-green-600"
                    >
                      <option value="">Categorias (Todas)</option>
                      {PREVENTIVE_CATEGORY_OPTIONS.map((cat, i) => (
                        <option key={i} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}

                  {activeTab === 'it' && (
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="h-10 text-xs md:h-11 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 font-semibold focus:outline-none focus:border-green-600"
                    >
                      <option value="">Status (Todos)</option>
                      {IT_STATUS_OPTIONS.map((st, i) => (
                        <option key={i} value={st}>{st}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* BOTÃO ADICIONAR */}
                <div>
                  {activeTab === 'tasks' && (
                    <button
                      onClick={() => openCreateModal('task')}
                      className="w-full sm:w-auto h-10 md:h-11 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-4 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
                    >
                      <Plus size={16} /> Nova Tarefa
                    </button>
                  )}
                  {activeTab === 'preventive' && (
                    <button
                      onClick={() => openCreateModal('preventive')}
                      className="w-full sm:w-auto h-10 md:h-11 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-4 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
                    >
                      <Plus size={16} /> Nova Preventiva
                    </button>
                  )}
                  {activeTab === 'it' && (
                    <button
                      onClick={() => openCreateModal('it')}
                      className="w-full sm:w-auto h-10 md:h-11 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-4 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
                    >
                      <Plus size={16} /> Novo Envio TI
                    </button>
                  )}
                </div>
              </div>

              {/* SELETOR DE PENDENTES / CONCLUÍDOS / TODOS */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1 flex-shrink-0">
                  <ListFilter size={13} /> Exibir:
                </span>
                <button
                  onClick={() => setCompletionFilter('active')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex-shrink-0 ${
                    completionFilter === 'active'
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  Pendentes ({activeTab === 'tasks' ? taskKPIs.pending : activeTab === 'it' ? itKPIs.inProgress : preventiveKPIs.total})
                </button>
                <button
                  onClick={() => setCompletionFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex-shrink-0 ${
                    completionFilter === 'completed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  Concluídos ({activeTab === 'tasks' ? taskKPIs.completed : activeTab === 'it' ? itKPIs.completed : preventiveKPIs.okCount})
                </button>
                <button
                  onClick={() => setCompletionFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex-shrink-0 ${
                    completionFilter === 'all'
                      ? 'bg-green-600 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  Todos
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TABELA RESPONSIVA: ABA 1 (TAREFAS) - CARDS NO MOBILE, TABLE NO DESKTOP */}
          {/* ================================================================ */}
          {activeTab === 'tasks' && (
            <div className="bg-transparent md:bg-white dark:md:bg-zinc-900 md:rounded-xl md:border md:border-slate-200 dark:md:border-zinc-800 md:shadow-xs overflow-hidden">
              <table className="w-full text-xs md:text-sm text-left border-collapse block md:table">
                <thead className="hidden md:table-header-group bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200 dark:border-zinc-700">
                  <tr>
                    <th className="px-4 py-3.5 w-12 text-center">Status</th>
                    <th className="px-4 py-3.5">Descrição da Tarefa</th>
                    <th className="px-4 py-3.5">Setor</th>
                    <th className="px-4 py-3.5">Status Processo</th>
                    <th className="px-4 py-3.5 text-center">Data Entrada</th>
                    <th className="px-4 py-3.5 text-center">Data Prazo</th>
                    <th className="px-4 py-3.5 text-right">Ações Rápidas</th>
                  </tr>
                </thead>

                <tbody className="block md:table-row-group space-y-3 md:space-y-0 divide-y-0 md:divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredTarefas.length === 0 ? (
                    <tr className="block md:table-row bg-white dark:bg-zinc-900 rounded-xl p-8 border border-slate-200 dark:border-zinc-800 text-center">
                      <td colSpan="7" className="block md:table-cell text-slate-400 font-medium text-center">
                        Nenhuma tarefa encontrada.
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
                          className={`block md:table-row cursor-pointer bg-white dark:bg-zinc-900 rounded-xl p-4 md:p-0 border md:border-none border-slate-200 dark:border-zinc-800 shadow-xs md:shadow-none hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-all ${
                            isCompleted ? 'opacity-70 bg-slate-50/50 dark:bg-zinc-900/50' : ''
                          }`}
                        >
                          {/* STATUS CHECKBOX */}
                          <td className="flex justify-between items-center pb-2.5 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4 md:text-center" onClick={(e) => e.stopPropagation()}>
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Conclusão:</span>
                            <button
                              onClick={(e) => handleToggleTaskCompleted(t, e)}
                              className="p-1 text-slate-400 hover:text-green-600 transition-colors"
                              title={isCompleted ? "Marcar como pendente" : "Marcar como concluída"}
                            >
                              {isCompleted ? <CheckSquare size={22} className="text-emerald-600" /> : <Square size={22} />}
                            </button>
                          </td>

                          {/* DESCRIÇÃO DA TAREFA */}
                          <td className="flex flex-col py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4">
                            <span className="md:hidden font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Descrição:</span>
                            <p className={`font-bold text-slate-800 dark:text-slate-100 text-sm md:text-sm ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                              {t.name}
                            </p>
                            {t.notes && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.notes}</p>}
                          </td>

                          {/* SETOR */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Setor:</span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300">
                              <Building2 size={12} className="text-green-600" />
                              {t.sector || 'Geral'}
                            </span>
                          </td>

                          {/* STATUS PROCESSO */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Status:</span>
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                              {t.status}
                            </span>
                          </td>

                          {/* DATA ENTRADA */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4 md:text-center text-xs text-slate-600 dark:text-slate-400">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Entrada:</span>
                            <span>{t.entryDate ? new Date(t.entryDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                          </td>

                          {/* DATA PRAZO */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4 md:text-center">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Prazo:</span>
                            {t.dueDate ? (
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                isCompleted
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isOverdue
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                                    : 'bg-slate-100 text-slate-700'
                              }`}>
                                {new Date(t.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            ) : '-'}
                          </td>

                          {/* AÇÕES RÁPIDAS */}
                          <td className="flex justify-end items-center pt-3 md:pt-0 md:table-cell md:py-3.5 md:px-4 md:text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRowDetail(t, 'task', true);
                                }}
                                className="flex-1 sm:flex-none h-9 px-3 rounded-lg text-xs font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-600 hover:bg-orange-100 transition-colors flex items-center justify-center gap-1"
                              >
                                <Edit2 size={13} /> Editar
                              </button>
                              <button
                                onClick={(e) => handleToggleTaskCompleted(t, e)}
                                className={`flex-1 sm:flex-none h-9 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                                  isCompleted
                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                                }`}
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
          )}

          {/* ================================================================ */}
          {/* TABELA RESPONSIVA: ABA 2 (PREVENTIVAS) - CARDS NO MOBILE          */}
          {/* ================================================================ */}
          {activeTab === 'preventive' && (
            <div className="bg-transparent md:bg-white dark:md:bg-zinc-900 md:rounded-xl md:border md:border-slate-200 dark:md:border-zinc-800 md:shadow-xs overflow-hidden">
              <table className="w-full text-xs md:text-sm text-left border-collapse block md:table">
                <thead className="hidden md:table-header-group bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200 dark:border-zinc-700">
                  <tr>
                    <th className="px-4 py-3.5">Equipamento / Documento</th>
                    <th className="px-4 py-3.5">Categoria</th>
                    <th className="px-4 py-3.5 text-center">Periodicidade</th>
                    <th className="px-4 py-3.5 text-center">Última Realização</th>
                    <th className="px-4 py-3.5 text-center">Próxima Realização</th>
                    <th className="px-4 py-3.5 text-center">Status / Dias</th>
                    <th className="px-4 py-3.5 text-right">Ações Rápidas</th>
                  </tr>
                </thead>

                <tbody className="block md:table-row-group space-y-3 md:space-y-0 divide-y-0 md:divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredPreventivas.length === 0 ? (
                    <tr className="block md:table-row bg-white dark:bg-zinc-900 rounded-xl p-8 border border-slate-200 dark:border-zinc-800 text-center">
                      <td colSpan="7" className="block md:table-cell text-slate-400 font-medium text-center">
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
                          className="block md:table-row cursor-pointer bg-white dark:bg-zinc-900 rounded-xl p-4 md:p-0 border md:border-none border-slate-200 dark:border-zinc-800 shadow-xs md:shadow-none hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-all"
                        >
                          {/* NOME / EQUIPAMENTO */}
                          <td className="flex flex-col pb-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4">
                            <span className="md:hidden font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Equipamento:</span>
                            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{p.name}</p>
                          </td>

                          {/* CATEGORIA */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Categoria:</span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300">
                              {p.category}
                            </span>
                          </td>

                          {/* PERIODICIDADE */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4 md:text-center font-semibold text-slate-600 dark:text-slate-300">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Periodicidade:</span>
                            <span>{p.periodicity}</span>
                          </td>

                          {/* ÚLTIMA REALIZAÇÃO */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4 md:text-center text-xs text-slate-600 dark:text-slate-400">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Última Realização:</span>
                            <span>{p.lastDate ? new Date(p.lastDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                          </td>

                          {/* PRÓXIMA REALIZAÇÃO */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4 md:text-center text-xs font-bold">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Próximo Vencimento:</span>
                            <span>{nextDate ? nextDate.toLocaleDateString('pt-BR') : '-'}</span>
                          </td>

                          {/* STATUS / DIAS */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4 md:text-center">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Status:</span>
                            {daysRemaining !== null ? (
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                                daysRemaining < 0
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : daysRemaining <= 15
                                    ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}>
                                {daysRemaining < 0 ? `Vencido (${Math.abs(daysRemaining)}d)` : `${daysRemaining} dias`}
                              </span>
                            ) : '-'}
                          </td>

                          {/* AÇÕES RÁPIDAS */}
                          <td className="flex justify-end items-center pt-3 md:pt-0 md:table-cell md:py-3.5 md:px-4 md:text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRowDetail(p, 'preventive', true);
                                }}
                                className="flex-1 sm:flex-none h-9 px-3 rounded-lg text-xs font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-600 hover:bg-orange-100 transition-colors flex items-center justify-center gap-1"
                              >
                                <Edit2 size={13} /> Editar
                              </button>
                              <button
                                onClick={(e) => handleCompletePreventiveCycle(p, e)}
                                className="flex-1 sm:flex-none h-9 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center justify-center gap-1"
                              >
                                <RotateCcw size={13} /> Renovar
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
          )}

          {/* ================================================================ */}
          {/* TABELA RESPONSIVA: ABA 3 (TI) - CARDS NO MOBILE                  */}
          {/* ================================================================ */}
          {activeTab === 'it' && (
            <div className="bg-transparent md:bg-white dark:md:bg-zinc-900 md:rounded-xl md:border md:border-slate-200 dark:md:border-zinc-800 md:shadow-xs overflow-hidden">
              <table className="w-full text-xs md:text-sm text-left border-collapse block md:table">
                <thead className="hidden md:table-header-group bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200 dark:border-zinc-700">
                  <tr>
                    <th className="px-4 py-3.5 w-12 text-center">Status</th>
                    <th className="px-4 py-3.5">Equipamento</th>
                    <th className="px-4 py-3.5">Fornecedor / Assistência</th>
                    <th className="px-4 py-3.5">Status Manutenção</th>
                    <th className="px-4 py-3.5 text-center">Data Envio</th>
                    <th className="px-4 py-3.5 text-center">Previsão Retorno</th>
                    <th className="px-4 py-3.5 text-right">Ações Rápidas</th>
                  </tr>
                </thead>

                <tbody className="block md:table-row-group space-y-3 md:space-y-0 divide-y-0 md:divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredTI.length === 0 ? (
                    <tr className="block md:table-row bg-white dark:bg-zinc-900 rounded-xl p-8 border border-slate-200 dark:border-zinc-800 text-center">
                      <td colSpan="7" className="block md:table-cell text-slate-400 font-medium text-center">
                        Nenhum equipamento de TI encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredTI.map((i) => {
                      const isCompleted = isItemCompleted(i);

                      return (
                        <tr
                          key={i.id}
                          onClick={() => openRowDetail(i, 'it')}
                          className={`block md:table-row cursor-pointer bg-white dark:bg-zinc-900 rounded-xl p-4 md:p-0 border md:border-none border-slate-200 dark:border-zinc-800 shadow-xs md:shadow-none hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-all ${
                            isCompleted ? 'opacity-70 bg-slate-50/50 dark:bg-zinc-900/50' : ''
                          }`}
                        >
                          {/* CHECKBOX RETORNADO */}
                          <td className="flex justify-between items-center pb-2.5 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4 md:text-center" onClick={(e) => e.stopPropagation()}>
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Retornado:</span>
                            <button
                              onClick={(e) => handleToggleITCompleted(i, e)}
                              className="p-1 text-slate-400 hover:text-green-600 transition-colors"
                              title={isCompleted ? "Marcar em aberto" : "Marcar como retornado"}
                            >
                              {isCompleted ? <CheckSquare size={22} className="text-emerald-600" /> : <Square size={22} />}
                            </button>
                          </td>

                          {/* EQUIPAMENTO */}
                          <td className="flex flex-col py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4">
                            <span className="md:hidden font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Equipamento:</span>
                            <p className={`font-bold text-slate-800 dark:text-slate-100 text-sm ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                              {i.device}
                            </p>
                            {i.notes && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{i.notes}</p>}
                          </td>

                          {/* FORNECEDOR */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Assistência:</span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300">
                              <Users size={12} />
                              {i.supplierName || 'Não Informado'}
                            </span>
                          </td>

                          {/* STATUS */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Status:</span>
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                              {i.status}
                            </span>
                          </td>

                          {/* DATA ENVIO */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4 md:text-center text-xs text-slate-600 dark:text-slate-400">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Data Envio:</span>
                            <span>{i.sendDate ? new Date(i.sendDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                          </td>

                          {/* PREVISÃO RETORNO */}
                          <td className="flex justify-between items-center py-2 border-b md:border-b-0 border-slate-100 dark:border-zinc-800 md:table-cell md:py-3.5 md:px-4 md:text-center text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span className="md:hidden font-bold text-xs text-slate-400 uppercase tracking-wider">Previsão Retorno:</span>
                            <span>{i.expectedDate ? new Date(i.expectedDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                          </td>

                          {/* AÇÕES RÁPIDAS */}
                          <td className="flex justify-end items-center pt-3 md:pt-0 md:table-cell md:py-3.5 md:px-4 md:text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRowDetail(i, 'it', true);
                                }}
                                className="flex-1 sm:flex-none h-9 px-3 rounded-lg text-xs font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-600 hover:bg-orange-100 transition-colors flex items-center justify-center gap-1"
                              >
                                <Edit2 size={13} /> Editar
                              </button>
                              <button
                                onClick={(e) => handleToggleITCompleted(i, e)}
                                className={`flex-1 sm:flex-none h-9 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                                  isCompleted
                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                                }`}
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
          )}

          {/* ABA 4: CONFIGURAÇÕES RESPONSIVA */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <Settings className="text-green-600" size={20} />
                  Gestão de Cadastros Base
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Gerencie os Setores e Fornecedores/Assistências Técnicas.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* SETORES */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm sm:text-base">
                      <Building2 size={18} className="text-green-600" />
                      Setores ({setores.length})
                    </h3>
                    <button
                      onClick={() => openCreateModal('sector')}
                      className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs transition-all text-xs uppercase"
                    >
                      <Plus size={14} /> Novo Setor
                    </button>
                  </div>

                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold">
                        <tr>
                          <th className="px-4 py-2.5 w-12">ID</th>
                          <th className="px-4 py-2.5">Nome do Setor</th>
                          <th className="px-4 py-2.5 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {setores.length === 0 ? (
                          <tr>
                            <td colSpan="3" className="px-4 py-6 text-center text-slate-400 font-medium">
                              Nenhum setor cadastrado.
                            </td>
                          </tr>
                        ) : (
                          setores.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                              <td className="px-4 py-3 text-xs text-slate-400 font-mono">#{s.id}</td>
                              <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{s.nome}</td>
                              <td className="px-4 py-3 text-right space-x-1">
                                <button
                                  onClick={() => openEditBaseModal('sector', s)}
                                  className="p-1.5 text-slate-400 hover:text-green-600 rounded-lg"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ sheetName: 'Setores', id: s.id, name: s.nome })}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
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

                {/* FORNECEDORES */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm sm:text-base">
                      <Users size={18} className="text-orange-500" />
                      Fornecedores ({fornecedores.length})
                    </h3>
                    <button
                      onClick={() => openCreateModal('supplier')}
                      className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs transition-all text-xs uppercase"
                    >
                      <Plus size={14} /> Novo Fornecedor
                    </button>
                  </div>

                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-bold">
                        <tr>
                          <th className="px-4 py-2.5">Fornecedor</th>
                          <th className="px-4 py-2.5">Contato / Tel</th>
                          <th className="px-4 py-2.5 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {fornecedores.length === 0 ? (
                          <tr>
                            <td colSpan="3" className="px-4 py-6 text-center text-slate-400 font-medium">
                              Nenhum fornecedor cadastrado.
                            </td>
                          </tr>
                        ) : (
                          fornecedores.map((f) => (
                            <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-800 dark:text-slate-100">{f.name}</p>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                                {f.contact && <p className="font-semibold">{f.contact}</p>}
                                {f.phone && <p className="text-slate-400 flex items-center gap-1"><Phone size={11} /> {f.phone}</p>}
                              </td>
                              <td className="px-4 py-3 text-right space-x-1">
                                <button
                                  onClick={() => openEditBaseModal('supplier', f)}
                                  className="p-1.5 text-slate-400 hover:text-green-600 rounded-lg"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ sheetName: 'Fornecedores', id: f.id, name: f.name })}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
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
      {/* MODAL DE DETALHES E EDIÇÃO RESPONSIVO (HEADER FIXO + BODY SCROLL + FOOTER FIXO) */}
      {/* ================================================================ */}
      {selectedDetail && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="w-[95%] md:w-full max-w-2xl max-h-[90vh] rounded-2xl flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* HEADER FIXO DO MODAL */}
            <div className="flex-none p-4 md:p-6 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] md:text-[11px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 inline-block">
                  {selectedDetail.type === 'task' && 'Detalhes da Tarefa'}
                  {selectedDetail.type === 'preventive' && 'Detalhes da Preventiva'}
                  {selectedDetail.type === 'it' && 'Detalhes do Equipamento TI'}
                </span>
                <h3 className="font-extrabold text-base md:text-xl text-slate-900 dark:text-white mt-1 truncate">
                  {selectedDetail.item.name || selectedDetail.item.device}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-zinc-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* CONTEÚDO ROLÁVEL DO MODAL */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
              {!isEditingModal ? (
                /* --- MODO VISUALIZAÇÃO --- */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status Atual</p>
                      <p className="text-sm font-extrabold text-orange-600 mt-0.5">
                        {selectedDetail.item.status || selectedDetail.item.category || 'Em Andamento'}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {selectedDetail.type === 'it' ? 'Fornecedor / Assistência' : 'Setor Vinculado'}
                      </p>
                      <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
                        {selectedDetail.item.sector || selectedDetail.item.supplierName || 'Geral'}
                      </p>
                    </div>

                    {selectedDetail.type === 'task' && (
                      <>
                        <div className="bg-slate-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data de Entrada</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                            {selectedDetail.item.entryDate ? new Date(selectedDetail.item.entryDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Prazo</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                            {selectedDetail.item.dueDate ? new Date(selectedDetail.item.dueDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </p>
                        </div>
                      </>
                    )}

                    {selectedDetail.type === 'preventive' && (
                      <>
                        <div className="bg-slate-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Periodicidade</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                            {selectedDetail.item.periodicity}
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Última Realização</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                            {selectedDetail.item.lastDate ? new Date(selectedDetail.item.lastDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </p>
                        </div>
                      </>
                    )}

                    {selectedDetail.type === 'it' && (
                      <>
                        <div className="bg-slate-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Envio</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                            {selectedDetail.item.sendDate ? new Date(selectedDetail.item.sendDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Previsão Retorno</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                            {selectedDetail.item.expectedDate ? new Date(selectedDetail.item.expectedDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {selectedDetail.item.notes && (
                    <div className="bg-slate-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Observações / Detalhes</p>
                      <p className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line">
                        {selectedDetail.item.notes}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* --- MODO EDIÇÃO --- */
                <form id="detail-edit-form" onSubmit={handleSaveDetailModal} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
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
                      className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium focus:outline-none focus:border-green-600"
                    />
                  </div>

                  {selectedDetail.type === 'task' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Setor</label>
                        <select
                          value={detailForm.sector || ''}
                          onChange={(e) => setDetailForm({ ...detailForm, sector: e.target.value })}
                          className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                        >
                          <option value="">Selecione...</option>
                          {setores.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Status Processo</label>
                        <select
                          value={detailForm.status || TASK_STATUS_OPTIONS[0]}
                          onChange={(e) => setDetailForm({ ...detailForm, status: e.target.value })}
                          className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                        >
                          {TASK_STATUS_OPTIONS.map((st, i) => <option key={i} value={st}>{st}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {selectedDetail.type === 'preventive' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Categoria</label>
                        <select
                          value={detailForm.category || PREVENTIVE_CATEGORY_OPTIONS[0]}
                          onChange={(e) => setDetailForm({ ...detailForm, category: e.target.value })}
                          className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                        >
                          {PREVENTIVE_CATEGORY_OPTIONS.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Periodicidade</label>
                        <select
                          value={detailForm.periodicity || PERIODICITY_OPTIONS[0]}
                          onChange={(e) => setDetailForm({ ...detailForm, periodicity: e.target.value })}
                          className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                        >
                          {PERIODICITY_OPTIONS.map((p, i) => <option key={i} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {selectedDetail.type === 'it' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Fornecedor / Assistência</label>
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
                          className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                        >
                          <option value="">Selecione...</option>
                          {fornecedores.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Status Manutenção</label>
                        <select
                          value={detailForm.status || IT_STATUS_OPTIONS[0]}
                          onChange={(e) => setDetailForm({ ...detailForm, status: e.target.value })}
                          className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                        >
                          {IT_STATUS_OPTIONS.map((st, i) => <option key={i} value={st}>{st}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Observações</label>
                    <textarea
                      rows="3"
                      value={detailForm.notes || ''}
                      onChange={(e) => setDetailForm({ ...detailForm, notes: e.target.value })}
                      className="w-full p-3 text-xs md:text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                    ></textarea>
                  </div>
                </form>
              )}
            </div>

            {/* RODAPÉ FIXO DO MODAL (STICKY FOOTER NUNCA ESCONDE OS BOTÕES) */}
            <div className="flex-none sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 p-3 sm:p-4 flex flex-wrap justify-between items-center gap-2 rounded-b-2xl shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.05)]">
              {!isEditingModal ? (
                <>
                  <div className="flex gap-2">
                    {selectedDetail.type === 'task' && (
                      <button
                        onClick={() => handleToggleTaskCompleted(selectedDetail.item)}
                        className={`h-9 px-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
                          isItemCompleted(selectedDetail.item)
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <CheckSquare size={14} />
                        {isItemCompleted(selectedDetail.item) ? 'Concluída' : 'Concluir'}
                      </button>
                    )}
                    {selectedDetail.type === 'preventive' && (
                      <button
                        onClick={() => handleCompletePreventiveCycle(selectedDetail.item)}
                        className="h-9 px-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-emerald-600 text-white flex items-center gap-1.5"
                      >
                        <RotateCcw size={14} /> Renovar
                      </button>
                    )}
                    {selectedDetail.type === 'it' && (
                      <button
                        onClick={() => handleToggleITCompleted(selectedDetail.item)}
                        className={`h-9 px-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
                          isItemCompleted(selectedDetail.item)
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <CheckSquare size={14} />
                        {isItemCompleted(selectedDetail.item) ? 'Retornado' : 'Retornar'}
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirm({
                        sheetName: selectedDetail.type === 'task' ? 'Tarefas' : selectedDetail.type === 'preventive' ? 'Preventivas' : 'TI',
                        id: selectedDetail.item.id,
                        name: selectedDetail.item.name || selectedDetail.item.device
                      })}
                      className="h-9 px-3 rounded-xl font-bold text-xs uppercase tracking-wider text-rose-600 bg-rose-50 flex items-center gap-1"
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingModal(true);
                        setDetailForm({ ...selectedDetail.item });
                      }}
                      className="h-9 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-orange-500 hover:bg-orange-600 text-white shadow-xs flex items-center gap-1.5"
                    >
                      <Edit2 size={14} /> Editar
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex justify-end gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setIsEditingModal(false)}
                    className="h-9 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    form="detail-edit-form"
                    disabled={isSaving}
                    className="h-9 px-5 rounded-xl font-bold text-xs uppercase tracking-wider bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                    Salvar Alterações
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO (TAREFA) RESPONSIVO */}
      {modalType === 'task' && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="text-green-600" size={18} />
                Nova Tarefa
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Descrição da Tarefa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cotação de manutenção do ar condicionado"
                  value={taskForm.name}
                  onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                  className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Setor *</label>
                  <select
                    value={taskForm.sector}
                    onChange={(e) => setTaskForm({ ...taskForm, sector: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  >
                    <option value="">Selecione...</option>
                    {setores.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Status Processo</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  >
                    {TASK_STATUS_OPTIONS.map((st, i) => <option key={i} value={st}>{st}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Data Entrada</label>
                  <input
                    type="date"
                    value={taskForm.entryDate}
                    onChange={(e) => setTaskForm({ ...taskForm, entryDate: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Data Limite (Prazo)</label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Observações</label>
                <textarea
                  rows="3"
                  placeholder="Informações adicionais..."
                  value={taskForm.notes}
                  onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                  className="w-full p-3 text-xs md:text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="h-9 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-9 px-5 rounded-xl font-bold text-xs uppercase tracking-wider bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Criar Tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO (PREVENTIVA) RESPONSIVO */}
      {modalType === 'preventive' && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench className="text-green-600" size={18} />
                Nova Manutenção Preventiva
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPreventive} className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Equipamento / Documento / Veículo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Empilhadeira Elétrica Toyota #02"
                  value={prevForm.name}
                  onChange={(e) => setPrevForm({ ...prevForm, name: e.target.value })}
                  className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Categoria *</label>
                  <select
                    value={prevForm.category}
                    onChange={(e) => setPrevForm({ ...prevForm, category: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  >
                    {PREVENTIVE_CATEGORY_OPTIONS.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Periodicidade *</label>
                  <select
                    value={prevForm.periodicity}
                    onChange={(e) => setPrevForm({ ...prevForm, periodicity: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  >
                    {PERIODICITY_OPTIONS.map((p, i) => <option key={i} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Última Realização *</label>
                <input
                  type="date"
                  required
                  value={prevForm.lastDate}
                  onChange={(e) => setPrevForm({ ...prevForm, lastDate: e.target.value })}
                  className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="h-9 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-9 px-5 rounded-xl font-bold text-xs uppercase tracking-wider bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Criar Preventiva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO (TI) RESPONSIVO */}
      {modalType === 'it' && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Laptop className="text-green-600" size={18} />
                Enviar Equipamento TI
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitIT} className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Equipamento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Coletor de Dados Zebra TC21"
                  value={itForm.device}
                  onChange={(e) => setItForm({ ...itForm, device: e.target.value })}
                  className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Fornecedor / Assistência *</label>
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
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  >
                    <option value="">Selecione...</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Status Envio</label>
                  <select
                    value={itForm.status}
                    onChange={(e) => setItForm({ ...itForm, status: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  >
                    {IT_STATUS_OPTIONS.map((st, i) => <option key={i} value={st}>{st}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Data Envio</label>
                  <input
                    type="date"
                    value={itForm.sendDate}
                    onChange={(e) => setItForm({ ...itForm, sendDate: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Previsão Retorno</label>
                  <input
                    type="date"
                    value={itForm.expectedDate}
                    onChange={(e) => setItForm({ ...itForm, expectedDate: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Observações / Defeito</label>
                <textarea
                  rows="3"
                  placeholder="Número de série, problema..."
                  value={itForm.notes}
                  onChange={(e) => setItForm({ ...itForm, notes: e.target.value })}
                  className="w-full p-3 text-xs md:text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="h-9 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-9 px-5 rounded-xl font-bold text-xs uppercase tracking-wider bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Registrar Envio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL (SETOR) RESPONSIVO */}
      {modalType === 'sector' && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="text-green-600" size={18} />
                {editingItem ? 'Editar Setor' : 'Novo Setor'}
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitSector} className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Nome do Setor *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Manutenção, Frios, Logística"
                  value={sectorForm.nome}
                  onChange={(e) => setSectorForm({ nome: e.target.value })}
                  className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="h-9 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-9 px-5 rounded-xl font-bold text-xs uppercase tracking-wider bg-green-600 hover:bg-green-700 text-white shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Salvar Setor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL (FORNECEDOR) RESPONSIVO */}
      {modalType === 'supplier' && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="text-orange-500" size={18} />
                {editingItem ? 'Editar Fornecedor' : 'Novo Fornecedor / Assistência'}
              </h3>
              <button onClick={() => setModalType(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplier} className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Razão Social / Nome *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Assistência Zebra Brasil"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Contato Responsável</label>
                  <input
                    type="text"
                    placeholder="Carlos Oliveira"
                    value={supplierForm.contact}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(16) 99999-9999"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">CEP</label>
                  <input
                    type="text"
                    placeholder="14400-000"
                    value={supplierForm.cep}
                    onChange={(e) => setSupplierForm({ ...supplierForm, cep: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Cidade</label>
                  <input
                    type="text"
                    placeholder="Franca"
                    value={supplierForm.city}
                    onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">UF</label>
                  <input
                    type="text"
                    placeholder="SP"
                    maxLength={2}
                    value={supplierForm.state}
                    onChange={(e) => setSupplierForm({ ...supplierForm, state: e.target.value.toUpperCase() })}
                    className="w-full h-10 text-xs md:h-11 md:text-sm px-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="h-9 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-9 px-5 rounded-xl font-bold text-xs uppercase tracking-wider bg-orange-500 hover:bg-orange-600 text-white shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Salvar Fornecedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO EXCLUSÃO RESPONSIVO */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 text-center space-y-3">
              <div className="w-10 h-10 bg-rose-100 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={22} />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Confirmar Exclusão</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deseja mesmo excluir o registro <strong className="text-slate-800 dark:text-slate-200">"{deleteConfirm.name}"</strong> da aba <strong className="text-green-600">{deleteConfirm.sheetName}</strong>?
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="h-9 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteRecord}
                  disabled={isSaving}
                  className="h-9 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
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
