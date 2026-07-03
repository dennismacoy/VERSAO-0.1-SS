import React, { useState, useEffect, useRef } from 'react';
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
  Trash2
} from 'lucide-react';
import QRCode from 'qrcode';
import { generateRelatorioPDF } from '../lib/pdfGenerator';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductsContext';
import { cn, parseEstoque, getEstoqueNumerico, formatCurrency } from '../lib/utils';

export default function Relatorios() {
  const { hasPermission } = useAuth();
  const canSeeAtual = hasPermission('Ver Aba Atual');

  const [query, setQuery] = useState('');
  const [selectedRazao, setSelectedRazao] = useState('');
  const { products: cacheProducts, loading: globalLoading, hasLoaded } = useProducts();
  const [visibleCount, setVisibleCount] = useState(20);

  const [razoesSelecionadas, setRazoesSelecionadas] = useState([]);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const qrCanvasRef = useRef(null);

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

  // Total em Risco (IDW)
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

      if (diasSemVenda > 6 && temEstoque) {
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
          rzData = rzData.filter(item => parseEstoque(item.ESTOQUE || item.QTE || item.estoque || 0));
        }

        let rzTotalInRisk = 0;
        rzData.forEach(item => {
          const estoqueStr = item.ESTOQUE || item.QTE || item.estoque || 0;
          const temEstoque = parseEstoque(estoqueStr);
          const diasSemVenda = Number(item.DIAS_SEM_VENDA || item.ISV || item.dias_sem_venda || 0);
          const estoqueNum = getEstoqueNumerico(estoqueStr);
          const custo = Number(item.CUSTO || item.PRECO || item.custo || 0);
          const valorEstoque = estoqueNum * custo;

          if (diasSemVenda > 6 && temEstoque) {
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
      // Geração Única
      let dataParaPDF = filteredData;
      if (filterType === 'com_estoque') {
        dataParaPDF = filteredData.filter(item => {
          const estoqueStr = item.ESTOQUE || item.QTE || item.estoque || 0;
          return parseEstoque(estoqueStr);
        });
      }
      generateRelatorioPDF(dataParaPDF, riskAnalysis.totalInRisk, selectedRazao);
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
      </div>

      {canSeeAtual ? (
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
                onClick={handleGuardarRazao}
                className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-muted text-foreground font-black px-6 py-3 md:py-4 rounded-2xl transition-all shadow-sm hover:bg-muted/80 active:scale-95 uppercase tracking-widest text-xs min-h-[44px]"
              >
                <Plus size={18} />
                Guardar
              </button>
              <button
                onClick={handleGerarPDFClick}
                className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-primary text-primary-foreground font-black px-8 py-3 md:py-4 rounded-2xl transition-all shadow-xl hover:shadow-primary/20 active:scale-95 uppercase tracking-widest text-xs min-h-[44px]"
              >
                <Download size={18} />
                Gerar PDF
              </button>
              <button
                onClick={handleGerarQRCode}
                className="flex-none flex items-center justify-center bg-accent text-accent-foreground font-black p-3 md:p-4 rounded-2xl transition-all shadow-md hover:bg-accent/90 active:scale-95 min-h-[44px]"
                title="Gerar QR Code"
              >
                <QrCode size={20} />
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