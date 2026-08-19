import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Trash2, FileText, ShoppingCart, Save, History, Loader2, Calendar, User, Search, X, ArrowUpDown, ChevronUp, ChevronDown, Filter, RotateCcw } from 'lucide-react';
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

  const [isNovaPreVenda, setIsNovaPreVenda] = useState(false);
  const [query, setQuery] = useState('');
  const [cliente, setCliente] = useState('');
  const [itens, setItens] = useState([]);
  const [saving, setSaving] = useState(false);
  const [repositores, setRepositores] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

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
      setCliente(p.cliente);
      setItens(p.itens.map(i => ({
        ...i,
        codigo_interno: i.codigo_interno || i.CODIGO_INTERNO || i.codigo_int || '',
        preco: 0
      })));
      setIsNovaPreVenda(true);
    }
  }, [location]);

  useEffect(() => {
    unsubRef.current = listenToNode('prevendas', (items) => {
      let filtered = items;
      // Se não possui permissão para ver todas as pré-vendas ou gerenciar pré-vendas, filtra por seu usuário
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

  // Listener em tempo real para usuários (separadores/repositores)
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

  // Hook para Ordenação de Colunas
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

  const searchResults = searchLocal(query).slice(0, 30);

  const handleAddItem = (p) => {
    const codigo = p.CODIGO || p.codigo;
    const codigo_interno = p.CODIGO_INTERNO || p.codigo_interno || p.CODIGO_INT || p.codigo_int || p.COD_INTERNO || p.cod_interno || '';
    const exists = itens.find(i => i.codigo === codigo);
    if (exists) {
      setItens(itens.map(i => i.codigo === exists.codigo ? { ...i, qtd: i.qtd + 1 } : i));
    } else {
      setItens([...itens, {
        codigo,
        codigo_interno,
        descricao: p.DESCRICAO || p.descricao,
        embalagem: p.EMBALAGEM || p.embalagem || p.emb || 'UN',
        qtd: 1,
        preco: Number(p.PRECO_ATACADO || p.preco_atacado || 0)
      }]);
    }
    setQuery('');
  };

  const updateItem = (codigo, field, value) => {
    setItens(itens.map(i => i.codigo === codigo ? { ...i, [field]: value === '' ? '' : Number(value) } : i));
  };

  const removeItem = (codigo) => {
    setItens(itens.filter(i => i.codigo !== codigo));
  };

  const handleSalvar = async () => {
    if (!cliente) return alert('Informe o cliente.');
    if (itens.length === 0) return alert('Adicione itens.');

    setSaving(true);
    const validItems = itens.map(i => ({
      ...i,
      qtd: Number(i.qtd) || 0,
      preco: Number(i.preco) || 0,
      subtotal: (Number(i.qtd) || 0) * (Number(i.preco) || 0)
    }));

    const total = validItems.reduce((acc, i) => acc + i.subtotal, 0);

    const prevenda = {
      cliente,
      usuario: user?.usuario || user?.name || '',
      data: new Date().toISOString(),
      itens: validItems,
      total,
      status: 'Aberta',
      atribuido: '',
    };

    try {
      await api.createPreVenda(prevenda);
      setCliente('');
      setItens([]);
      setIsNovaPreVenda(false);
      alert('Pré-venda salva!');
    } catch (e) {
      alert('Erro ao salvar.');
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
            <button onClick={() => setIsNovaPreVenda(true)} className="btn-primary flex items-center gap-2 text-xs">
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
                    {/* Destaque no Nome do Cliente */}
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
                        {/* Destaque do Cliente no Mobile */}
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

      {/* MODAL: Nova Pré-Venda */}
      {isNovaPreVenda && (
        <div className="fixed inset-0 z-[100] flex flex-col md:items-center md:justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full h-full md:max-w-5xl md:h-auto md:max-h-[92vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-border/80 animate-in zoom-in-95 duration-200">
            
            {/* Header do Modal */}
            <div className="pt-6 md:pt-4 px-6 py-4 border-b border-border bg-gradient-to-r from-orange-500/10 via-primary/5 to-transparent flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                  <ShoppingCart size={22} />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-foreground">Nova Pré-Venda</h2>
                  <p className="text-xs text-muted-foreground font-semibold">Monte o orçamento selecionando o cliente e os produtos</p>
                </div>
              </div>

              <button
                onClick={() => setIsNovaPreVenda(false)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all"
              >
                <X size={22} />
              </button>
            </div>

            {/* Corpo do Modal (Split Panel) */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              
              {/* Painel Esquerdo: Busca de Produtos & Cliente */}
              <div className="w-full md:w-1/2 p-5 md:border-r border-b md:border-b-0 border-border flex flex-col gap-4 shrink-0 md:shrink md:min-h-0 max-h-[50vh] md:max-h-none bg-background">
                <div>
                  <label className="block text-[11px] font-black uppercase text-muted-foreground tracking-wider mb-1 flex items-center gap-1.5">
                    <User size={13} className="text-orange-500" /> Nome do Cliente *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Supermercado Silva / Carlos Ribeiro"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    className="w-full h-11 px-3.5 border border-border rounded-xl bg-card font-bold text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-muted-foreground tracking-wider mb-1 flex items-center gap-1.5">
                    <Search size={13} className="text-orange-500" /> Pesquisar Produtos
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                      type="text"
                      className="w-full h-11 pl-10 pr-4 border border-border rounded-xl bg-card font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                      placeholder="Digite o código ou nome do produto..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Lista de Resultados */}
                <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-1 min-h-0">
                  {!query ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                      <Search size={36} className="mb-2 opacity-30 text-orange-500" />
                      <p className="text-xs font-bold uppercase tracking-wider">Busca de Catálogo</p>
                      <p className="text-[11px] opacity-70 mt-0.5">Digite no campo acima para pesquisar produtos em tempo real.</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <p className="text-xs font-bold">Nenhum produto encontrado para "{query}".</p>
                    </div>
                  ) : (
                    searchResults.map(p => (
                      <div
                        key={p.CODIGO || p.codigo}
                        className="p-3 border border-border hover:border-orange-500/50 rounded-2xl flex justify-between items-center bg-card hover:bg-orange-500/5 transition-all group"
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-orange-500/10 text-orange-600 dark:text-orange-400">
                              #{p.CODIGO || p.codigo}
                            </span>
                            {p.CODIGO_INTERNO && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted text-muted-foreground">
                                Int: {p.CODIGO_INTERNO}
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-xs text-foreground truncate mt-1">{p.DESCRICAO || p.descricao}</p>
                          <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                            Emb: <span className="text-foreground font-bold">{p.EMBALAGEM || p.embalagem || 'UN'}</span> | Atacado: <span className="text-orange-600 dark:text-orange-400 font-extrabold">{formatCurrency(p.PRECO_ATACADO || p.preco_atacado)}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => handleAddItem(p)}
                          className="h-9 px-3 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all shrink-0"
                        >
                          <Plus size={15} /> Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Painel Direito: Carrinho de Compras */}
              <div className="w-full md:w-1/2 p-5 flex flex-col bg-muted/20 min-h-0 flex-1 justify-between">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ShoppingCart size={15} className="text-orange-500" /> Itens no Orçamento ({itens.length})
                  </h3>
                  {itens.length > 0 && (
                    <button onClick={() => setItens([])} className="text-[11px] font-bold text-rose-500 hover:underline">
                      Limpar Tudo
                    </button>
                  )}
                </div>

                {/* Lista do Carrinho */}
                <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-1 min-h-0">
                  {itens.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                      <ShoppingCart size={40} className="mb-2 opacity-25 text-orange-500" />
                      <p className="text-xs font-bold uppercase tracking-wider">Carrinho Vazio</p>
                      <p className="text-[11px] opacity-70 mt-0.5">Selecione produtos no painel à esquerda para adicionar.</p>
                    </div>
                  ) : (
                    itens.map(item => (
                      <div key={item.codigo} className="p-3.5 border border-border bg-card rounded-2xl shadow-2xs space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="font-extrabold text-xs text-foreground truncate">{item.codigo} - {item.descricao}</p>
                            <p className="text-[10px] text-muted-foreground font-semibold">
                              Emb: {item.embalagem} {item.codigo_interno ? `| Cód. Int: ${item.codigo_interno}` : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => removeItem(item.codigo)}
                            className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors shrink-0"
                            title="Remover item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1">Quantidade:</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="1"
                              value={item.qtd}
                              onChange={(e) => updateItem(item.codigo, 'qtd', e.target.value)}
                              className="w-full h-9 text-center border border-border rounded-xl font-bold text-sm bg-background focus:outline-none focus:border-orange-500"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1">Preço Unit. (R$):</span>
                            <input
                              type="number"
                              step="0.01"
                              inputMode="decimal"
                              value={item.preco}
                              onChange={(e) => updateItem(item.codigo, 'preco', e.target.value)}
                              className="w-full h-9 text-center border border-border rounded-xl font-bold text-sm bg-background focus:outline-none focus:border-orange-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Resumo do Total & Botão de Salvar */}
                <div className="mt-4 pt-4 border-t border-border bg-card p-4 rounded-2xl shadow-xs shrink-0 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-xs uppercase tracking-wider text-muted-foreground">Valor Total:</span>
                    <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                      {formatCurrency(itens.reduce((acc, i) => acc + ((Number(i.qtd) || 0) * (Number(i.preco) || 0)), 0))}
                    </span>
                  </div>

                  <button
                    onClick={handleSalvar}
                    disabled={saving}
                    className="w-full h-12 bg-orange-500 hover:bg-orange-600 active:scale-98 text-white font-extrabold uppercase tracking-wider text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar e Emitir Pré-Venda
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}