import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BarChart3,
  Search,
  FileText,
  Download,
  Calendar,
  Filter,
  Loader2,
  DollarSign,
  X,
  QrCode,
  Plus,
  Trash2,
  SlidersHorizontal
} from 'lucide-react';
import QRCode from 'qrcode';
import { generateRelatorioPDF, generateRelatorioAvancadoPDF, gerarPdfRelatorioAvancado } from '../lib/pdfGenerator';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { cn, parseEstoque, getEstoqueNumerico, formatCurrency, parseNumericValue, isEstoquePositivo, getItemEstoqueVal } from '../lib/utils';

export default function Relatorios() {
  const { hasPermission } = useAuth();
  const canSeeAtual = hasPermission('Ver Aba Atual');

  // Sistema de Abas ('geral' | 'avancado')
  const [activeTab, setActiveTab] = useState('geral');

  // ESTADOS - ABA GERAL
  const [query, setQuery] = useState('');
  const [selectedRazao, setSelectedRazao] = useState('');
  const { products: cacheProducts, loading: globalLoading, hasLoaded } = useProducts();
  const [visibleCount, setVisibleCount] = useState(20);

  const [razoesSelecionadas, setRazoesSelecionadas] = useState([]);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const qrCanvasRef = useRef(null);

  // ESTADOS - ABA AVANÇADO
  const [advQuery, setAdvQuery] = useState('');
  const [selectedCorredores, setSelectedCorredores] = useState([]);
  const [minDiasSemVendas, setMinDiasSemVendas] = useState('');
  const [advEstoqueFilter, setAdvEstoqueFilter] = useState('com_estoque'); // 'com_estoque' | 'todos'
  const [advSort, setAdvSort] = useState('descricao_asc'); // 'descricao_asc' | 'dias_desc' | 'valor_desc'
  const [advVisibleCount, setAdvVisibleCount] = useState(30);

  // Scroll Lock: trava o body quando o modal de PDF ou QR Code está aberto
  useEffect(() => {
    if (showPdfModal || showQrModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showPdfModal, showQrModal]);

  // Renderiza o QR Code no canvas do modal
  useEffect(() => {
    if (showQrModal && qrCodeUrl && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, qrCodeUrl, {
        width: 250,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, (err) => {
        if (err) console.error('Erro ao gerar QR Code:', err);
      });
    }
  }, [showQrModal, qrCodeUrl]);

  // --- LÓGICA DA ABA GERAL ---
  const filteredData = useMemo(() => {
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

  // Total em Risco (IDW)
  const riskAnalysis = useMemo(() => {
    let totalInRisk = 0;
    let riskCount = 0;

    filteredData.forEach(item => {
      const diasSemVenda = Number(item.DIAS_SEM_VENDA || item.ISV || item.dias_sem_venda || 0);
      const valorEstoque = parseNumericValue(item.VALOR_ESTOQUE ?? item.valor_estoque);

      if (diasSemVenda > 6 && isEstoquePositivo(item)) {
        riskCount++;
        totalInRisk += valorEstoque;
      }
    });

    return { totalInRisk, riskCount };
  }, [filteredData]);

  const handleGerarPDFClick = () => {
    setShowPdfModal(true);
  };

  const handleGerarPDFConfirm = (filterType) => {
    setShowPdfModal(false);

    if (razoesSelecionadas.length > 0) {
      // Geração em Lote
      const batch = razoesSelecionadas.map(rz => {
        let rzData = cacheProducts.filter(item => (item.RAZAOSOCIAL || item.razaosocial) === rz);
        if (filterType === 'com_estoque') {
          rzData = rzData.filter(item => isEstoquePositivo(item));
        } else if (filterType === 'isv') {
          rzData = rzData.filter(item => {
            const diasSemVenda = Number(item.DIAS_SEM_VENDA || item.ISV || item.dias_sem_venda || 0);
            return diasSemVenda > 6 && isEstoquePositivo(item);
          });
        }

        let rzTotalInRisk = 0;
        rzData.forEach(item => {
          const diasSemVenda = Number(item.DIAS_SEM_VENDA || item.ISV || item.dias_sem_venda || 0);
          const valorEstoque = parseNumericValue(item.VALOR_ESTOQUE ?? item.valor_estoque);

          if (diasSemVenda > 6 && isEstoquePositivo(item)) {
            rzTotalInRisk += valorEstoque;
          }
        });

        return {
          filteredData: rzData,
          totalInRisk: rzTotalInRisk,
          selectedRazao: rz
        };
      });

      generateRelatorioPDF(batch);
    } else {
      // Geração Única (Aba Geral)
      let dataParaPDF = filteredData;
      if (filterType === 'com_estoque') {
        dataParaPDF = filteredData.filter(item => isEstoquePositivo(item));
      } else if (filterType === 'isv') {
        dataParaPDF = filteredData.filter(item => {
          const diasSemVenda = Number(item.DIAS_SEM_VENDA || item.ISV || item.dias_sem_venda || 0);
          return diasSemVenda > 6 && isEstoquePositivo(item);
        });
      }

      // Calcula o total em risco exclusivamente para os itens presentes no PDF gerado
      const pdfTotalInRisk = dataParaPDF.reduce((acc, item) => {
        const diasSemVenda = Number(item.DIAS_SEM_VENDA || item.ISV || item.dias_sem_venda || 0);
        if (diasSemVenda > 6 && isEstoquePositivo(item)) {
          return acc + parseNumericValue(item.VALOR_ESTOQUE ?? item.valor_estoque);
        }
        return acc;
      }, 0);

      generateRelatorioPDF(dataParaPDF, pdfTotalInRisk, selectedRazao);
    }
  };

  const handleGuardarRazao = () => {
    if (!selectedRazao) {
      alert('Por favor, selecione uma Razão Social na tabela clicando em um item.');
      return;
    }
    if (razoesSelecionadas.includes(selectedRazao)) {
      alert('Esta Razão Social já foi adicionada à lista.');
      return;
    }
    setRazoesSelecionadas([...razoesSelecionadas, selectedRazao]);
  };

  const handleGerarQRCode = () => {
    const razoes = razoesSelecionadas.length > 0 
      ? razoesSelecionadas 
      : (selectedRazao ? [selectedRazao] : []);

    if (razoes.length === 0) {
      alert('Por favor, adicione pelo menos uma Razão Social à lista ou selecione uma na tabela para gerar o QR Code.');
      return;
    }

    const url = `${window.location.origin}/gerar-relatorio?razoes=${encodeURIComponent(razoes.join(','))}`;
    setQrCodeUrl(url);
    setShowQrModal(true);
  };

  // --- LÓGICA DA ABA AVANÇADO ---

  // Lista de corredores únicos disponíveis no estoque
  const corredoresDisponiveis = useMemo(() => {
    const set = new Set();
    cacheProducts.forEach(item => {
      const c = (item.CORREDOR || item.corredor || '').toString().trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [cacheProducts]);

  // Dados filtrados e ordenados para a aba Avançado
  const advancedFilteredData = useMemo(() => {
    let result = cacheProducts.filter(item => {
      // 1. Filtro por Descrição / Código
      if (advQuery.trim()) {
        const term = advQuery.toLowerCase();
        const desc = (item.DESCRICAO || item.descricao || '').toLowerCase();
        const cod = (item.CODIGO || item.codigo || '').toString().toLowerCase();
        if (!desc.includes(term) && !cod.includes(term)) return false;
      }

      // 2. Filtro por Corredores (1 ou mais)
      if (selectedCorredores.length > 0) {
        const itemCorredor = (item.CORREDOR || item.corredor || '').toString().trim();
        if (!selectedCorredores.includes(itemCorredor)) return false;
      }

      // 3. Filtro por Mínimo de Dias Sem Vendas
      const dias = Number(item.DIAS_SEM_VENDA || item.ISV || item.dias_sem_venda || 0);
      if (minDiasSemVendas !== '' && !isNaN(Number(minDiasSemVendas))) {
        if (dias < Number(minDiasSemVendas)) return false;
      }

      // 4. Status do Estoque
      const estoqueStr = item.ESTOQUE || item.QTE || item.estoque || 0;
      const temEstoque = parseEstoque(estoqueStr);
      if (advEstoqueFilter === 'com_estoque' && !temEstoque) {
        return false;
      }

      return true;
    });

    // Calcular Valor do Estoque e mapear campos auxiliares
    const dataWithCalc = result.map(item => {
      const estoqueStr = item.ESTOQUE || item.QTE || item.estoque || '0';
      const valEstoque = parseNumericValue(item.VALOR_ESTOQUE ?? item.valor_estoque);

      return {
        ...item,
        _valorEstoqueCalculado: valEstoque,
        _diasSemVendaNum: Number(item.DIAS_SEM_VENDA || item.ISV || item.dias_sem_venda || 0),
        _estoqueStr: estoqueStr
      };
    });

    // 5. Ordenação
    dataWithCalc.sort((a, b) => {
      if (advSort === 'descricao_asc') {
        const descA = (a.DESCRICAO || a.descricao || '').toString();
        const descB = (b.DESCRICAO || b.descricao || '').toString();
        return descA.localeCompare(descB, 'pt-BR', { sensitivity: 'base' });
      } else if (advSort === 'dias_desc') {
        return b._diasSemVendaNum - a._diasSemVendaNum;
      } else if (advSort === 'valor_desc') {
        return (b._valorEstoqueCalculado || 0) - (a._valorEstoqueCalculado || 0);
      }
      return 0;
    });

    return dataWithCalc;
  }, [cacheProducts, advQuery, selectedCorredores, minDiasSemVendas, advEstoqueFilter, advSort]);

  const visibleAdvData = advancedFilteredData.slice(0, advVisibleCount);

  const handleAdvScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 100;
    if (bottom && advVisibleCount < advancedFilteredData.length) {
      setAdvVisibleCount(prev => prev + 30);
    }
  };

  const totalAdvValorEstoque = useMemo(() => {
    return advancedFilteredData.reduce((acc, item) => acc + (item._valorEstoqueCalculado || 0), 0);
  }, [advancedFilteredData]);

  return (
    <div className="flex flex-col space-y-6 md:space-y-8 pb-10">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-foreground uppercase italic">
            Inteligência de <span className="text-primary">Dados</span>
          </h1>
          <p className="text-muted-foreground font-bold text-xs md:text-sm tracking-widest uppercase">
            Auditoria, Performance e Análise de Risco
          </p>
        </div>
      </div>

      {canSeeAtual ? (
        <>
          {/* SISTEMA DE ABAS */}
          <div className="flex border-b border-border space-x-2">
            <button
              onClick={() => setActiveTab('geral')}
              className={cn(
                "px-6 py-3 font-black text-xs uppercase tracking-widest transition-all border-b-2 -mb-px flex items-center gap-2",
                activeTab === 'geral'
                  ? "border-primary text-primary bg-primary/5 rounded-t-xl"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3 size={16} />
              Geral
            </button>
            <button
              onClick={() => setActiveTab('avancado')}
              className={cn(
                "px-6 py-3 font-black text-xs uppercase tracking-widest transition-all border-b-2 -mb-px flex items-center gap-2",
                activeTab === 'avancado'
                  ? "border-primary text-primary bg-primary/5 rounded-t-xl"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Filter size={16} />
              Avançado
            </button>
          </div>

          {/* CONTEÚDO DA ABA 1: GERAL */}
          {activeTab === 'geral' && (
            <div className="space-y-6">
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
                    onClick={handleGuardarRazao}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-muted text-foreground font-black px-4 py-3 md:px-6 md:py-4 rounded-2xl transition-all shadow-sm hover:bg-muted/80 active:scale-95 uppercase tracking-widest text-xs min-h-[44px]"
                    title="Guardar Razão"
                  >
                    <Plus size={18} />
                    <span className="hidden md:inline">Guardar</span>
                  </button>
                  <button
                    onClick={handleGerarPDFClick}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black px-4 py-3 md:px-8 md:py-4 rounded-2xl transition-all shadow-xl hover:shadow-primary/20 active:scale-95 uppercase tracking-widest text-xs min-h-[44px]"
                    title="Gerar PDF"
                  >
                    <Download size={18} />
                    <span className="hidden md:inline">Gerar PDF</span>
                  </button>
                  <button
                    onClick={handleGerarQRCode}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-accent text-accent-foreground font-black px-4 py-3 md:px-6 md:py-4 rounded-2xl transition-all shadow-md hover:bg-accent/90 active:scale-95 uppercase tracking-widest text-xs min-h-[44px]"
                    title="Gerar QR Code"
                  >
                    <QrCode size={18} />
                    <span className="hidden md:inline">QR Code</span>
                  </button>
                </div>
              </div>

              {/* Seção de Razões Sociais Selecionadas (Lote) */}
              {razoesSelecionadas.length > 0 && (
                <div className="erp-card p-5 border-l-4 border-l-primary space-y-3 bg-muted/10">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black uppercase tracking-wider text-primary">Razões Sociais Selecionadas para Lote ({razoesSelecionadas.length})</h3>
                    <button
                      onClick={() => setRazoesSelecionadas([])}
                      className="text-xs font-black text-destructive hover:underline uppercase tracking-widest"
                    >
                      Limpar Tudo
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {razoesSelecionadas.map((rz, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm">
                        <span className="text-foreground">{rz}</span>
                        <button
                          onClick={() => setRazoesSelecionadas(prev => prev.filter(item => item !== rz))}
                          className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DESKTOP TABLE */}
              <div className="hidden md:block erp-card overflow-hidden">
                <div
                  className="overflow-x-auto custom-scrollbar max-h-[600px] overflow-y-auto"
                  onScroll={handleScroll}
                >
                  <table className="w-full text-sm text-left border-collapse">
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
                        const estoqueStr = String(getItemEstoqueVal(item));
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
                  const estoqueStr = String(getItemEstoqueVal(item));
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
            </div>
          )}

          {/* CONTEÚDO DA ABA 2: AVANÇADO */}
          {activeTab === 'avancado' && (
            <div className="space-y-6">
              {/* Filtros e Controles de Estado */}
              <div className="erp-card p-5 md:p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <h2 className="text-lg font-black uppercase tracking-wider text-primary flex items-center gap-2">
                    <Filter size={20} /> Filtros do Relatório Avançado
                  </h2>
                  <button
                    onClick={() => {
                      setAdvQuery('');
                      setSelectedCorredores([]);
                      setMinDiasSemVendas('');
                      setAdvEstoqueFilter('com_estoque');
                      setAdvSort('descricao_asc');
                    }}
                    className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Limpar Filtros
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Filtro por Descrição */}
                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block">
                      Filtro por Descrição ou Código
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Digite o nome ou código..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background font-bold text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        value={advQuery}
                        onChange={(e) => setAdvQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Status do Estoque */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block">
                      Status do Estoque
                    </label>
                    <select
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-bold text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      value={advEstoqueFilter}
                      onChange={(e) => setAdvEstoqueFilter(e.target.value)}
                    >
                      <option value="com_estoque">Com estoque</option>
                      <option value="todos">Todos os itens</option>
                    </select>
                  </div>

                  {/* Dias sem Vendas (Input Numérico) */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block">
                      Mín. Dias Sem Vendas
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ex: 6"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background font-bold text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      value={minDiasSemVendas}
                      onChange={(e) => setMinDiasSemVendas(e.target.value)}
                    />
                  </div>
                </div>

                {/* Filtro por Corredor (Multiselect / Badges) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block">
                      Filtro por Corredor ({selectedCorredores.length === 0 ? 'Todos' : `${selectedCorredores.length} selecionado(s)`})
                    </label>
                    {selectedCorredores.length > 0 && (
                      <button
                        onClick={() => setSelectedCorredores([])}
                        className="text-[10px] font-black uppercase text-primary hover:underline"
                      >
                        Selecionar Todos
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-3 border border-border rounded-xl bg-background custom-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedCorredores([])}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                        selectedCorredores.length === 0
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:border-primary/50"
                      )}
                    >
                      Todos
                    </button>
                    {corredoresDisponiveis.map(corredor => {
                      const isSelected = selectedCorredores.includes(corredor);
                      return (
                        <button
                          key={corredor}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCorredores(prev => prev.filter(c => c !== corredor));
                            } else {
                              setSelectedCorredores(prev => [...prev, corredor]);
                            }
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-card text-foreground border-border hover:border-primary/50"
                          )}
                        >
                          <span>Corredor {corredor}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ordenação */}
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block">
                    Ordenar por:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setAdvSort('descricao_asc')}
                      className={cn(
                        "px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all text-center",
                        advSort === 'descricao_asc'
                          ? "bg-primary/10 border-primary text-primary shadow-sm font-black"
                          : "bg-background border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      1. Descrição (A-Z)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdvSort('dias_desc')}
                      className={cn(
                        "px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all text-center",
                        advSort === 'dias_desc'
                          ? "bg-primary/10 border-primary text-primary shadow-sm font-black"
                          : "bg-background border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      2. Dias sem venda (Maior → Menor)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdvSort('valor_desc')}
                      className={cn(
                        "px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all text-center",
                        advSort === 'valor_desc'
                          ? "bg-primary/10 border-primary text-primary shadow-sm font-black"
                          : "bg-background border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      3. Valor Estoque (Maior → Menor)
                    </button>
                  </div>
                </div>
              </div>

              {/* Resumo da Pré-visualização */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-4 rounded-2xl shadow-sm">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Itens Encontrados:</span>
                  <p className="text-xl font-black text-primary">{advancedFilteredData.length.toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Valor Total do Estoque:</span>
                  <p className="text-xl font-black text-foreground">{formatCurrency(totalAdvValorEstoque)}</p>
                </div>
                <button
                  onClick={() => {
                    if (advancedFilteredData.length === 0) {
                      alert('Nenhum item para gerar relatório PDF.');
                      return;
                    }
                    gerarPdfRelatorioAvancado(advancedFilteredData);
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black px-6 py-3 rounded-2xl shadow-xl hover:shadow-primary/20 active:scale-95 uppercase tracking-widest text-xs min-h-[44px] transition-all"
                >
                  <Download size={18} />
                  Gerar PDF Avançado
                </button>
              </div>

              {/* Lista de Pré-visualização - DESKTOP TABLE */}
              <div className="hidden md:block erp-card overflow-hidden">
                <div
                  className="overflow-x-auto custom-scrollbar max-h-[500px] overflow-y-auto"
                  onScroll={handleAdvScroll}
                >
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-zinc-200 dark:bg-zinc-800 border-b-2 border-border sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-zinc-700 dark:text-zinc-300">Descrição</th>
                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-zinc-700 dark:text-zinc-300 text-center">Corredor</th>
                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-zinc-700 dark:text-zinc-300 text-center">Dias S/ Venda</th>
                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-zinc-700 dark:text-zinc-300 text-center">Estoque</th>
                        <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-zinc-700 dark:text-zinc-300 text-right">Valor do Estoque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(!hasLoaded && globalLoading) ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-16 text-center">
                            <Loader2 className="animate-spin mx-auto text-primary w-10 h-10" />
                          </td>
                        </tr>
                      ) : visibleAdvData.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-16 text-center text-muted-foreground font-bold">
                            Nenhum item encontrado com os filtros aplicados.
                          </td>
                        </tr>
                      ) : visibleAdvData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-primary/5 transition-all">
                          <td className="px-6 py-4 font-bold text-foreground">
                            <div>
                              <p>{item.DESCRICAO || item.descricao}</p>
                              <span className="text-[10px] text-muted-foreground font-black uppercase">{item.CODIGO || item.codigo}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-primary/10 text-primary font-black text-xs px-2.5 py-1 rounded-md">
                              {item.CORREDOR || item.corredor || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn("font-black", item._diasSemVendaNum > 6 ? "text-destructive" : "text-foreground")}>
                              {item._diasSemVendaNum}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-bold">{item._estoqueStr}</td>
                          <td className="px-6 py-4 text-right font-black text-foreground">
                            {formatCurrency(item._valorEstoqueCalculado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lista de Pré-visualização - MOBILE CARDS */}
              <div
                className="md:hidden flex flex-col gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-1"
                onScroll={handleAdvScroll}
              >
                {visibleAdvData.length === 0 ? (
                  <div className="erp-card p-8 text-center text-muted-foreground font-bold">
                    Nenhum item encontrado com os filtros aplicados.
                  </div>
                ) : (
                  visibleAdvData.map((item, idx) => (
                    <div key={idx} className="erp-card p-4 space-y-3 relative border-l-4 border-l-primary">
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-1 flex-1">
                          <span className="font-black text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase tracking-widest inline-block">
                            {item.CODIGO || item.codigo}
                          </span>
                          <h3 className="font-bold text-sm leading-tight mt-1">{item.DESCRICAO || item.descricao}</h3>
                        </div>
                        <span className="bg-primary/10 text-primary font-black text-xs px-2 py-1 rounded-md shrink-0">
                          Corr. {item.CORREDOR || item.corredor || '-'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-dashed border-border text-xs">
                        <div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Dias S/ Venda</p>
                          <p className={cn("font-black", item._diasSemVendaNum > 6 ? "text-destructive" : "text-foreground")}>
                            {item._diasSemVendaNum}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Estoque</p>
                          <p className="font-bold text-foreground">{item._estoqueStr}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Valor Estoque</p>
                          <p className="font-black text-primary">{formatCurrency(item._valorEstoqueCalculado)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Botão no final da Aba Avançado */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => {
                    if (advancedFilteredData.length === 0) {
                      alert('Nenhum item para gerar relatório PDF.');
                      return;
                    }
                    gerarPdfRelatorioAvancado(advancedFilteredData);
                  }}
                  className="flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black px-8 py-4 rounded-2xl shadow-xl hover:shadow-primary/20 active:scale-95 uppercase tracking-widest text-xs min-h-[44px] transition-all"
                >
                  <Download size={18} />
                  Gerar PDF Avançado
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Modal: Escolher "Com Estoque", "Todos os Itens" ou "ISV" antes de gerar PDF */}
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
                <button
                  onClick={() => handleGerarPDFConfirm('isv')}
                  className="w-full bg-destructive/10 text-destructive font-bold py-4 rounded-lg flex items-center justify-center gap-2 text-sm border border-destructive/20 hover:bg-destructive/20 transition-all"
                >
                  <FileText size={18} /> ISV (Índice Sem Vendas)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Visualizar QR Code */}
      {showQrModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden">
            <div className="p-5 border-b border-border bg-primary/5 flex justify-between items-center">
              <h3 className="text-lg font-black">QR Code do Relatório</h3>
              <button onClick={() => setShowQrModal(false)} className="p-1 hover:bg-destructive hover:text-destructive-foreground rounded-full">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center justify-center space-y-4">
              <canvas ref={qrCanvasRef} className="border border-border rounded-xl p-2 bg-white" />
              <p className="text-xs text-muted-foreground font-bold text-center px-4">
                Escaneie o QR Code acima para visualizar ou imprimir o PDF de auditoria de estoque em lote no dispositivo móvel.
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(qrCodeUrl);
                  alert('URL copiada para a área de transferência!');
                }}
                className="text-xs font-black text-primary hover:underline uppercase tracking-widest"
              >
                Copiar Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}