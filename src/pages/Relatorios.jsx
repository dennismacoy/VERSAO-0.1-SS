import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Search, 
  FileText, 
  Download, 
  TrendingDown, 
  AlertTriangle, 
  Calendar, 
  History as HistoryIcon,
  Filter,
  Loader2,
  DollarSign
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export default function Relatorios() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('geral');
  const [query, setQuery] = useState('');
  const [selectedRazao, setSelectedRazao] = useState('');
  const [data, setData] = useState([]);
  const [reportHistory, setReportHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, hist] = await Promise.all([
        api.searchProducts(''),
        api.getHistory('Relatorios_Hist')
      ]);
      setData(Array.isArray(res) ? res : (res?.data || []));
      setReportHistory(Array.isArray(hist) ? hist : (hist?.data || []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const filteredData = data.filter(item => {
    const term = query.toLowerCase();
    const matchTerm = (
      item.descricao?.toLowerCase().includes(term) || 
      item.razaosocial?.toLowerCase().includes(term) ||
      item.codigo?.toString().includes(term)
    );
    if (selectedRazao) {
      return matchTerm && item.razaosocial === selectedRazao;
    }
    return matchTerm;
  });

  const handleRowClick = (item) => {
    if (item.razaosocial) {
      setSelectedRazao(item.razaosocial);
      setQuery(''); // Optionally clear the query so we see all products for this company
    }
  };

  // Risk Analysis
  const totalInRisk = filteredData.reduce((acc, item) => {
    const dias = Number(item.dias_sem_venda || 0);
    const valor = Number(item.valor_estoque || 0);
    return dias > 0 ? acc + (dias * valor) : acc;
  }, 0);

  const riskCount = filteredData.filter(i => Number(i.dias_sem_venda) > 6).length;

  const generateReportPDF = () => {
    const doc = new jsPDF();
    const docWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, docWidth, 40, 'F');
    
    doc.setTextColor(255, 215, 0);
    doc.setFontSize(22);
    doc.text("RELATÓRIO DE AUDITORIA DE ESTOQUE", 14, 25);
    
    doc.setFontSize(10);
    doc.text(`TOTAL EM RISCO (IDW): ${formatCurrency(totalInRisk)}`, 14, 32);

    if (selectedRazao) {
      doc.setFontSize(12);
      doc.text(`RAZÃO SOCIAL: ${selectedRazao}`, 14, 38);
    }

    doc.autoTable({
      startY: selectedRazao ? 45 : 40,
      head: [['Cód', 'Descrição', 'Razão Social', 'Dias S/ Venda', 'Valor Est.', 'Risco (V*D)']],
      body: filteredData.map(item => [
        item.codigo,
        item.descricao,
        item.razaosocial,
        item.dias_sem_venda || '0',
        formatCurrency(item.valor_estoque),
        formatCurrency((Number(item.dias_sem_venda) || 0) * (Number(item.valor_estoque) || 0))
      ]),
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 215, 0] }
    });

    doc.save(`relatorio_auditoria_${Date.now()}.pdf`);
  };

  const handleSaveToHistory = async () => {
    if (!hasPermission('Botão Gerar PDF')) return; // Reusing this permission conceptually or create a new one
    try {
      const reportData = {
        id: `REL-${Date.now().toString().slice(-6)}`,
        data: new Date().toISOString(),
        razao: selectedRazao || 'Geral',
        itensCriticos: riskCount,
        riscoTotal: totalInRisk,
        responsavel: 'Admin'
      };
      // Mock API call to save history
      // await api.saveReport(reportData);
      setReportHistory([{...reportData, nome: reportData.id, geradoPor: reportData.responsavel, valorTotal: reportData.riscoTotal}, ...reportHistory]);
      alert("Relatório salvo no histórico com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar relatório.");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-8 pb-10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic">
            Inteligência de <span className="text-primary">Dados</span>
          </h1>
          <p className="text-muted-foreground font-bold text-sm tracking-widest uppercase">
            Auditoria, Performance e Análise de Risco
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setActiveTab('geral')}
            className={cn(
              "px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm border-2",
              activeTab === 'geral' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
            )}
          >
            Relatório Atual
          </button>
          <button 
            onClick={() => setActiveTab('historico')}
            className={cn(
              "px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm border-2",
              activeTab === 'historico' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
            )}
          >
            Histórico de Relatórios
          </button>
        </div>
      </div>

      {activeTab === 'geral' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="erp-card p-6 bg-destructive/5 border-l-8 border-l-destructive flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-destructive uppercase tracking-widest mb-1">Total em Risco (IDW)</p>
                <h3 className="text-3xl font-black tracking-tighter text-destructive">{formatCurrency(totalInRisk)}</h3>
              </div>
              <div className="p-4 bg-destructive/10 rounded-2xl text-destructive">
                <TrendingDown size={32} />
              </div>
            </div>

            <div className="erp-card p-6 border-l-8 border-l-primary flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Itens Críticos (+6 Dias)</p>
                <h3 className="text-3xl font-black tracking-tighter text-foreground">{riskCount}</h3>
              </div>
              <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                <AlertTriangle size={32} />
              </div>
            </div>

            <div className="erp-card p-6 border-l-8 border-l-success flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-success uppercase tracking-widest mb-1">Base Analisada</p>
                <h3 className="text-3xl font-black tracking-tighter text-foreground">{filteredData.length}</h3>
              </div>
              <div className="p-4 bg-success/10 rounded-2xl text-success">
                <BarChart3 size={32} />
              </div>
            </div>
          </div>

          <div className="erp-card p-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 flex gap-2 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                <input 
                  type="text"
                  placeholder="Filtrar por Descrição ou Razão Social..."
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-border bg-background focus:border-primary font-bold transition-all"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {selectedRazao && (
                <button 
                  onClick={() => setSelectedRazao('')}
                  className="px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all min-h-[44px]"
                >
                  Limpar Razão
                </button>
              )}
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <button 
                onClick={handleSaveToHistory}
                className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-muted text-foreground font-black px-6 py-4 rounded-2xl transition-all shadow-sm hover:bg-muted/80 active:scale-95 uppercase tracking-widest text-xs min-h-[44px]"
              >
                <HistoryIcon size={18} />
                Guardar Relatório
              </button>
              <button 
                onClick={generateReportPDF}
                className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-primary text-primary-foreground font-black px-8 py-4 rounded-2xl transition-all shadow-xl hover:shadow-primary/20 active:scale-95 uppercase tracking-widest text-xs min-h-[44px]"
              >
                <Download size={18} />
                Gerar PDF
              </button>
            </div>
          </div>

          <div className="erp-card overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Produto</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Razão Social</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-center">Dias S/ Venda</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-right">Valor Est.</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-right">Risco Calc.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-20 text-center">
                        <Loader2 className="animate-spin mx-auto text-primary w-12 h-12" />
                      </td>
                    </tr>
                  ) : filteredData.map((item, idx) => {
                    const dias = Number(item.dias_sem_venda || 0);
                    const risco = dias * (Number(item.valor_estoque) || 0);
                    return (
                        <tr 
                        key={idx} 
                        onClick={() => handleRowClick(item)}
                        className={cn(
                          "hover:bg-primary/5 transition-all cursor-pointer",
                          dias > 6 ? "bg-destructive/5" : "",
                          selectedRazao === item.razaosocial ? "border-l-4 border-l-primary bg-primary/5" : ""
                        )}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{item.descricao}</span>
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{item.codigo}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-muted-foreground">{item.razaosocial}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            "px-3 py-1 rounded-full font-black text-xs",
                            dias > 6 ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {dias} Dias
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold">
                          {formatCurrency(item.valor_estoque)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={cn("font-black text-lg", dias > 0 ? "text-destructive" : "text-success")}>
                            {formatCurrency(risco)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportHistory.length === 0 ? (
            <div className="col-span-full erp-card p-20 flex flex-col items-center justify-center text-muted-foreground/30 border-dashed border-4">
              <HistoryIcon size={80} strokeWidth={1} />
              <p className="mt-4 font-black uppercase tracking-widest">Nenhum histórico disponível</p>
            </div>
          ) : (
            reportHistory.map((h, idx) => (
              <div key={idx} className="erp-card p-6 flex flex-col gap-4 border-l-4 border-l-primary hover:scale-[1.02]">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-muted rounded-2xl">
                    <FileText size={24} className="text-primary" />
                  </div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{h.data}</span>
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">{h.nome || h.id}</h3>
                  <p className="text-xs font-bold text-muted-foreground uppercase mt-1">Gerado por: {h.geradoPor || h.responsavel}</p>
                </div>
                <div className="pt-4 border-t border-border flex justify-between items-center">
                  <div className="text-xs font-black text-primary uppercase">Total: {formatCurrency(h.valorTotal || h.total)}</div>
                  <button className="p-2 bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl transition-all">
                    <Download size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
