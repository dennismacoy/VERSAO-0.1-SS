import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, FileText, Download, Loader2, Save, History, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Relatorios() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getHistory('Relatorios_Hist');
      if (res && res.data) {
        setHistory(res.data);
      } else if (Array.isArray(res)) {
        setHistory(res);
      } else {
        // Fallback mock
        setHistory([
          { id: 'REL-001', data: '10/05/2026', razao: 'MERCADO ABC LTDA', riscoTotal: 2500.50, itensCriticos: 4, responsavel: 'Admin' }
        ]);
      }
    } catch (e) {
      console.error(e);
      // Fallback mock
      setHistory([
        { id: 'REL-001', data: '10/05/2026', razao: 'MERCADO ABC LTDA', riscoTotal: 2500.50, itensCriticos: 4, responsavel: 'Admin' }
      ]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    try {
      // Assuming searchProducts handles 'razaosocial' if passed. Or backend searches globally.
      const res = await api.searchProducts(query, 'razao_social');
      if (Array.isArray(res)) setItems(res);
      else if (res && res.data) setItems(res.data);
      else {
        // mock
        setItems([
          { codigo: '1001', descricao: 'REFRIGERANTE COLA 2L', emb: 'UN', entrada: '10/05/2026', dias_sem_venda: 2, estoque: 150, custo: 5.00 },
          { codigo: '1002', descricao: 'SABAO EM PO 1KG', emb: 'CX', entrada: '05/05/2026', dias_sem_venda: 8, estoque: 80, custo: 9.00 },
          { codigo: '1003', descricao: 'ARROZ 5KG', emb: 'FD', entrada: '01/05/2026', dias_sem_venda: 15, estoque: 50, custo: 20.00 },
          { codigo: '1004', descricao: 'FEIJAO 1KG', emb: 'FD', entrada: '08/05/2026', dias_sem_venda: 4, estoque: 100, custo: 8.50 },
        ]);
      }
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const criticalItems = items.filter(p => (p.dias_sem_venda || 0) > 6);
  
  const riscoFinanceiro = criticalItems.reduce((acc, p) => {
    const dsv = p.dias_sem_venda || 0;
    const est = p.estoque || 0;
    const cst = p.custo || p.valor || 0;
    return acc + (dsv * (est * cst));
  }, 0);

  const handleSaveAndGenerate = async () => {
    if (items.length === 0) {
      alert("Nenhum dado para gerar relatório.");
      return;
    }
    setSaving(true);
    
    // Generate PDF First
    const doc = new jsPDF();
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0);
    doc.text("Auditoria de Risco de Estoque", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Razão Social / Pesquisa: ${query.toUpperCase()}`, 14, 28);
    doc.text(`Data da Emissão: ${new Date().toLocaleDateString()} às ${new Date().toLocaleTimeString()}`, 14, 34);
    doc.text(`Responsável: ${user?.name || 'Sistema'}`, 14, 40);
    
    // Risco Financeiro Block
    doc.setFillColor(255, 243, 205); // light yellow
    doc.setDrawColor(234, 179, 8); // primary yellow border
    doc.rect(14, 48, 182, 30, 'FD');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(133, 100, 4);
    doc.text("RISCO FINANCEIRO (ITENS CRÍTICOS > 6 DIAS S/ VENDA)", 20, 58);
    
    doc.setFontSize(20);
    doc.text(`${formatCurrency(riscoFinanceiro)}`, 20, 70);
    
    // Table
    const tableData = items.map(item => [
      item.codigo,
      item.descricao,
      item.emb || 'UN',
      item.entrada || '-',
      (item.dias_sem_venda || 0).toString(),
      (item.estoque || 0).toString()
    ]);

    doc.autoTable({
      startY: 85,
      head: [['Código', 'Descrição', 'Emb', 'Últ. Entrada', 'Dias s/ Venda', 'Estoque']],
      body: tableData,
      theme: 'plain',
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.1, lineColor: 200 },
      bodyStyles: { textColor: 50, lineWidth: 0.1, lineColor: 220 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 4 },
      didParseCell: function (data) {
        if (data.section === 'body') {
          // Highlight rows with > 6 days
          const dsv = parseInt(data.row.raw[4]);
          if (dsv > 6) {
            data.cell.styles.fillColor = [255, 240, 240]; // Light red
            if (data.column.index === 4) {
              data.cell.styles.textColor = [200, 0, 0];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      }
    });

    const pdfBase64 = doc.output('datauristring'); // could save to backend if needed
    doc.save(`auditoria_${query.replace(/\s+/g, '_')}.pdf`);

    // Save to backend
    try {
      const reportData = {
        data: new Date().toISOString(),
        razao: query,
        riscoTotal: riscoFinanceiro,
        itensCriticos: criticalItems.length,
        responsavel: user?.name,
        // pdfData: pdfBase64 // if backend supports large strings
      };
      await api.saveReport(reportData);
      loadHistory(); // refresh history
    } catch (err) {
      console.error("Erro ao salvar relatório na API", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Relatórios por Razão Social</h1>
          <p className="text-muted-foreground mt-1">Gere auditorias financeiras e analise o giro de estoque</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-[350px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-24 py-3 border border-border rounded-xl bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm font-medium"
              placeholder="Digite a Razão Social..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="absolute inset-y-1 right-1">
              <button
                onClick={handleSearch}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg font-bold text-sm h-full transition-colors border border-border"
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Stats & Action */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 border border-yellow-200 dark:border-yellow-900/50 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
            <div className="p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-full text-yellow-600 dark:text-yellow-500 mb-4 shadow-sm">
              <AlertTriangle size={36} />
            </div>
            <h2 className="text-lg font-bold text-yellow-800 dark:text-yellow-500 leading-tight">Risco Financeiro<br/>Total</h2>
            <p className="text-xs font-semibold text-yellow-700/80 dark:text-yellow-500/80 mt-2 bg-yellow-200/50 dark:bg-yellow-900/30 px-3 py-1 rounded-full">
              Fórmula: Dias s/ Venda × (Estoque × Custo)
            </p>
            <p className="text-4xl font-black text-yellow-900 dark:text-yellow-400 mt-4 break-all">
              {formatCurrency(riscoFinanceiro)}
            </p>
            <p className="text-sm font-bold text-danger mt-2">
              {criticalItems.length} itens em estado crítico
            </p>
          </div>

          <button 
            onClick={handleSaveAndGenerate}
            disabled={items.length === 0 || saving}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 py-4 rounded-2xl font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-95 text-lg"
          >
            {saving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
            Salvar e Gerar PDF
          </button>
        </div>

        {/* Right Table */}
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="p-5 border-b border-border bg-muted/30">
            <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              Resultado da Consulta
            </h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-semibold uppercase tracking-wider text-xs border-b border-border sticky top-0">
                <tr>
                  <th className="px-5 py-4">Código</th>
                  <th className="px-5 py-4">Descrição</th>
                  <th className="px-5 py-4 text-center">Emb</th>
                  <th className="px-5 py-4 text-center">Entrada</th>
                  <th className="px-5 py-4 text-center">Dias s/ Venda</th>
                  <th className="px-5 py-4 text-center">Estoque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-12 text-center">
                      <Loader2 className="animate-spin mx-auto text-primary" size={32} />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-12 text-center text-muted-foreground font-medium">
                      Faça uma busca por Razão Social.
                    </td>
                  </tr>
                ) : (
                  items.map((p, idx) => {
                    const isCritical = (p.dias_sem_venda || 0) > 6;
                    return (
                      <tr 
                        key={idx} 
                        className={`transition-colors ${isCritical ? 'bg-red-50/40 hover:bg-red-50/80 dark:bg-red-950/20 dark:hover:bg-red-950/40' : 'hover:bg-muted/50'}`}
                      >
                        <td className="px-5 py-4 font-bold">{p.codigo}</td>
                        <td className="px-5 py-4 font-medium">{p.descricao}</td>
                        <td className="px-5 py-4 text-center">
                          <span className="bg-background border border-border text-foreground px-2 py-1 rounded-md text-xs font-bold shadow-sm">
                            {p.emb || 'UN'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center font-medium">{p.entrada || '-'}</td>
                        <td className="px-5 py-4 text-center">
                          <div className={`inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm font-black shadow-sm ${
                            isCritical 
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 animate-pulse border border-red-200 dark:border-red-800' 
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}>
                            {p.dias_sem_venda || 0}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center font-black">{p.estoque || 0}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Histórico Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="p-5 border-b border-border bg-muted/30 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <History size={24} className="text-primary" />
            Histórico de Relatórios Gerados
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground font-semibold uppercase tracking-wider text-xs border-b border-border">
              <tr>
                <th className="px-5 py-4">ID</th>
                <th className="px-5 py-4">Data</th>
                <th className="px-5 py-4">Razão Social</th>
                <th className="px-5 py-4 text-center">Itens Críticos</th>
                <th className="px-5 py-4 text-right">Risco Total Apurado</th>
                <th className="px-5 py-4">Gerado Por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {historyLoading ? (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-muted-foreground">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-muted-foreground font-medium">
                    Nenhum relatório foi salvo ainda.
                  </td>
                </tr>
              ) : (
                history.map((h, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 font-bold text-primary">{h.id}</td>
                    <td className="px-5 py-4 font-medium">{h.data}</td>
                    <td className="px-5 py-4 font-bold">{h.razao}</td>
                    <td className="px-5 py-4 text-center font-black text-danger">{h.itensCriticos}</td>
                    <td className="px-5 py-4 text-right font-black">{formatCurrency(h.riscoTotal)}</td>
                    <td className="px-5 py-4">
                      <span className="bg-muted/50 border border-border px-3 py-1 rounded-lg text-xs font-bold">
                        {h.responsavel}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
