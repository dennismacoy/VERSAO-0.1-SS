import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  Search,
  FileText,
  Download,
  Calendar,
  History as HistoryIcon,
  Filter,
  Loader2,
  DollarSign,
  X
} from 'lucide-react';
import { api } from '../lib/api';
import { generateRelatorioPDF } from '../lib/pdfGenerator';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { listenToNode } from '../lib/firebase';
import { cn, parseEstoque, getEstoqueNumerico, formatCurrency } from '../lib/utils';

export default function Relatorios() {
  const { hasPermission, user } = useAuth();
  const [activeTab, setActiveTab] = useState('geral');
  const canSeeAtual = hasPermission('Ver Aba Atual');
  const canSeeHistorico = hasPermission('Ver Aba Histórico');

  // Ajusta a aba inicial caso a padrão não tenha permissão
  useEffect(() => {
    if (!canSeeAtual && canSeeHistorico) setActiveTab('historico');
    if (canSeeAtual && !canSeeHistorico) setActiveTab('geral');
  }, [canSeeAtual, canSeeHistorico]);

  const [query, setQuery] = useState('');
  const [selectedRazao, setSelectedRazao] = useState('');
  const { products: cacheProducts, loading: globalLoading, hasLoaded } = useProducts();
  const [visibleCount, setVisibleCount] = useState(20);

  const [reportHistory, setReportHistory] = useState([]);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const unsubRef = useRef(null);

  // Listener em tempo real para histórico de relatórios
  useEffect(() => {
    unsubRef.current = listenToNode('relatorios_hist', (items) => {
      setReportHistory(items);
    });
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  // Scroll Lock: trava o body quando o modal de PDF está aberto
  useEffect(() => {
    if (showPdfModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showPdfModal]);

  const filteredData = React.useMemo(() => {
    return cacheProducts.filter(item => {
      const term = query.toLowerCase();
      const desc = (item.DESCRICAO || item.descricao || '').toLowerCase();
      const rz = (item.RAZAOSOCIAL || item.razaosocial || '').toLowerCase();
      const cod = (item.CODIGO || item.codigo || '').toString().toLowerCase();

      const matchTerm = desc.includes(term) || rz.includes(term) || cod.includes(term);
      if (selectedRazao) {
        return matchTerm && (item.RAZAOSOCIAL || item.razaosocial) === selectedRazao;
      }
      return matchTerm;
    });
  }, [cacheProducts, query, selectedRazao]);

  const visibleData = filteredData.slice(0, visibleCount);

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 100;
    if (bottom && visibleCount < filteredData.length) {
      setVisibleCount(prev => prev + 20);
    }
  };

  const handleRowClick = (item) => {
    const rz = item.RAZAOSOCIAL || item.razaosocial;
    if (rz) {
      setSelectedRazao(rz);
      setQuery('');
    }
  };

  // Total em Risco (IDW): (itens > 7 dias sem venda que TÊM estoque) + Valor em Estoque desses itens
  const riskAnalysis = React.useMemo(() => {
    let totalInRisk = 0;
    let riskCount = 0;

    filteredData.forEach(item => {
      const estoqueStr = item.ESTOQUE || item.QTE || item.estoque || 0;
      const temEstoque = parseEstoque(estoqueStr);
      const diasSemVenda = Number(item.DIAS_SEM_VENDA || item.ISV || item.dias_sem_venda || 0);
      const estoqueNum = getEstoqueNumerico(estoqueStr);
      const custo = Number(item.CUSTO || item.PRECO || item.custo || 0);
      const valorEstoque = estoqueNum * custo;

      // Itens Críticos (+6 Dias): Filtrar APENAS itens que tenham estoque
      if (diasSemVenda > 6 && temEstoque) {
        riskCount++;
        // Total em Risco (IDW): soma dos valores dos itens > 7 dias sem venda com estoque
        totalInRisk += valorEstoque;
      }
    });

    return { totalInRisk, riskCount };
  }, [filteredData]);

  // Modal: pergunta "Com estoque" ou "Todos" antes de gerar PDF
  const handleGerarPDFClick = () => {
    setShowPdfModal(true);
  };

  const handleGerarPDFConfirm = (filterType) => {
    setShowPdfModal(false);
    let dataParaPDF = filteredData;

    if (filterType === 'com_estoque') {
      dataParaPDF = filteredData.filter(item => {
        const estoqueStr = item.ESTOQUE || item.QTE || item.estoque || 0;
        return parseEstoque(estoqueStr);
      });
    }

    generateRelatorioPDF(dataParaPDF, riskAnalysis.totalInRisk, selectedRazao);
  };

  const handleSaveToHistory = async () => {
    const apenasComEstoque = window.confirm(
      'Deseja guardar o relatório apenas com itens COM ESTOQUE?\n\nClique OK para apenas com estoque, ou Cancelar para incluir todos os itens.'
    );

    let dadosParaSalvar = filteredData;
    if (apenasComEstoque) {
      dadosParaSalvar = filteredData.filter(item => {
        const estoqueStr = item.ESTOQUE || item.QTE || item.estoque || 0;
        return parseEstoque(estoqueStr);
      });
    }

    try {
      const reportData = {
        nome: `REL-${Date.now().toString().slice(-6)}`,
        data: new Date().toISOString(),
        razao: selectedRazao || 'Geral',
        itensCriticos: riskAnalysis.riskCount,
        riscoTotal: riskAnalysis.totalInRisk,
        geradoPor: user?.name || user?.usuario || 'Admin',
        valorTotal: riskAnalysis.totalInRisk,
        totalItens: dadosParaSalvar.length,
        filtro: apenasComEstoque ? 'Com Estoque' : 'Todos',
      };

      await api.saveReport(reportData);
      alert(`Relatório salvo com ${dadosParaSalvar.length} itens (${apenasComEstoque ? 'Com Estoque' : 'Todos'})!`);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar relatório.");
    }
  };

  return (
    <div className="flex flex-col space-y-6 md:space-y-8 pb-10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-foreground uppercase italic">
            Inteligência de <span className="text-primary">Dados</span>
          </h1>
          <p className="text-muted-foreground font-bold text-xs md:text-sm tracking-widest uppercase">
            Auditoria, Performance e Análise de Risco
          </p>
        </div>
        <div className="flex gap-3">
          {canSeeAtual && (
            <button
              onClick={() => setActiveTab('geral')}
              className={cn(
                "px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm border-2",
                activeTab === 'geral' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
              )}
            >
              Relatório Atual
            </button>
          )}
          {canSeeHistorico && (
            <button
              onClick={() => setActiveTab('historico')}
              className={cn(
                "px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm border-2",
                activeTab === 'historico' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
              )}
            >
              Histórico
            </button>
          )}
        </div>
      </div>

      {activeTab === 'geral' && canSeeAtual ? (
        <>
          <div className="erp-card p-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 flex gap-2 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                <input
                  type="text"
                  placeholder="Filtrar por Descrição ou Razão Social..."
                  className="w-full pl-12 pr-4 py-3 md:py-4 rounded-2xl border-2 border-border bg-background focus:border-primary font-bold transition-all text-base"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {selectedRazao && (
                <button
                  onClick={() => setSelectedRazao('')}
                  className="px-6 py-3 md:py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all min-h-[44px]"
                >
                  Limpar Razão
                </button>
              )}
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={handleSaveToHistory}
                className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-muted text-foreground font-black px-6 py-3 md:py-4 rounded-2xl transition-all shadow-sm hover:bg-muted/80 active:scale-95 uppercase tracking-widest text-xs min-h-[44px]"
              >
                <HistoryIcon size={18} />
                Guardar
              </button>
              <button
                onClick={handleGerarPDFClick}
                className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-primary text-primary-foreground font-black px-8 py-3 md:py-4 rounded-2xl transition-all shadow-xl hover:shadow-primary/20 active:scale-95 uppercase tracking-widest text-xs min-h-[44px]"
              >
                <Download size={18} />
                Gerar PDF
              </button>
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block erp-card overflow-hidden">
            <div
              className="overflow-x-auto custom-scrollbar max-h-[600px] overflow-y-auto"
              onScroll={handleScroll}
            >
              <table className="w-full text-sm text-left border-collapse">
                {/* Cabeçalho com cor opaca */}
                <thead className="bg-zinc-200 dark:bg-zinc-800 border-b-2 border-border sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-zinc-700 dark:text-zinc-300">Código</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-zinc-700 dark:text-zinc-300">Descrição</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-zinc-700 dark:text-zinc-300">Embalagem</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-zinc-700 dark:text-zinc-300 text-center">Entrada</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-zinc-700 dark:text-zinc-300 text-center">Dias S/ Venda</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-zinc-700 dark:text-zinc-300 text-center">Estoque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(!hasLoaded && globalLoading) ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-20 text-center">
                        <Loader2 className="animate-spin mx-auto text-primary w-12 h-12" />
                      </td>
                    </tr>
                  ) : visibleData.map((item, idx) => {
                    const diasSV = Number(item.DIAS_SEM_VENDA || item.ISV || item.dias_sem_venda || 0);
                    const estoqueStr = item.ESTOQUE || item.QTE || item.estoque || '0';
                    return (
                      <tr
                        key={idx}
                        onClick={() => handleRowClick(item)}
                        className={cn(
                          "hover:bg-primary/5 transition-all cursor-pointer",
                          selectedRazao === (item.RAZAOSOCIAL || item.razaosocial) ? "border-l-4 border-l-primary bg-primary/5" : "",
                          diasSV > 6 ? "bg-red-50/50 dark:bg-red-950/10" : ""
                        )}
                      >
                        <td className="px-6 py-4 font-black text-primary text-xs uppercase tracking-widest">{item.CODIGO || item.codigo}</td>
                        <td className="px-6 py-4 font-bold text-foreground">{item.DESCRICAO || item.descricao}</td>
                        <td className="px-6 py-4 text-xs font-bold text-muted-foreground">{item.EMBALAGEM || item.embalagem || item.emb || 'UN'}</td>
                        <td className="px-6 py-4 text-center text-xs font-bold">{item.ENTRADA || item.entrada || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn("font-black", diasSV > 6 ? "text-destructive" : "text-foreground")}>{diasSV}</span>
                        </td>
                        <td className="px-6 py-4 text-center font-bold">{estoqueStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARDS */}
          <div
            className="md:hidden flex flex-col gap-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-1"
            onScroll={handleScroll}
          >
            {visibleData.map((item, idx) => {
              const dias = Number(item.DIAS_SEM_VENDA || item.ISV || item.dias_sem_venda || 0);
              const estoqueStr = item.ESTOQUE || item.QTE || item.estoque || '0';
              return (
                <div
                  key={idx}
                  onClick={() => handleRowClick(item)}
                  className={cn(
                    "erp-card p-5 space-y-4 relative border-l-4 cursor-pointer",
                    dias > 6 ? "border-l-destructive" : "border-l-primary",
                    selectedRazao === (item.RAZAOSOCIAL || item.razaosocial) ? "ring-2 ring-primary bg-primary/5" : ""
                  )}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 flex-1">
                      <span className="font-black text-xs text-primary bg-primary/10 px-2 py-1 rounded-md uppercase tracking-widest inline-block">{item.CODIGO || item.codigo}</span>
                      <h3 className="font-bold text-base leading-tight mt-2">{item.DESCRICAO || item.descricao}</h3>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{item.RAZAOSOCIAL || item.razaosocial}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-dashed border-border">
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Dias S/ Venda</p>
                      <p className={cn("font-black", dias > 6 ? "text-destructive" : "text-foreground")}>{dias}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Estoque</p>
                      <p className="font-bold text-foreground">{estoqueStr}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Entrada</p>
                      <p className="font-bold text-foreground">{item.ENTRADA || item.entrada || '-'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : activeTab === 'historico' && canSeeHistorico ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportHistory.length === 0 ? (
            <div className="col-span-full erp-card p-20 flex flex-col items-center justify-center text-muted-foreground/30 border-dashed border-4">
              <HistoryIcon size={80} strokeWidth={1} />
              <p className="mt-4 font-black uppercase tracking-widest">Nenhum histórico disponível</p>
            </div>
          ) : (
            reportHistory.map((h, idx) => (
              <div key={h.firebaseId || idx} className="erp-card p-6 flex flex-col gap-4 border-l-4 border-l-primary hover:scale-[1.02]">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-muted rounded-2xl">
                    <FileText size={24} className="text-primary" />
                  </div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    {new Date(h.data || h.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">{h.nome || h.id}</h3>
                  <p className="text-xs font-bold text-muted-foreground uppercase mt-1">Gerado por: {h.geradoPor || h.responsavel}</p>
                  <p className="text-xs font-bold text-muted-foreground mt-0.5">Razão: {h.razao || 'Geral'}</p>
                </div>
                <div className="pt-4 border-t border-border flex justify-between items-center">
                  <div className="text-xs font-black text-primary uppercase">Risco: {formatCurrency(h.valorTotal || h.riscoTotal || h.total)}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Gera o PDF com os dados atuais filtrados pela razão do relatório
                        const razao = h.razao || '';
                        const dataParaPDF = razao && razao !== 'Geral'
                          ? cacheProducts.filter(p => (p.RAZAOSOCIAL || p.razaosocial) === razao)
                          : cacheProducts;
                        generateRelatorioPDF(dataParaPDF, h.valorTotal || h.riscoTotal || 0, razao);
                      }}
                      className="p-2 bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl transition-all"
                      title="Gerar PDF"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {/* Modal: Escolher "Com Estoque" ou "Todos" antes de gerar PDF */}
      {showPdfModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden">
            <div className="p-5 border-b border-border bg-primary/5 flex justify-between items-center">
              <h3 className="text-lg font-black">Gerar Relatório PDF</h3>
              <button onClick={() => setShowPdfModal(false)} className="p-1 hover:bg-destructive hover:text-destructive-foreground rounded-full">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground font-bold text-center">Escolha o tipo de filtro para o PDF:</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleGerarPDFConfirm('com_estoque')}
                  className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-sm"
                >
                  <FileText size={18} /> Com Estoque
                </button>
                <button
                  onClick={() => handleGerarPDFConfirm('todos')}
                  className="w-full bg-muted text-foreground font-bold py-4 rounded-lg flex items-center justify-center gap-2 text-sm hover:bg-muted/80 transition-all"
                >
                  <FileText size={18} /> Todos os Itens
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}