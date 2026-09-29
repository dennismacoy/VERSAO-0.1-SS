import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Trash2, FileText, ShoppingCart, Save, History, Loader2, Calendar, User, Search, X, ArrowUpDown, ChevronUp, ChevronDown, Filter, RotateCcw, ArrowLeft, Edit2, Package, Check, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../lib/permissions';
import { useProducts } from '../context/ProductsContext';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { generatePreVendaPDF } from '../lib/pdfGenerator';
import { listenToNode, listenToUsers } from '../lib/firebase';
import { cn, formatCurrency } from '../lib/utils';
import useSortableData from '../hooks/useSortableData';

export default function PreVenda() {
  const { user, hasPermission } = useAuth();
  const { searchLocal } = useProducts();
  const location = useLocation();

  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados dos Filtros Inteligentes
  const [searchFilter, setSearchFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Estados do Wizard de Nova Pré-Venda
  const [isNovaPreVenda, setIsNovaPreVenda] = useState(false);
  const [wizardStep, setWizardStep] = useState(1); // 1: Cliente, 2: Carrinho, 3: Pesquisa, 4: Qtd/Preço Prompt
  const [query, setQuery] = useState('');
  const [cliente, setCliente] = useState('');
  const [itens, setItens] = useState([]);
  const [saving, setSaving] = useState(false);
  const [repositores, setRepositores] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  // Estado para Produto Selecionado na Etapa 3 -> Etapa 4
  const [selectedProductForCart, setSelectedProductForCart] = useState(null);
  const [precoUnitarioInput, setPrecoUnitarioInput] = useState('');
  const [qtdCaixasInput, setQtdCaixasInput] = useState('1');

  // Helper blindado e otimizado para buscar chaves do objeto do Google Sheets
  const getVal = (p, ...keys) => {
    if (!p || typeof p !== 'object') return null;
    
    // 1. Tenta acesso direto pelas chaves primeiro (alta performance)
    for (const k of keys) {
      if (p[k] !== undefined && p[k] !== null && p[k] !== '') {
        return p[k];
      }
    }

    const norm = (str) =>
      String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    // 2. Se não achou, faz a busca normalizada
    for (const key of Object.keys(p)) {
      const normKey = norm(key);
      for (const k of keys) {
        if (normKey === norm(k)) {
          if (p[key] !== undefined && p[key] !== null && p[key] !== '') {
            return p[key];
          }
        }
      }
    }

    return null;
  };

  const parsePriceVal = (val) => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'number') {
      return isNaN(val) ? '' : String(val);
    }
    const str = String(val).trim();
    if (!str) return '';
    if (str.includes(',')) {
      return str.replace(/\./g, '').replace(',', '.');
    }
    const parsed = parseFloat(str);
    return isNaN(parsed) ? '' : String(parsed);
  };

  const getColunaD = (p) => {
    if (!p) return 1;

    // Prioridade máxima: Coluna D "qtdcx" da planilha base do Google Sheets
    const direct = p.qtdcx ?? p.QTDCX ?? p.QtdCx ?? p.qtd_cx ?? p.QTD_CX ?? p['qtdcx'] ?? p['QTDCX'] ?? p['qtd cx'] ?? p.colunaD ?? p.coluna_d;
    if (direct !== undefined && direct !== null && direct !== '') {
      const num = parseFloat(String(direct).replace(/\./g, '').replace(',', '.'));
      if (!isNaN(num) && num > 0) return num;
    }

    // Busca normalizada para todas as possíveis variações de cabeçalho
    const rawVal = getVal(
      p,
      'qtdcx', 'QTDCX', 'QtdCx', 'qtd_cx', 'QTD_CX', 'qtd cx', 'qtd/cx',
      'colunad', 'coluna_d', 'coluna d', 'COLUNA_D', 'D',
      'qtd_caixa', 'qtd caixa', 'qtde_caixa', 'qtde caixa', 'QTD_CAIXAS',
      'embalagem_qtd', 'fator_embalagem', 'fator_emb'
    );

    if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
      const strVal = String(rawVal).replace(/\./g, '').replace(',', '.');
      const num = parseFloat(strVal);
      if (!isNaN(num) && num > 0) return num;
    }

    if (typeof p.colunaD === 'number' && p.colunaD > 0) return p.colunaD;
    if (typeof p.QTD_CAIXA === 'number' && p.QTD_CAIXA > 0) return p.QTD_CAIXA;

    return 1;
  };

  const getEstoque = (p) => {
    if (!p) return 0;
    const rawVal = getVal(p, 'ESTOQUE', 'QTE', 'estoque', 'SALDO_ESTOQUE', 'saldo_estoque');
    if (rawVal !== null && rawVal !== undefined) {
      const strVal = String(rawVal).replace(/\./g, '').replace(',', '.');
      const num = parseFloat(strVal);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const handleOpenNovaPreVenda = () => {
    setQuery('');
    setCliente('');
    setItens([]);
    setWizardStep(1);
    setSelectedProductForCart(null);
    setPrecoUnitarioInput('');
    setQtdCaixasInput('1');
    setIsNovaPreVenda(true);
  };

  const handleCloseNovaPreVenda = () => {
    setQuery('');
    setCliente('');
    setItens([]);
    setWizardStep(1);
    setSelectedProductForCart(null);
    setPrecoUnitarioInput('');
    setQtdCaixasInput('1');
    setIsNovaPreVenda(false);
  };

  const unsubRef = useRef(null);
  const unsubUsersRef = useRef(null);

  useEffect(() => {
    if (isNovaPreVenda) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isNovaPreVenda]);

  useEffect(() => {
    if (location.state?.pedidoParaConverter) {
      const p = location.state.pedidoParaConverter;
      setCliente(p.cliente || '');
      setItens((p.itens || []).map(i => {
        const cD = getColunaD(i);
        const qtdCaixas = Number(i.qtdCaixas) || 1;
        const totalUnits = Number(i.qtd) || (qtdCaixas * cD);
        const preco = Number(i.preco) || 0;
        return {
          ...i,
          codigo: i.codigo || i.CODIGO || '',
          codigo_interno: i.codigo_interno || i.CODIGO_INTERNO || i.codigo_int || '',
          complemento: i.complemento || i.COMPLEMENTO || i.COMPLEMENTO_PROD || '',
          embalagem: i.embalagem || i.EMBALAGEM || 'CX',
          colunaD: cD,
          qtdCaixas: qtdCaixas,
          qtd: totalUnits,
          preco: preco,
          subtotal: totalUnits * preco
        };
      }));
      setWizardStep(p.cliente ? 2 : 1);
      setIsNovaPreVenda(true);
    }
  }, [location]);

  useEffect(() => {
    unsubRef.current = listenToNode('prevendas', (items) => {
      let filtered = items;
      const canViewAll = hasPermission(PERMISSIONS.VIEW_GESTAO_ADMIN) || hasPermission(PERMISSIONS.VIEW_RELATORIOS) || hasPermission('view_all_prevendas');
      if (!canViewAll) {
        const userName = user?.name || user?.usuario || '';
        filtered = items.filter(p => (p.usuario || '').toLowerCase() === userName.toLowerCase());
      }
      setHistorico(filtered);
      setLoading(false);
    });

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [user, hasPermission]);

  useEffect(() => {
    unsubUsersRef.current = listenToUsers((users) => {
      const separadores = users.filter(u => {
        const userRole = (u.role || u.perfil || u.cargo || u.Role || '').toLowerCase();
        return userRole !== 'clientes';
      });
      setRepositores(separadores);
    });
    return () => {
      if (unsubUsersRef.current) unsubUsersRef.current();
    };
  }, []);

  // Filtro Inteligente de Histórico
  const filteredHistorico = useMemo(() => {
    let result = historico;

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      result = result.filter(h =>
        (h.cliente || '').toLowerCase().includes(q) ||
        (h.usuario || '').toLowerCase().includes(q) ||
        (h.firebaseId || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter && statusFilter !== 'todos') {
      result = result.filter(h => h.status === statusFilter);
    }

    if (startDate) {
      const start = new Date(startDate + 'T00:00:00').getTime();
      result = result.filter(h => {
        const hDate = new Date(h.data || h.createdAt).getTime();
        return hDate >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate + 'T23:59:59').getTime();
      result = result.filter(h => {
        const hDate = new Date(h.data || h.createdAt).getTime();
        return hDate <= end;
      });
    }

    return result;
  }, [historico, searchFilter, statusFilter, startDate, endDate]);

  const { items: sortedHistorico, requestSort, sortConfig } = useSortableData(filteredHistorico, { key: 'data', direction: 'desc' });

  const renderSortHeader = (label, key, align = 'left') => {
    const isSorted = sortConfig && sortConfig.key === key;
    return (
      <th
        onClick={() => requestSort(key)}
        className={cn(
          "px-4 py-3 font-bold cursor-pointer select-none hover:bg-muted/80 transition-colors text-xs uppercase tracking-wider text-muted-foreground",
          align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
        )}
      >
        <div className={cn("flex items-center gap-1.5", align === 'center' && 'justify-center', align === 'right' && 'justify-end')}>
          <span>{label}</span>
          {isSorted ? (
            sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-orange-500" /> : <ChevronDown size={14} className="text-orange-500" />
          ) : (
            <ArrowUpDown size={13} className="text-muted-foreground/40" />
          )}
        </div>
      </th>
    );
  };

  const hasActiveFilters = Boolean(searchFilter || startDate || endDate || (statusFilter && statusFilter !== 'todos'));

  const handleClearFilters = () => {
    setSearchFilter('');
    setStartDate('');
    setEndDate('');
    setStatusFilter('todos');
  };

  const searchResults = searchLocal(query).slice(0, 40);

  // Seleção de produto na Etapa 3 para ir para Etapa 4
  const handleSelectProductForCart = (p) => {
    try {
      if (!p) return;
      setSelectedProductForCart(p);
      const rawPrice = getVal(p, 'PRECO_ATACADO', 'preco_atacado', 'PRECO', 'preco', 'PRECO_UNITARIO', 'preco_unitario') ?? p?.preco ?? '';
      setPrecoUnitarioInput(parsePriceVal(rawPrice));
      setQtdCaixasInput('1');
      setWizardStep(4);
    } catch (err) {
      console.error('Erro ao selecionar produto:', err);
      setSelectedProductForCart(p);
      setPrecoUnitarioInput('');
      setQtdCaixasInput('1');
      setWizardStep(4);
    }
  };

  // Edição de item existente no carrinho (Etapa 2 -> Etapa 4)
  const handleEditItemInCart = (item) => {
    setSelectedProductForCart(item);
    setPrecoUnitarioInput(String(item.preco || ''));
    setQtdCaixasInput(String(item.qtdCaixas || '1'));
    setWizardStep(4);
  };

  // Confirmação na Etapa 4 (Adição/Atualização no Carrinho)
  const handleConfirmAddToCart = () => {
    if (!selectedProductForCart) return;
    const precoUnit = parseFloat(precoUnitarioInput);
    const qtdCaixas = parseFloat(qtdCaixasInput);

    if (isNaN(precoUnit) || precoUnit <= 0) {
      alert('Por favor, informe um Preço Unitário válido maior que zero.');
      return;
    }
    if (isNaN(qtdCaixas) || qtdCaixas <= 0) {
      alert('Por favor, informe uma Quantidade de Caixas válida maior que zero.');
      return;
    }

    const p = selectedProductForCart;
    const codigo = getVal(p, 'CODIGO', 'codigo', 'COD') || p.codigo || '';
    const codigo_interno = getVal(p, 'CODIGO_INTERNO', 'codigo_interno', 'CODIGO_INT', 'codigo_int', 'COD_INTERNO', 'cod_interno') || p.codigo_interno || '';
    const complemento = getVal(p, 'COMPLEMENTO', 'complemento', 'COMPLEMENTO_PROD') || p.complemento || '';
    const descricao = getVal(p, 'DESCRICAO', 'descricao', 'NOME') || p.descricao || '';
    const embalagem = getVal(p, 'EMBALAGEM', 'embalagem', 'emb') || p.embalagem || 'CX';
    const colunaD = getColunaD(p);
    const totalUnidades = qtdCaixas * colunaD;
    const subtotalCalculado = totalUnidades * precoUnit;

    const newItem = {
      codigo,
      codigo_interno,
      descricao,
      complemento,
      embalagem,
      colunaD,
      qtdCaixas,
      qtd: totalUnidades,
      preco: precoUnit,
      subtotal: subtotalCalculado
    };

    const existingIndex = itens.findIndex(i => i.codigo === codigo);
    if (existingIndex >= 0) {
      const updated = [...itens];
      updated[existingIndex] = newItem;
      setItens(updated);
    } else {
      setItens([...itens, newItem]);
    }

    setSelectedProductForCart(null);
    setWizardStep(2);
  };

  const removeItem = (codigo) => {
    setItens(itens.filter(i => i.codigo !== codigo));
  };

  const totalCarrinho = useMemo(() => {
    return itens.reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);
  }, [itens]);

  const handleSalvar = async () => {
    if (!cliente.trim()) return alert('Informe o nome do cliente.');
    if (itens.length === 0) return alert('Adicione pelo menos 1 item ao carrinho.');

    setSaving(true);
    const validItems = itens.map(i => ({
      ...i,
      qtdCaixas: Number(i.qtdCaixas) || 1,
      colunaD: Number(i.colunaD) || 1,
      qtd: Number(i.qtd) || 0,
      preco: Number(i.preco) || 0,
      subtotal: Number(i.subtotal) || 0
    }));

    const total = validItems.reduce((acc, i) => acc + i.subtotal, 0);

    const prevenda = {
      cliente: cliente.trim(),
      usuario: user?.usuario || user?.name || '',
      data: new Date().toISOString(),
      itens: validItems,
      total,
      status: 'Aberta',
      atribuido: '',
    };

    try {
      await api.createPreVenda(prevenda);
      handleCloseNovaPreVenda();
      alert('Pré-venda salva com sucesso!');
    } catch (e) {
      alert('Erro ao salvar pré-venda.');
    } finally {
      setSaving(false);
    }
  };

  const assignSeparador = async (id, separadorNome) => {
    try {
      await api.updateRecord('prevendas', id, {
        atribuido: separadorNome,
        status: separadorNome ? 'Em Separação' : 'Aberta'
      });
    } catch (e) {
      alert('Erro ao atribuir.');
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleExcluirMassa = async () => {
    if (window.confirm(`Excluir ${selectedIds.length} pré-venda(s) selecionada(s)?`)) {
      try {
        await api.deleteMultiple('prevendas', selectedIds);
        setSelectedIds([]);
      } catch (e) {
        alert('Erro ao excluir.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-primary">Pré-Venda</h1>
          <p className="text-muted-foreground font-medium text-sm">Geração de orçamentos e separação</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button onClick={handleExcluirMassa} className="btn-primary bg-destructive text-destructive-foreground flex items-center gap-2 text-xs">
              <Trash2 size={16} /> Excluir ({selectedIds.length})
            </button>
          )}
          {hasPermission('Criar Prevenda') && (
            <button onClick={handleOpenNovaPreVenda} className="btn-primary flex items-center gap-2 text-xs shadow-md">
              <Plus size={16} /> Nova Pré-Venda
            </button>
          )}
        </div>
      </div>

      {/* BANNER DE FILTROS INTELIGENTES */}
      <div className="erp-card p-4 bg-card border border-border space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Cliente ou Vendedor..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-xl bg-background font-semibold focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-muted-foreground shrink-0">De:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-2 text-xs border border-border rounded-xl bg-background font-semibold focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-muted-foreground shrink-0">Até:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-2 text-xs border border-border rounded-xl bg-background font-semibold focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-background font-semibold focus:outline-none focus:border-orange-500"
            >
              <option value="todos">Todos os Status</option>
              <option value="Aberta">Aberta</option>
              <option value="Em Separação">Em Separação</option>
              <option value="Finalizada">Finalizada</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
            <span className="text-muted-foreground font-semibold">
              Exibindo <strong className="text-foreground">{sortedHistorico.length}</strong> de {historico.length} pré-vendas
            </span>
            <button
              onClick={handleClearFilters}
              className="text-orange-600 dark:text-orange-400 hover:underline font-bold flex items-center gap-1"
            >
              <RotateCcw size={12} /> Limpar Filtros
            </button>
          </div>
        )}
      </div>

      <div className="erp-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-primary"><Loader2 className="animate-spin mx-auto w-8 h-8" /></div>
        ) : sortedHistorico.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <ShoppingCart size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold text-sm">Nenhuma pré-venda encontrada.</p>
            {hasActiveFilters && <p className="text-xs mt-1 text-muted-foreground">Tente ajustar os filtros aplicados acima.</p>}
          </div>
        ) : (
          <>
            <table className="hidden md:table w-full text-left text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      onChange={(e) => setSelectedIds(e.target.checked ? sortedHistorico.map(h => h.firebaseId) : [])}
                      checked={selectedIds.length === sortedHistorico.length && sortedHistorico.length > 0}
                    />
                  </th>
                  {renderSortHeader('Cliente / ID', 'cliente')}
                  {renderSortHeader('Data', 'data')}
                  {renderSortHeader('Vendedor', 'usuario')}
                  {renderSortHeader('Total', 'total', 'right')}
                  {renderSortHeader('Status', 'status', 'center')}
                  {renderSortHeader('Separador', 'atribuido', 'center')}
                  <th className="px-4 py-3 font-bold text-center text-xs uppercase tracking-wider text-muted-foreground">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedHistorico.map(h => (
                  <tr key={h.firebaseId} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(h.firebaseId)} onChange={() => handleToggleSelect(h.firebaseId)} /></td>
                    <td className="px-4 py-3">
                      <p className="font-extrabold text-foreground text-sm truncate max-w-[220px]">{h.cliente || 'CLIENTE NÃO INFORMADO'}</p>
                      <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400">#{h.firebaseId?.slice(-6) || h.id}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium">{new Date(h.data || h.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{h.usuario || '-'}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-foreground">{formatCurrency(h.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase shadow-2xs",
                        h.status === 'Aberta' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200/80' :
                          h.status === 'Finalizada' ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300 border border-green-200/80' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80'
                      )}>
                        {h.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasPermission('Acesso Requisições') ? (
                        <select
                          value={h.atribuido || ''}
                          onChange={(e) => assignSeparador(h.firebaseId, e.target.value)}
                          className="bg-background border border-border rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:border-orange-500"
                        >
                          <option value="">Não atribuído</option>
                          {repositores.map((r, i) => (
                            <option key={i} value={r.Usuario || r.usuario}>{r.Usuario || r.usuario}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-semibold">{h.atribuido || 'N/A'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => generatePreVendaPDF(h)} className="text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 p-2 rounded-lg transition-colors" title="Gerar PDF">
                        <FileText size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* CARD LIST MOBILE */}
            <div className="md:hidden divide-y divide-border">
              {sortedHistorico.map(h => (
                <div key={h.firebaseId} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <input type="checkbox" checked={selectedIds.includes(h.firebaseId)} onChange={() => handleToggleSelect(h.firebaseId)} className="w-5 h-5 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-foreground text-base truncate leading-tight">{h.cliente || 'CLIENTE NÃO INFORMADO'}</p>
                        <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400 mt-0.5">
                          #{h.firebaseId?.slice(-6) || h.id} • {new Date(h.data || h.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0",
                      h.status === 'Aberta' ? 'bg-orange-100 text-orange-700' :
                        h.status === 'Finalizada' ? 'bg-green-100 text-green-700' :
                          'bg-blue-100 text-blue-700'
                    )}>{h.status}</span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground font-semibold flex justify-between">
                    <span>Vendedor: <strong className="text-foreground">{h.usuario || '-'}</strong></span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <p className="font-black text-lg text-orange-600 dark:text-orange-400">{formatCurrency(h.total)}</p>
                    <div className="flex items-center gap-2">
                      {hasPermission('Acesso Requisições') ? (
                        <select
                          value={h.atribuido || ''}
                          onChange={(e) => assignSeparador(h.firebaseId, e.target.value)}
                          className="bg-background border border-border rounded-lg px-2 py-1 text-xs font-semibold max-w-[120px]"
                        >
                          <option value="">S/ Atrib.</option>
                          {repositores.map((r, i) => (
                            <option key={i} value={r.Usuario || r.usuario}>{r.Usuario || r.usuario}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs bg-muted px-2 py-1 rounded font-semibold">{h.atribuido || 'S/ Atrib.'}</span>
                      )}
                      <button onClick={() => generatePreVendaPDF(h)} className="text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 p-1.5 rounded-lg">
                        <FileText size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ======================================================== */}
      {/* WIZARD EM ETAPAS: NOVA PRÉ-VENDA                           */}
      {/* ======================================================== */}
      {isNovaPreVenda && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200">
          
          {/* ETAPA 1: IDENTIFICAÇÃO DO CLIENTE */}
          {wizardStep === 1 && (
            <div className="bg-card w-full max-w-lg rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border border-border/80 animate-in zoom-in-95 duration-200 flex flex-col">
              <div className="p-4 md:p-6 border-b border-border bg-gradient-to-r from-orange-500/10 via-primary/5 to-transparent flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                    <User size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-tight text-foreground">Etapa 1: Cliente</h2>
                    <p className="text-xs text-muted-foreground font-semibold">Identificação da Pré-Venda</p>
                  </div>
                </div>
                <button onClick={handleCloseNovaPreVenda} className="p-2 text-muted-foreground hover:text-foreground rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <User size={14} className="text-orange-500" /> Nome do Cliente *
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Ex: Supermercado Silva / Carlos Ribeiro"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && cliente.trim()) {
                        setWizardStep(2);
                      }
                    }}
                    className="w-full h-12 px-4 border border-border rounded-xl bg-background font-bold text-base focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseNovaPreVenda}
                    className="px-4 py-2.5 rounded-xl border border-border font-bold text-xs hover:bg-muted text-muted-foreground transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!cliente.trim()}
                    onClick={() => {
                      if (!cliente.trim()) return alert('Informe o nome do cliente.');
                      setWizardStep(2);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    <span>Confirmar</span>
                    <Check size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 2: CARRINHO DE COMPRAS */}
          {wizardStep === 2 && (
            <div className="bg-card w-full max-w-4xl h-[92vh] md:h-[85vh] rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-border/80 animate-in zoom-in-95 duration-200">
              
              {/* Topo / Header da Etapa 2 */}
              <div className="p-4 border-b border-border bg-gradient-to-r from-orange-500/10 via-primary/5 to-transparent flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setWizardStep(1)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all shrink-0"
                    title="Editar Cliente"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase bg-orange-500/15 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-md">
                        Cliente
                      </span>
                      <p className="font-extrabold text-sm md:text-base text-foreground truncate">{cliente}</p>
                      <button onClick={() => setWizardStep(1)} className="text-muted-foreground hover:text-orange-500 transition-colors" title="Alterar cliente">
                        <Edit2 size={13} />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-semibold">Carrinho de Compras ({itens.length} {itens.length === 1 ? 'item' : 'itens'})</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseNovaPreVenda}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Botão de Adicionar Produto Bem Destacado */}
              <div className="p-3 md:p-4 bg-muted/30 border-b border-border flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setWizardStep(3);
                  }}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <Plus size={20} className="stroke-[3]" />
                  <span>Adicionar Produto ao Carrinho</span>
                </button>
              </div>

              {/* Lista de Itens no Carrinho (Com overflow-y-auto interno) */}
              <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-3 custom-scrollbar min-h-0 bg-background">
                {itens.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center mb-3">
                      <ShoppingCart size={32} />
                    </div>
                    <h3 className="font-extrabold text-sm uppercase text-foreground tracking-wider">Carrinho Vazio</h3>
                    <p className="text-xs text-muted-foreground max-w-xs mt-1">
                      Clique no botão <strong>"+ Adicionar Produto"</strong> acima para pesquisar e incluir itens no orçamento.
                    </p>
                  </div>
                ) : (
                  itens.map((item, idx) => (
                    <div
                      key={item.codigo + '-' + idx}
                      className="p-4 border border-border bg-card rounded-2xl shadow-2xs space-y-2 hover:border-orange-500/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-orange-500/10 text-orange-600 dark:text-orange-400">
                              #{item.codigo}
                            </span>
                            {item.codigo_interno && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted text-muted-foreground">
                                Int: {item.codigo_interno}
                              </span>
                            )}
                          </div>
                          <p className="font-extrabold text-sm text-foreground truncate mt-1">{item.descricao}</p>
                          {item.complemento && (
                            <p className="text-[11px] text-muted-foreground font-semibold italic">{item.complemento}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleEditItemInCart(item)}
                            className="p-1.5 text-muted-foreground hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg transition-colors"
                            title="Editar quantidade/preço"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => removeItem(item.codigo)}
                            className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Remover item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Métricas do Item Calculadas (Preço Unit, Caixas x Coluna D, Subtotal) */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-xs items-center bg-muted/20 p-2.5 rounded-xl">
                        <div>
                          <span className="text-[9px] font-black uppercase text-muted-foreground block">Preço Unitário:</span>
                          <span className="font-extrabold text-foreground text-xs md:text-sm">
                            {formatCurrency(item.preco)}
                          </span>
                        </div>

                        <div className="text-center">
                          <span className="text-[9px] font-black uppercase text-muted-foreground block">Qtd Total:</span>
                          <span className="font-extrabold text-foreground text-xs md:text-sm">
                            {item.qtdCaixas} cx ({item.qtd} un)
                          </span>
                          <span className="text-[9px] text-muted-foreground block font-medium">({item.colunaD} un/cx)</span>
                        </div>

                        <div className="text-right">
                          <span className="text-[9px] font-black uppercase text-muted-foreground block">Subtotal Item:</span>
                          <span className="font-black text-orange-600 dark:text-orange-400 text-sm md:text-base">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Rodapé Fixo na Etapa 2: Total e Botão de Salvar/Emitir */}
              <div className="p-4 border-t border-border bg-card shadow-lg space-y-3 shrink-0">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-black text-xs uppercase tracking-wider text-muted-foreground block">Valor Total da Venda:</span>
                    <span className="text-[11px] text-muted-foreground font-semibold">{itens.length} {itens.length === 1 ? 'produto' : 'produtos'} no carrinho</span>
                  </div>
                  <span className="text-2xl md:text-3xl font-black text-orange-600 dark:text-orange-400">
                    {formatCurrency(totalCarrinho)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={saving || itens.length === 0}
                  className="w-full h-12 bg-orange-500 hover:bg-orange-600 active:scale-98 text-white font-extrabold uppercase tracking-wider text-xs md:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar e Emitir Pré-Venda
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 3: PESQUISA DE PRODUTOS (OVERLAY) */}
          {wizardStep === 3 && (
            <div className="bg-card w-full max-w-4xl h-[92vh] md:h-[85vh] rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-border/80 animate-in zoom-in-95 duration-200">
              
              {/* Header da Pesquisa */}
              <div className="p-4 border-b border-border bg-gradient-to-r from-orange-500/10 via-primary/5 to-transparent flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h2 className="text-base md:text-lg font-black uppercase tracking-tight text-foreground">Etapa 3: Pesquisa de Produtos</h2>
                    <p className="text-[11px] text-muted-foreground font-semibold">Selecione um produto para definir a quantidade</p>
                  </div>
                </div>

                <button
                  onClick={() => setWizardStep(2)}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Campo de Pesquisa */}
              <div className="p-3 md:p-4 border-b border-border bg-background shrink-0">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input
                    type="text"
                    autoFocus
                    className="w-full h-11 pl-10 pr-4 border border-border rounded-xl bg-card font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    placeholder="Digite código, EAN/SKU ou descrição do produto..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Resultados da Pesquisa (OCULTANDO OS PREÇOS!) */}
              <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2.5 custom-scrollbar min-h-0 bg-muted/10">
                {!query ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <Search size={40} className="mb-2 opacity-30 text-orange-500" />
                    <p className="text-xs font-bold uppercase tracking-wider">Catálogo de Produtos</p>
                    <p className="text-xs opacity-70 mt-1">Digite no campo acima para buscar no estoque.</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="text-xs font-bold">Nenhum produto encontrado para "{query}".</p>
                  </div>
                ) : (
                  searchResults.map((p, idx) => {
                    const estoque = getEstoque(p);
                    const isLowStock = estoque <= 10;
                    const isZeroStock = estoque <= 0;
                    const codigo = getVal(p, 'CODIGO', 'codigo', 'COD') || p.codigo || '';
                    const codigo_interno = getVal(p, 'CODIGO_INTERNO', 'codigo_interno', 'CODIGO_INT', 'codigo_int') || p.codigo_interno || '';
                    const descricao = getVal(p, 'DESCRICAO', 'descricao', 'NOME') || p.descricao || '';
                    const complemento = getVal(p, 'COMPLEMENTO', 'complemento', 'COMPLEMENTO_PROD') || p.complemento || '';
                    const colunaD = getColunaD(p);

                    return (
                      <div
                        key={(codigo || 'prod') + '-' + idx}
                        onClick={() => handleSelectProductForCart(p)}
                        className="p-3.5 border border-border hover:border-orange-500 rounded-2xl flex justify-between items-center bg-card hover:bg-orange-500/5 transition-all cursor-pointer group shadow-2xs active:scale-[0.99]"
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-orange-500/10 text-orange-600 dark:text-orange-400">
                              Código: #{codigo}
                            </span>
                            {codigo_interno && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted text-muted-foreground">
                                Int: {codigo_interno}
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-muted text-foreground">
                              {colunaD} un/cx
                            </span>
                          </div>

                          <p className="font-extrabold text-sm text-foreground truncate mt-1.5 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                            {descricao}
                          </p>

                          {complemento && (
                            <p className="text-xs text-muted-foreground font-semibold mt-0.5 italic">
                              Complemento: {complemento}
                            </p>
                          )}

                          {/* Destaque de Estoque (SEM PREÇOS) */}
                          <div className="mt-2 flex items-center gap-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1",
                              isZeroStock ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" :
                                isLowStock ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" :
                                  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            )}>
                              {isZeroStock ? (
                                <>
                                  <AlertTriangle size={12} /> Sem Estoque (0)
                                </>
                              ) : isLowStock ? (
                                <>
                                  <AlertTriangle size={12} /> Estoque Baixo: {estoque} un
                                </>
                              ) : (
                                <>
                                  <Package size={12} /> Estoque: {estoque} un
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="h-10 px-4 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all shrink-0 pointer-events-none"
                        >
                          <Plus size={16} /> Selecionar
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ETAPA 4: ADIÇÃO AO CARRINHO E CÁLCULO DE VENDA (CAIXA -> UNIDADE) */}
          {wizardStep === 4 && selectedProductForCart && (
            <div className="bg-card w-full max-w-md rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border border-border/80 animate-in zoom-in-95 duration-200 flex flex-col">
              
              {/* Header da Etapa 4 */}
              <div className="p-4 border-b border-border bg-gradient-to-r from-orange-500/10 via-primary/5 to-transparent flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWizardStep(3)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h3 className="font-black text-sm uppercase text-foreground tracking-tight">Etapa 4: Preço e Quantidade</h3>
                </div>
                <button onClick={() => setWizardStep(3)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Resumo do Produto Selecionado */}
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1">
                  <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400">
                    #{getVal(selectedProductForCart, 'CODIGO', 'codigo', 'COD') || selectedProductForCart.codigo || ''}
                  </span>
                  <p className="font-extrabold text-xs text-foreground leading-tight">
                    {getVal(selectedProductForCart, 'DESCRICAO', 'descricao', 'NOME') || selectedProductForCart.descricao || ''}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-semibold">
                    Fator Embalagem (Coluna D): <strong className="text-foreground">{getColunaD(selectedProductForCart)} un/caixa</strong>
                  </p>
                </div>

                {/* Form Inputs: Preço Unitário & Qtd de Caixas */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">
                      Preço Unitário (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      autoFocus
                      placeholder="0.00"
                      value={precoUnitarioInput}
                      onChange={(e) => setPrecoUnitarioInput(e.target.value)}
                      className="w-full h-11 px-3.5 border border-border rounded-xl bg-background font-bold text-sm focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">
                      Quantidade (em Caixas) *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      inputMode="numeric"
                      placeholder="Ex: 1, 5, 10"
                      value={qtdCaixasInput}
                      onChange={(e) => setQtdCaixasInput(e.target.value)}
                      className="w-full h-11 px-3.5 border border-border rounded-xl bg-background font-bold text-sm focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Quadro com a Matemática do Carrinho (Regra de Negócio) */}
                {(() => {
                  const pUnit = parseFloat(precoUnitarioInput) || 0;
                  const qCxs = parseFloat(qtdCaixasInput) || 0;
                  const cD = getColunaD(selectedProductForCart);
                  const totalUnidades = qCxs * cD;
                  const subtotal = totalUnidades * pUnit;

                  return (
                    <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between text-muted-foreground font-semibold">
                        <span>Qtd Total em Unidades:</span>
                        <span className="font-extrabold text-foreground">{qCxs} cx × {cD} un = <strong>{totalUnidades} un</strong></span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-orange-500/20">
                        <span className="font-black uppercase text-xs text-foreground">Valor Total do Item:</span>
                        <span className="font-black text-base text-orange-600 dark:text-orange-400">
                          {formatCurrency(subtotal)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Botões da Etapa 4 */}
                <div className="pt-2 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-muted text-muted-foreground transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddToCart}
                    className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Plus size={16} />
                    <span>Adicionar ao Carrinho</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}