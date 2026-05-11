import React, { useState, useEffect } from 'react';
import { FileText, Clock, CheckCircle2, PlayCircle, Archive, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { api } from '../lib/api';

export default function Separacao() {
  const [separacoes, setSeparacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getHistory('Prevendas');
      if (res && res.data) {
        setSeparacoes(res.data);
      } else if (Array.isArray(res)) {
        setSeparacoes(res);
      } else {
        // Fallback mock
        setSeparacoes([
          { id: 'PV-1001', pedido: 'PV-1001', responsavel: 'Repositor Marcos', status: 'Aberta', itens: [{codigo: '1001', descricao: 'REFRIGERANTE COLA 2L', emb: 'UN', estoque: 150, qtd: 10}] },
          { id: 'PV-1002', pedido: 'PV-1002', responsavel: 'Repositor Marcos', status: 'Iniciada', itens: [{codigo: '1002', descricao: 'SABAO EM PO 1KG', emb: 'CX', estoque: 80, qtd: 2}] },
          { id: 'PV-1003', pedido: 'PV-1003', responsavel: 'Lider João', status: 'Em Andamento', itens: [{codigo: '1003', descricao: 'ARROZ 5KG', emb: 'FD', estoque: 50, qtd: 5}] },
          { id: 'PV-1004', pedido: 'PV-1004', responsavel: 'Repositor Marcos', status: 'Finalizada', itens: [{codigo: '1004', descricao: 'FEIJAO 1KG', emb: 'FD', estoque: 100, qtd: 10}] },
        ]);
      }
    } catch (e) {
      console.error(e);
      // Fallback mock
      setSeparacoes([
        { id: 'PV-1001', pedido: 'PV-1001', responsavel: 'Repositor Marcos', status: 'Aberta', itens: [{codigo: '1001', descricao: 'REFRIGERANTE COLA 2L', emb: 'UN', estoque: 150, qtd: 10}] },
        { id: 'PV-1002', pedido: 'PV-1002', responsavel: 'Repositor Marcos', status: 'Iniciada', itens: [{codigo: '1002', descricao: 'SABAO EM PO 1KG', emb: 'CX', estoque: 80, qtd: 2}] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    // Optimistic UI Update
    const original = [...separacoes];
    setSeparacoes(separacoes.map(s => s.id === id ? { ...s, status: newStatus } : s));
    
    try {
      await api.updateStatus(id, newStatus);
    } catch (e) {
      console.error("Erro ao atualizar status", e);
      // Revert if error
      setSeparacoes(original);
      alert("Erro ao sincronizar status com o servidor.");
    }
  };

  const statusColors = {
    'Aberta': 'bg-muted text-muted-foreground border-border',
    'Iniciada': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-500 dark:border-yellow-900/50',
    'Em Andamento': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-500 dark:border-blue-900/50',
    'Finalizada': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-500 dark:border-green-900/50',
  };

  const statusIcons = {
    'Aberta': Archive,
    'Iniciada': PlayCircle,
    'Em Andamento': Clock,
    'Finalizada': CheckCircle2,
  };

  const statusSequence = ['Aberta', 'Iniciada', 'Em Andamento', 'Finalizada'];

  const generatePDF = (separacao) => {
    const doc = new jsPDF();
    
    doc.setFontSize(24);
    doc.setTextColor(0);
    doc.text(`Separação: ${separacao.pedido || separacao.id}`, 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(`Responsável: ${separacao.responsavel || 'Não informado'}`, 14, 32);
    doc.text(`Data Impressão: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 40);

    const itens = separacao.itens || [];
    const tableData = itens.map(item => [
      item.codigo,
      item.descricao,
      item.emb || 'UN',
      item.estoque || '-',
      item.qtd || '-'
    ]);

    doc.autoTable({
      startY: 50,
      head: [['Código', 'Descrição', 'Emb', 'Estoque', 'Separar']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [230, 230, 230], textColor: 0, fontSize: 14, fontStyle: 'bold' },
      bodyStyles: { fontSize: 16, fontStyle: 'bold', textColor: 20 }, // Fontes grandes para leitura logística
      styles: { cellPadding: 8, valign: 'middle' },
      columnStyles: {
        4: { fillColor: [255, 250, 230] } // Destacar a coluna "Separar"
      }
    });

    doc.save(`logistica_separacao_${separacao.pedido || separacao.id}.pdf`);
  };

  const renderColumn = (title, statusName) => {
    const columnItems = separacoes.filter(s => s.status === statusName);
    const Icon = statusIcons[statusName];

    return (
      <div className="flex flex-col bg-muted/20 border border-border rounded-2xl p-4 min-w-[320px] max-w-[320px] h-full shadow-sm">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Icon size={20} className={statusColors[statusName].split(' ')[1]} />
            {title}
          </h3>
          <span className="bg-background px-3 py-1 rounded-full text-xs font-black border border-border shadow-sm">
            {columnItems.length}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-4 px-1 custom-scrollbar pb-4">
          {columnItems.map(s => {
            const currentIndex = statusSequence.indexOf(s.status);
            const itensList = s.itens || [];
            
            return (
              <div key={s.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-black text-xl text-primary">{s.pedido || s.id}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-md border font-bold ${statusColors[s.status]}`}>
                    {s.status}
                  </span>
                </div>
                
                <div className="mb-5 bg-muted/30 p-3 rounded-lg border border-border/50">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Responsável</p>
                  <p className="font-semibold text-foreground">{s.responsavel || 'Não Atribuído'}</p>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">{itensList.length} itens a separar</p>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => generatePDF(s)}
                    className="w-full bg-background hover:bg-muted text-foreground border border-border text-sm font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <FileText size={16} className="text-primary" /> Gerar PDF de Separação
                  </button>
                  
                  <select
                    className="w-full bg-secondary text-secondary-foreground border border-border rounded-lg text-sm font-bold px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    value={s.status}
                    onChange={(e) => updateStatus(s.id, e.target.value)}
                  >
                    {/* Disable options that are before the current state (except if it is Aberta) */}
                    <option value="Aberta" disabled={currentIndex > 0}>Aberta (Pendente)</option>
                    <option value="Iniciada" disabled={currentIndex > 1}>Iniciar Separação</option>
                    <option value="Em Andamento" disabled={currentIndex > 2}>Em Andamento</option>
                    <option value="Finalizada">Finalizar Pedido</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-6 pb-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Separação Logística</h1>
        <p className="text-muted-foreground mt-1">Gestão de fluxo e emissão de mapa de separação sem valores</p>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground gap-3">
            <Loader2 className="animate-spin" size={32} />
            <span className="font-medium text-lg">Carregando painel de separação...</span>
          </div>
        ) : (
          <div className="flex gap-6 h-full min-w-max items-start">
            {renderColumn('Aberta', 'Aberta')}
            {renderColumn('Iniciada', 'Iniciada')}
            {renderColumn('Em Andamento', 'Em Andamento')}
            {renderColumn('Finalizada', 'Finalizada')}
          </div>
        )}
      </div>
    </div>
  );
}
