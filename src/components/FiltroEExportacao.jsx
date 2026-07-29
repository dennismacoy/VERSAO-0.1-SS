import React, { useState } from 'react';
import { Search, Filter, FileText, Download, Plus, ListFilter, X, Calendar } from 'lucide-react';

export default function FiltroEExportacao({
  searchQuery,
  setSearchQuery,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  statusFilter,
  setStatusFilter,
  statusOptions = [],
  sectorFilter,
  setSectorFilter,
  sectorOptions = [],
  completionFilter,
  setCompletionFilter,
  counts = { pending: 0, completed: 0, total: 0 },
  onExportPDF,
  onExportCSV,
  onAddClick,
  addBtnText = 'Novo Registro',
  activeTab = 'tasks',
  canExport = true,
  canCreate = true
}) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const hasActiveFilters = Boolean(searchQuery || startDate || endDate || statusFilter || sectorFilter);

  const clearAllFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    if (setStatusFilter) setStatusFilter('');
    if (setSectorFilter) setSectorFilter('');
  };

  return (
    <div className="space-y-3">
      {/* BARRA PRINCIPAL (PESQUISA, BOTÕES DE EXPORTAÇÃO E NOVO REGISTRO) */}
      <div className="bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* BUSCA TEXTUAL E BOTÃO FILTROS AVANÇADOS */}
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
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* FILTROS RÁPIDOS (STATUS E SETOR SE FOR TAREFAS/TI/PREVENTIVA) */}
          <div className="flex gap-2">
            {statusOptions && statusOptions.length > 0 && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 text-xs md:h-11 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 font-semibold focus:outline-none focus:border-green-600 max-w-[150px] truncate"
              >
                <option value="">Status (Todos)</option>
                {statusOptions.map((st, i) => (
                  <option key={i} value={st}>{st}</option>
                ))}
              </select>
            )}

            {sectorOptions && sectorOptions.length > 0 && (
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="h-10 text-xs md:h-11 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 font-semibold focus:outline-none focus:border-green-600 max-w-[150px] truncate"
              >
                <option value="">{activeTab === 'preventive' ? 'Categoria (Todas)' : 'Setor (Todos)'}</option>
                {sectorOptions.map((s, i) => {
                  const val = typeof s === 'object' ? s.nome || s.name : s;
                  return <option key={i} value={val}>{val}</option>;
                })}
              </select>
            )}

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`h-10 md:h-11 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                showAdvancedFilters || startDate || endDate
                  ? 'bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300'
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300'
              }`}
              title="Filtro por Período de Datas"
            >
              <Calendar size={14} />
              <span className="hidden sm:inline">Período</span>
              {(startDate || endDate) && <span className="w-2 h-2 rounded-full bg-green-600"></span>}
            </button>
          </div>
        </div>

        {/* BOTÕES DE EXPORTAÇÃO E ADICIONAR */}
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <>
              <button
                onClick={onExportPDF}
                className="h-10 md:h-11 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                title="Exportar lista visível para PDF"
              >
                <FileText size={14} className="text-rose-600 dark:text-rose-400" />
                <span className="hidden sm:inline">Gerar</span> PDF
              </button>

              <button
                onClick={onExportCSV}
                className="h-10 md:h-11 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                title="Exportar lista visível para CSV"
              >
                <Download size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Gerar</span> CSV
              </button>
            </>
          )}

          {canCreate && onAddClick && (
            <button
              onClick={onAddClick}
              className="h-10 md:h-11 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all ml-auto lg:ml-0"
            >
              <Plus size={16} />
              <span>{addBtnText}</span>
            </button>
          )}
        </div>
      </div>

      {/* PAINEL DE FILTRO POR DATA (EXPANSÍVEL) */}
      {showAdvancedFilters && (
        <div className="bg-slate-50 dark:bg-zinc-900/90 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Filter size={13} /> Filtrar por Período:
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 text-xs px-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-medium"
            />
            <span className="text-xs text-slate-400 font-bold">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 text-xs px-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-medium"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1 ml-auto"
            >
              <X size={12} /> Limpar Filtros
            </button>
          )}
        </div>
      )}

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
          Pendentes ({counts.pending})
        </button>
        <button
          onClick={() => setCompletionFilter('completed')}
          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex-shrink-0 ${
            completionFilter === 'completed'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-800'
          }`}
        >
          Concluídos ({counts.completed})
        </button>
        <button
          onClick={() => setCompletionFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex-shrink-0 ${
            completionFilter === 'all'
              ? 'bg-green-600 text-white shadow-xs'
              : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-800'
          }`}
        >
          Todos ({counts.total})
        </button>
      </div>
    </div>
  );
}
